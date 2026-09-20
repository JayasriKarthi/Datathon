import json

import boto3
import pytest

import seed
from app import agent, config, db
from conftest import as_role

CASE_BODY = {
    "title": "Mobile theft at Koramangala", "description": "Phone snatched near the bus stop.",
    "complainant": "Rajesh Kumar", "location": "Koramangala 5th Block",
    "category": "property", "priority": "urgent", "entities": ["KA-01-XY-9999", " blue Activa "],
}


# ── health / auth ────────────────────────────────────────────────────────────
def test_health_is_public(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_requests_without_token_are_rejected(client):
    assert client.get("/api/v1/cases").status_code == 401
    assert client.get("/api/v1/cases", headers={"Authorization": "Bearer dev-god"}).status_code == 401


def test_dev_auth_cannot_be_enabled_inside_lambda(monkeypatch):
    import importlib
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "fn")
    monkeypatch.setenv("DEV_AUTH", "1")
    try:
        assert importlib.reload(config).DEV_AUTH is False
    finally:
        monkeypatch.undo()
        importlib.reload(config)


# ── cases ────────────────────────────────────────────────────────────────────
def test_list_cases_returns_seeded_data_newest_first(client):
    r = client.get("/api/v1/cases", headers=as_role("constable"))
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert ids == ["KA-CR-1142", "KA-CR-1156", "KA-CR-1149", "KA-CR-1138", "KA-CR-1098", "KA-CR-1076"]
    assert isinstance(r.json()[0]["latitude"], float)          # Decimal -> float round trip
    assert r.json()[0]["evidence"][0]["title"] == "Suspect sketch"


def test_get_case_and_404(client):
    h = as_role("inspector")
    assert client.get("/api/v1/cases/KA-CR-1142", headers=h).json()["title"].startswith("Chain snatching")
    assert client.get("/api/v1/cases/NOPE-1", headers=h).status_code == 404
    assert client.get("/api/v1/cases/__counter__", headers=h).status_code == 404   # internal item hidden
    assert client.get("/api/v1/cases/bad%20id!", headers=h).status_code == 422


def test_search_matches_like_the_mock(client):
    h = as_role("inspector")
    assert {c["id"] for c in client.get("/api/v1/cases/search?q=hoodi", headers=h).json()} >= {"KA-CR-1142"}
    assert client.get("/api/v1/cases/search?q=zzzznothing", headers=h).json() == []


def test_create_case_requires_permission_and_assigns_server_side_fields(client):
    assert client.post("/api/v1/cases", json=CASE_BODY, headers=as_role("constable")).status_code == 403
    r = client.post("/api/v1/cases", json=CASE_BODY, headers=as_role("sub_inspector"))
    assert r.status_code == 201
    case = r.json()
    assert case["id"] == "KA-CR-1200" and case["firNumber"] == "FIR KA-CR-1200"
    assert case["status"] == "open"
    assert case["entities"] == ["KA-01-XY-9999", "blue Activa"]     # trimmed
    assert case["timeline"][0]["event"] == "FIR Registered"
    # a second FIR gets the next number, and the new case is first in the list
    assert client.post("/api/v1/cases", json=CASE_BODY, headers=as_role("inspector")).json()["id"] == "KA-CR-1201"
    assert client.get("/api/v1/cases", headers=as_role("inspector")).json()[0]["id"] == "KA-CR-1201"


def test_client_cannot_spoof_officer_or_id(client):
    r = client.post("/api/v1/cases", json={**CASE_BODY, "investigatingOfficer": "Comm. X", "id": "HACK-1"},
                    headers=as_role("sub_inspector"))
    assert r.json()["id"].startswith("KA-CR-") and r.json()["investigatingOfficer"] != "Comm. X"


def test_create_case_validates_input(client):
    h = as_role("inspector")
    assert client.post("/api/v1/cases", json={**CASE_BODY, "title": ""}, headers=h).status_code == 422
    assert client.post("/api/v1/cases", json={**CASE_BODY, "priority": "asap"}, headers=h).status_code == 422
    assert client.post("/api/v1/cases", json={**CASE_BODY, "description": "x" * 6000}, headers=h).status_code == 422


def test_patch_case_rbac(client):
    url = "/api/v1/cases/KA-CR-1142"
    assert client.patch(url, json={"status": "closed"}, headers=as_role("constable")).status_code == 403
    r = client.patch(url, json={"status": "closed"}, headers=as_role("head_constable"))
    assert r.status_code == 200 and r.json()["status"] == "closed"
    # assigning an officer is commissioner-only
    assert client.patch(url, json={"investigatingOfficer": "X"}, headers=as_role("inspector")).status_code == 403
    assert client.patch(url, json={"investigatingOfficer": "SI New"}, headers=as_role("commissioner")).status_code == 200
    assert client.patch("/api/v1/cases/NOPE-1", json={"status": "closed"}, headers=as_role("inspector")).status_code == 404
    assert client.patch(url, json={}, headers=as_role("inspector")).status_code == 422


