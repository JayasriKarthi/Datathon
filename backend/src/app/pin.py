def cognito_password(badge: str, pin: str) -> str:
    """Cognito enforces a minimum length of 6 but the app's PIN is 4-6 digits, so the
    Cognito password is derived from PIN + badge. Used by both the login route and
    seed/seed.py so they can never disagree."""
    return f"{pin}@{badge.upper()}"
