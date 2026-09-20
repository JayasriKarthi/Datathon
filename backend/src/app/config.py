"""Runtime configuration. Everything comes from environment variables that
template.yaml sets on the Lambda function."""
import os
from datetime import datetime, timedelta, timezone

CASES_TABLE = os.environ.get("CASES_TABLE", "crimesphere-cases")
ALERTS_TABLE = os.environ.get("ALERTS_TABLE", "crimesphere-alerts")
OFFICERS_TABLE = os.environ.get("OFFICERS_TABLE", "crimesphere-officers")
EVIDENCE_BUCKET = os.environ.get("EVIDENCE_BUCKET", "crimesphere-evidence")
USER_POOL_CLIENT_ID = os.environ.get("USER_POOL_CLIENT_ID", "")

# Bedrock can live in a different region from the rest of the stack, because model
# availability varies by region. Model id MUST be set to one enabled in your account.
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")

IN_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
# Local-development shortcut (no Cognito). Hard-disabled inside Lambda so it can
# never be switched on in the deployed stack.
DEV_AUTH = os.environ.get("DEV_AUTH") == "1" and not IN_LAMBDA
DEV_PIN = os.environ.get("DEV_PIN", "1234")

MAX_EVIDENCE_BYTES = 25 * 1024 * 1024
ALLOWED_EVIDENCE_TYPES = {
    "image/jpeg", "image/png", "image/webp",
    "video/mp4", "audio/mpeg", "audio/mp4", "audio/wav",
    "application/pdf", "text/plain",
}

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    return datetime.now(IST)