def test_timeline_append(client):
    url = "/api/v1/cases/KA-CR-1142/timeline"
    before = len(client.get("/api/v1/cases/KA-CR-1142", headers=as_role("inspector")).json()["timeline"])
    assert client.post(url, json={"event": "CCTV requested"}, headers=as_role("inspector")).status_code == 201
    after = client.get("/api/v1/cases/KA-CR-1142", headers=as_role("inspector")).json()["timeline"]
    assert len(after) == before + 1 and after[-1]["event"] == "CCTV requested"


def test_delete_case_rbac(client):
    url = "/api/v1/cases/KA-CR-1076"
    assert client.delete(url, headers=as_role("sub_inspector")).status_code == 403
    assert client.delete(url, headers=as_role("inspector")).status_code == 204
    assert client.get(url, headers=as_role("inspector")).status_code == 404
    assert client.delete(url, headers=as_role("inspector")).status_code == 404


# ── evidence ─────────────────────────────────────────────────────────────────
EV = {"type": "photo", "title": "Scene photo", "description": "", "filename": "../../etc/pass wd.jpg",
      "contentType": "image/jpeg"}


def test_evidence_upload_flow(client):
    h = as_role("constable")                        # every role may upload evidence
    r = client.post("/api/v1/cases/KA-CR-1142/evidence", json=EV, headers=h)
    assert r.status_code == 201
    body = r.json()
    key = body["evidence"]["s3Key"]
    assert key.startswith("cases/KA-CR-1142/ev-") and ".." not in key and " " not in key   # filename sanitised
    fields = body["upload"]["fields"]
    assert fields["key"] == key and fields["Content-Type"] == "image/jpeg"
    # S3 enforces the size cap through the signed policy
    import base64
    policy = json.loads(base64.b64decode(fields["policy"]))
    assert ["content-length-range", 1, config.MAX_EVIDENCE_BYTES] in policy["conditions"]
    # the case now lists it (with a download link) and logs a timeline entry
    case = client.get("/api/v1/cases/KA-CR-1142", headers=h).json()
    added = [e for e in case["evidence"] if e["id"] == body["evidence"]["id"]][0]
    assert added["url"].startswith("https://") and added["uploadedBy"]
    assert case["timeline"][-1]["event"].startswith("Evidence added")


def test_evidence_rejects_bad_type_and_missing_case(client):
    h = as_role("inspector")
    assert client.post("/api/v1/cases/KA-CR-1142/evidence", json={**EV, "contentType": "application/x-msdownload"},
                       headers=h).status_code == 415
    assert client.post("/api/v1/cases/NOPE-1/evidence", json=EV, headers=h).status_code == 404


# ── alerts / stats ───────────────────────────────────────────────────────────
def test_alerts_read_flow(client):
    h = as_role("inspector")
    assert len(client.get("/api/v1/alerts", headers=h).json()) == 4
    assert client.patch("/api/v1/alerts/alert-1/read", headers=h).status_code == 204
    assert client.patch("/api/v1/alerts/nope/read", headers=h).status_code == 404
    assert client.post("/api/v1/alerts/mark-all-read", headers=h).status_code == 204
    assert all(a["isRead"] for a in client.get("/api/v1/alerts", headers=h).json())


def test_stats_reflect_live_data(client):
    h = as_role("inspector")
    stats = {s["id"]: s for s in client.get("/api/v1/stats", headers=h).json()}
    total_before = stats["stat-total"]["value"]
    client.post("/api/v1/cases", json=CASE_BODY, headers=h)
    stats = {s["id"]: s for s in client.get("/api/v1/stats", headers=h).json()}
    assert stats["stat-total"]["value"] == total_before + 1 and stats["stat-today"]["value"] == 1


# ── copilot ──────────────────────────────────────────────────────────────────
def test_copilot_requires_permission(client):
    r = client.post("/api/v1/copilot/query", json={"query": "hi"}, headers=as_role("constable"))
    assert r.status_code == 403


def test_copilot_falls_back_to_real_data_when_bedrock_unavailable(client):
    # BEDROCK_MODEL_ID is unset in tests, so the agent path raises and the fallback answers
    r = client.post("/api/v1/copilot/query", json={"query": "chain snatching near Hoodi"}, headers=as_role("inspector"))
    assert r.status_code == 200 and r.json()["source"] == "fallback"
    assert "KA-CR-1142" in r.json()["response"]
    r = client.post("/api/v1/copilot/query", json={"query": "shift summary"}, headers=as_role("inspector"))
    assert "open cases" in r.json()["response"]


