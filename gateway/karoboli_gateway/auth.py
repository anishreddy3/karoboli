from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class SessionClaims:
    subject: str
    expires_at: int
    nonce: str


class SessionTokenError(ValueError):
    pass


def _decode_base64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        return base64.urlsafe_b64decode(value + padding)
    except Exception as exc:
        raise SessionTokenError("Malformed session token.") from exc


def verify_session_token(
    token: str,
    secret: str,
    *,
    now: int | None = None,
) -> SessionClaims:
    try:
        payload, supplied_signature = token.split(".", 1)
    except ValueError as exc:
        raise SessionTokenError("Malformed session token.") from exc

    expected_signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    ).decode().rstrip("=")
    if not hmac.compare_digest(expected_signature, supplied_signature):
        raise SessionTokenError("Invalid session signature.")

    try:
        decoded = json.loads(_decode_base64url(payload))
        subject = str(decoded["sub"])
        expires_at = int(decoded["exp"])
        nonce = str(decoded["nonce"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise SessionTokenError("Invalid session claims.") from exc

    if expires_at <= (now if now is not None else int(time.time())):
        raise SessionTokenError("Session token expired.")
    if not subject or not nonce:
        raise SessionTokenError("Invalid session claims.")
    return SessionClaims(subject=subject, expires_at=expires_at, nonce=nonce)
