#!/usr/bin/env python3
"""Load the prototype's mock data into DynamoDB and create Cognito officer accounts.

  python seed/seed.py --stack-name crimesphere --region ap-south-1
  python seed/seed.py --stack-name crimesphere --region ap-south-1 --pin 482913

Officers sign in with their badge number + PIN (default 1234, matching the login
screen). It is synthetic demo data; pick a different --pin (and/or delete the stack)
once judging is over.
"""
import argparse
import json
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import boto3

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "src"))
from app.db import to_dynamo          # noqa: E402
from app.pin import cognito_password  # noqa: E402


def _load(name: str):
    return json.loads((ROOT / "data" / f"{name}.json").read_text(encoding="utf-8"))


def seed_dynamo(ddb, cases_table: str, alerts_table: str, officers_table: str) -> dict:
    cases = _load("MOCK_CASES")
    base = datetime(2026, 7, 8, tzinfo=timezone.utc)
    for i, case in enumerate(cases):  # list order = newest first, so the UI keeps its order
        case["createdAt"] = (base - timedelta(minutes=i)).isoformat()
    alerts = _load("MOCK_ALERTS")
    officers = []
    for acct in _load("MOCK_ROLE_ACCOUNTS").values():
        acct["badgeNumber"] = acct["badgeNumber"].upper()
        officers.append(acct)

    for table_name, items in ((cases_table, cases), (alerts_table, alerts), (officers_table, officers)):
        with ddb.Table(table_name).batch_writer() as batch:
            for item in items:
                batch.put_item(Item=to_dynamo(item))
    return {"cases": len(cases), "alerts": len(alerts), "officers": len(officers)}


def seed_users(cognito, pool_id: str, pin: str) -> int:
    officers = list(_load("MOCK_ROLE_ACCOUNTS").values())
    for o in officers:
        username = o["badgeNumber"].upper()
        try:
            cognito.admin_create_user(
                UserPoolId=pool_id, Username=username, MessageAction="SUPPRESS",
                UserAttributes=[
                    {"Name": "custom:role", "Value": o["role"]},
                    {"Name": "custom:badge", "Value": username},
                ],
            )
        except cognito.exceptions.UsernameExistsException:
            # re-running is safe: refresh the role attribute; password is reset below
            cognito.admin_update_user_attributes(
                UserPoolId=pool_id, Username=username,
                UserAttributes=[{"Name": "custom:role", "Value": o["role"]}],
            )
        cognito.admin_set_user_password(
            UserPoolId=pool_id, Username=username,
            Password=cognito_password(username, pin), Permanent=True,
        )
    return len(officers)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stack-name", default="crimesphere")
    ap.add_argument("--region", required=True)
    ap.add_argument("--pin", default="1234", help="PIN for all demo officers (4-12 chars)")
    ap.add_argument("--skip-users", action="store_true", help="only load DynamoDB (e.g. local dev)")
    ap.add_argument("--cases-table"); ap.add_argument("--alerts-table")
    ap.add_argument("--officers-table"); ap.add_argument("--user-pool-id")
    args = ap.parse_args()

    session = boto3.Session(region_name=args.region)
    if not (args.cases_table and args.alerts_table and args.officers_table):
        stack = session.client("cloudformation").describe_stacks(StackName=args.stack_name)["Stacks"][0]
        out = {o["OutputKey"]: o["OutputValue"] for o in stack.get("Outputs", [])}
        args.cases_table = args.cases_table or out["CasesTable"]
        args.alerts_table = args.alerts_table or out["AlertsTable"]
        args.officers_table = args.officers_table or out["OfficersTable"]
        args.user_pool_id = args.user_pool_id or out.get("UserPoolId")

    counts = seed_dynamo(session.resource("dynamodb"), args.cases_table, args.alerts_table, args.officers_table)
    print(f"DynamoDB seeded: {counts}")
    if not args.skip_users:
        if not args.user_pool_id:
            sys.exit("No user pool id found; pass --user-pool-id or --skip-users")
        n = seed_users(session.client("cognito-idp"), args.user_pool_id, args.pin)
        print(f"Cognito: {n} officer accounts ready (PIN: {args.pin})")
        for o in _load("MOCK_ROLE_ACCOUNTS").values():
            print(f"   {o['role']:<15} badge {o['badgeNumber']}")


if __name__ == "__main__":
    main()