def test_history_conversion_satisfies_bedrock_ordering():
    hist = [{"role": "copilot", "content": "hello"},                # can't lead with assistant
            {"role": "user", "content": "a"}, {"role": "user", "content": "b"},   # merged
            {"role": "copilot", "content": "c"},
            {"role": "user", "content": "current question"}]        # dangling user turn dropped
    msgs = agent.to_strands_messages(hist, "current question")
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[0]["content"][0]["text"] == "a\nb"


def test_agent_tool_loop_end_to_end_with_scripted_model(aws):
    """Runs the REAL Strands agent loop against a scripted model that asks for the
    search_cases tool, then answers from its result. Proves tools are registered,
    executed against DynamoDB, and their output is fed back to the model."""
    from strands.models import Model

    class Scripted(Model):
        def __init__(self):
            self.calls, self.tool_result_seen = 0, None
        def update_config(self, **kw): pass
        def get_config(self): return {}
        async def structured_output(self, *a, **k):
            raise NotImplementedError
            yield
        async def stream(self, messages, tool_specs=None, system_prompt=None, **kw):
            self.calls += 1
            self.tools_offered = sorted(t["name"] for t in tool_specs or [])
            self.system_prompt = system_prompt
            usage = {"metadata": {"usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2}, "metrics": {"latencyMs": 1}}}
            if self.calls == 1:
                yield {"messageStart": {"role": "assistant"}}
                yield {"contentBlockStart": {"start": {"toolUse": {"toolUseId": "t1", "name": "search_cases"}}}}
                yield {"contentBlockDelta": {"delta": {"toolUse": {"input": json.dumps({"query": "chain snatching Hoodi"})}}}}
                yield {"contentBlockStop": {}}
                yield {"messageStop": {"stopReason": "tool_use"}}
            else:
                self.tool_result_seen = json.dumps(messages[-1])
                yield {"messageStart": {"role": "assistant"}}
                yield {"contentBlockStart": {"start": {}}}
                yield {"contentBlockDelta": {"delta": {"text": "Active cluster: KA-CR-1142 near Hoodi Circle."}}}
                yield {"contentBlockStop": {}}
                yield {"messageStop": {"stopReason": "end_turn"}}
            yield usage

    model = Scripted()
    out = agent.answer("Any chain snatching near Hoodi?", [], model=model)
    assert out == "Active cluster: KA-CR-1142 near Hoodi Circle."
    assert model.calls == 2
    assert model.tools_offered == ["get_case", "list_alerts", "search_cases", "shift_summary"]
    assert "KA-CR-1142" in model.tool_result_seen            # DynamoDB data reached the model
    assert "untrusted DATA" in model.system_prompt


# ── login (Cognito) ──────────────────────────────────────────────────────────
def test_login_against_cognito(client, monkeypatch, aws):
    cog = boto3.client("cognito-idp")
    # Same password policy as template.yaml. Cognito's default (8+ chars with upper, lower,
    # number AND symbol) would reject the derived "<pin>@<BADGE>" password.
    relaxed = {"PasswordPolicy": {"MinimumLength": 6, "RequireUppercase": False, "RequireLowercase": False,
                                  "RequireNumbers": False, "RequireSymbols": False}}
    pool = cog.create_user_pool(PoolName="t", Policies=relaxed, Schema=[
        {"Name": "role", "AttributeDataType": "String", "Mutable": True},
        {"Name": "badge", "AttributeDataType": "String", "Mutable": True}])["UserPool"]["Id"]
    cid = cog.create_user_pool_client(UserPoolId=pool, ClientName="c",
        ExplicitAuthFlows=["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"])["UserPoolClient"]["ClientId"]
    assert seed.seed_users(cog, pool, "1234") == 5
    assert seed.seed_users(cog, pool, "1234") == 5                # idempotent re-run
    monkeypatch.setattr(config, "USER_POOL_CLIENT_ID", cid)
    monkeypatch.setattr(config, "DEV_AUTH", False)

    ok = client.post("/api/v1/auth/login", json={"badgeNumber": " ksp-wf-4421 ", "pin": "1234"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["token"] and ok.json()["officer"]["role"] == "inspector"
    bad = client.post("/api/v1/auth/login", json={"badgeNumber": "KSP-WF-4421", "pin": "9999"})
    ghost = client.post("/api/v1/auth/login", json={"badgeNumber": "NOBODY-1", "pin": "1234"})
    assert bad.status_code == ghost.status_code == 401
    assert bad.json() == ghost.json()                             # no user enumeration


def test_login_dev_mode(client):
    ok = client.post("/api/v1/auth/login", json={"badgeNumber": "KSP-COMM-001", "pin": "1234"})
    assert ok.status_code == 200 and ok.json()["token"] == "dev-commissioner:KSP-COMM-001"
    assert client.post("/api/v1/auth/login", json={"badgeNumber": "KSP-COMM-001", "pin": "0000"}).status_code == 401
