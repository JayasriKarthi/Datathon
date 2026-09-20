"""Identifies the caller.

In AWS, API Gateway's JWT authorizer has already verified the Cognito token's
signature, expiry, issuer and audience before Lambda runs; we only read the
verified claims it forwards. In local dev (DEV_AUTH=1) a header of the form
`Authorization: Bearer dev-<role>` stands in for a token."""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

from . import config
from .rbac import ROLE_HIERARCHY, has_permission


@dataclass
class Principal:
    badge: str
    role: str


def _jwt_claims(request: Request) -> dict | None:
    event = request.scope.get("aws.event") or {}
    return (event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}) or {}).get("claims")


def current_principal(request: Request) -> Principal:
    claims = _jwt_claims(request)
    if claims:
        role = claims.get("custom:role")
        if role not in ROLE_HIERARCHY:
            raise HTTPException(403, "Account has no valid role assigned")
        badge = claims.get("custom:badge") or claims.get("cognito:username") or "unknown"
        return Principal(badge=badge, role=role)

    if config.DEV_AUTH:
        header = request.headers.get("authorization", "")
        if header.startswith("Bearer dev-"):
            role, _, badge = header.removeprefix("Bearer dev-").partition(":")   # dev-<role>[:<badge>]
            if role in ROLE_HIERARCHY:
                return Principal(badge=badge or f"DEV-{role.upper()}", role=role)

    raise HTTPException(401, "Authentication required")


def require(permission: str):
    """Dependency factory: `Depends(require("GENERATE_FIR"))`."""
    def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if not has_permission(principal.role, permission):
            raise HTTPException(403, f"Your role is not permitted to do this ({permission})")
        return principal
    return dependency
