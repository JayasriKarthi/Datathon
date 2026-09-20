import logging

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException

from .. import config, db
from ..auth import Principal, current_principal
from ..pin import cognito_password
from ..schemas import LoginBody

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("/auth/login")
def login(body: LoginBody):
    badge = body.badgeNumber.strip().upper()
    generic = HTTPException(401, "Invalid badge number or PIN")

    if config.DEV_AUTH and not config.USER_POOL_CLIENT_ID:  # local dev only
        officer = db.get_officer(badge)
        if not officer or body.pin != config.DEV_PIN:
            raise generic
        return {"token": f"dev-{officer['role']}:{officer['badgeNumber']}", "refreshToken": None, "expiresIn": 3600, "officer": officer}

    try:
        resp = boto3.client("cognito-idp").initiate_auth(
            ClientId=config.USER_POOL_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": badge, "PASSWORD": cognito_password(badge, body.pin)},
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("NotAuthorizedException", "UserNotFoundException"):
            raise generic
        if code == "TooManyRequestsException":
            raise HTTPException(429, "Too many attempts. Try again shortly.")
        log.exception("Cognito login failed")
        raise HTTPException(502, "Authentication service unavailable")

    result = resp.get("AuthenticationResult")
    if not result:  # e.g. an unexpected challenge
        raise generic
    officer = db.get_officer(badge)
    if not officer:
        raise HTTPException(403, "No officer profile exists for this account")
    return {
        "token": result["IdToken"],
        "refreshToken": result.get("RefreshToken"),
        "expiresIn": result["ExpiresIn"],
        "officer": officer,
    }


@router.get("/me")
def me(principal: Principal = Depends(current_principal)):
    officer = db.get_officer(principal.badge)
    if not officer:
        raise HTTPException(404, "Officer profile not found")
    return officer
