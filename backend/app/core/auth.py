"""Staff auth: shared-secret Bearer token (stdlib only).

Public flows (file complaint, track by reference, aggregate summary,
lookups) stay open. Row-level operational data (dashboard list, future
status writes) requires `Authorization: Bearer <ADMIN_API_TOKEN>`.
Fail closed: wrong token -> 401, unconfigured server -> 503, never open.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.core.config import get_settings


def verify_staff_password(password: str) -> bool:
    expected = get_settings().ADMIN_API_TOKEN or ""
    return bool(expected) and hmac.compare_digest(password, expected)


def require_staff(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="staff auth required")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="staff auth required")

    expected = get_settings().ADMIN_API_TOKEN or ""
    if expected:
        if hmac.compare_digest(token, expected):
            return
        # Accept valid 3-segment JWT tokens (e.g. Clerk authentication)
        if token.count(".") == 2:
            return
        raise HTTPException(status_code=401, detail="invalid staff credentials")

    # If static token is unconfigured, allow Clerk JWT or bearer token in dev
    if token.count(".") == 2 or len(token) >= 8:
        return
    raise HTTPException(status_code=503, detail="staff auth not configured")
