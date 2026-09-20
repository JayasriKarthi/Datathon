"""DynamoDB / S3 access. Tables are small (demo scale) so list/search use Scan;
for production you would add GSIs (by station, status) or index into OpenSearch."""
from __future__ import annotations

import json
import os
from decimal import Decimal
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from . import config


# ── clients (cached across warm Lambda invocations) ──────────────────────────
@lru_cache(maxsize=1)
def _ddb():
    return boto3.resource("dynamodb")


@lru_cache(maxsize=1)
def s3():
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
    # SigV4 + regional endpoint so presigned URLs work immediately in any region
    return boto3.client("s3", region_name=region, config=Config(signature_version="s3v4"))


def reset_clients() -> None:  # used by tests
    _ddb.cache_clear()
    s3.cache_clear()


def cases_table():
    return _ddb().Table(config.CASES_TABLE)


def alerts_table():
    return _ddb().Table(config.ALERTS_TABLE)


def officers_table():
    return _ddb().Table(config.OFFICERS_TABLE)


# ── DynamoDB <-> JSON conversion (DynamoDB rejects float, returns Decimal) ────
def to_dynamo(obj: Any) -> Any:
    return json.loads(json.dumps(obj), parse_float=Decimal)


def from_dynamo(obj: Any) -> Any:
    if isinstance(obj, list):
        return [from_dynamo(i) for i in obj]
    if isinstance(obj, dict):
        return {k: from_dynamo(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj


def _scan_all(table) -> list[dict]:
    resp = table.scan()
    items = list(resp["Items"])
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp["Items"])
    return items


# ── officers ─────────────────────────────────────────────────────────────────
def get_officer(badge: str) -> dict | None:
    item = officers_table().get_item(Key={"badgeNumber": badge.upper()}).get("Item")
    return from_dynamo(item) if item else None


# ── cases ────────────────────────────────────────────────────────────────────
def list_cases() -> list[dict]:
    items = [from_dynamo(i) for i in _scan_all(cases_table()) if not str(i["id"]).startswith("__")]
    items.sort(key=lambda c: c.get("createdAt", ""), reverse=True)  # newest first
    return items


def get_case(case_id: str) -> dict | None:
    if case_id.startswith("__"):
        return None
    item = cases_table().get_item(Key={"id": case_id}).get("Item")
    return from_dynamo(item) if item else None


def put_case(case: dict) -> None:
    cases_table().put_item(Item=to_dynamo(case))


def delete_case(case_id: str) -> bool:
    try:
        cases_table().delete_item(Key={"id": case_id}, ConditionExpression="attribute_exists(id)")
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def next_case_number() -> int:
    """Atomic counter so two officers filing at once never get the same FIR number."""
    resp = cases_table().update_item(
        Key={"id": "__counter__"},
        UpdateExpression="SET n = if_not_exists(n, :start) + :one",
        ExpressionAttributeValues={":start": 1199, ":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    return int(resp["Attributes"]["n"])


def update_case(case_id: str, fields: dict, timeline_event: dict | None = None) -> dict | None:
    """Partial update. Returns the updated case, or None if it does not exist."""
    sets, names, values = [], {}, {}
    for i, (key, val) in enumerate(fields.items()):
        names[f"#f{i}"] = key            # placeholders avoid DynamoDB reserved words (e.g. status)
        values[f":v{i}"] = to_dynamo(val)
        sets.append(f"#f{i} = :v{i}")
    if timeline_event is not None:
        names["#tl"] = "timeline"
        values[":ev"] = to_dynamo([timeline_event])
        values[":empty"] = []
        sets.append("#tl = list_append(if_not_exists(#tl, :empty), :ev)")
    if not sets:
        return get_case(case_id)
    try:
        resp = cases_table().update_item(
            Key={"id": case_id},
            UpdateExpression="SET " + ", ".join(sets),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return None
        raise
    return from_dynamo(resp["Attributes"])


def append_evidence(case_id: str, evidence: dict, timeline_event: dict) -> bool:
    """Adds an evidence record and its timeline entry in one atomic update."""
    try:
        cases_table().update_item(
            Key={"id": case_id},
            UpdateExpression="SET evidence = list_append(if_not_exists(evidence, :e), :ev), "
                             "timeline = list_append(if_not_exists(timeline, :e), :tl)",
            ExpressionAttributeValues={
                ":e": [], ":ev": to_dynamo([evidence]), ":tl": to_dynamo([timeline_event]),
            },
            ConditionExpression="attribute_exists(id)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def _haystack(case: dict) -> str:
    parts = [case.get(k, "") for k in
             ("id", "firNumber", "title", "complainant", "description",
              "location", "sector", "investigatingOfficer", "category")]
    parts.extend(case.get("entities", []))
    return " ".join(str(p) for p in parts).lower()


def search_cases_substring(query: str) -> list[dict]:
    """Same semantics as the mock in casesApi.ts (whole query must appear)."""
    q = query.strip().lower()
    if not q:
        return []
    return [c for c in list_cases() if q in _haystack(c)]


def search_cases_ranked(query: str, limit: int = 5) -> list[dict]:
    """Looser token match used by the AI copilot: ranks by number of query words hit."""
    words = [w for w in query.lower().replace(",", " ").split() if len(w) > 2]
    scored = []
    for case in list_cases():
        hay = _haystack(case)
        score = sum(1 for w in words if w in hay)
        if score:
            scored.append((score, case))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [c for _, c in scored[:limit]]


# ── alerts ───────────────────────────────────────────────────────────────────
def list_alerts() -> list[dict]:
    items = [from_dynamo(i) for i in _scan_all(alerts_table())]
    items.sort(key=lambda a: a.get("timestamp", ""), reverse=True)
    return items


def mark_alert_read(alert_id: str) -> bool:
    try:
        alerts_table().update_item(
            Key={"id": alert_id},
            UpdateExpression="SET isRead = :t",
            ExpressionAttributeValues={":t": True},
            ConditionExpression="attribute_exists(id)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


# ── evidence storage ─────────────────────────────────────────────────────────
def presigned_upload(key: str, content_type: str) -> dict:
    """Presigned POST (not PUT) so S3 itself enforces the size cap and content type."""
    return s3().generate_presigned_post(
        Bucket=config.EVIDENCE_BUCKET,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, config.MAX_EVIDENCE_BYTES],
        ],
        ExpiresIn=600,
    )


def presigned_download(key: str) -> str:
    return s3().generate_presigned_url(
        "get_object", Params={"Bucket": config.EVIDENCE_BUCKET, "Key": key}, ExpiresIn=600
    )
