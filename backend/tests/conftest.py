import os
import pathlib
import sys

os.environ.update(
    AWS_ACCESS_KEY_ID="test", AWS_SECRET_ACCESS_KEY="test",
    AWS_DEFAULT_REGION="ap-south-1", AWS_REGION="ap-south-1", DEV_AUTH="1",
)
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "seed"))

import boto3          # noqa: E402
import pytest         # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from moto import mock_aws                    # noqa: E402

import seed           # noqa: E402
from app import config, db  # noqa: E402
from app.main import app    # noqa: E402


@pytest.fixture
def aws():
    with mock_aws():
        db.reset_clients()
        ddb = boto3.resource("dynamodb")
        for name, key in ((config.CASES_TABLE, "id"), (config.ALERTS_TABLE, "id"), (config.OFFICERS_TABLE, "badgeNumber")):
            ddb.create_table(TableName=name, BillingMode="PAY_PER_REQUEST",
                             KeySchema=[{"AttributeName": key, "KeyType": "HASH"}],
                             AttributeDefinitions=[{"AttributeName": key, "AttributeType": "S"}])
        boto3.client("s3").create_bucket(
            Bucket=config.EVIDENCE_BUCKET, CreateBucketConfiguration={"LocationConstraint": "ap-south-1"})
        seed.seed_dynamo(ddb, config.CASES_TABLE, config.ALERTS_TABLE, config.OFFICERS_TABLE)
        yield ddb
        db.reset_clients()


@pytest.fixture
def client(aws):
    return TestClient(app, raise_server_exceptions=False)


def as_role(role: str) -> dict:
    return {"Authorization": f"Bearer dev-{role}"}
