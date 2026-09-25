"""WhatsApp webhook security (AUDIT.md C-2) — HMAC signature enforcement."""
import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

c = TestClient(app)

SECRET = "test-app-secret"
BODY = json.dumps({"entry": [{"changes": [{"value": {}}]}]}).encode()


def _sig(body: bytes, secret: str = SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _post(body: bytes, signature: str | None):
    headers = {"Content-Type": "application/json"}
    if signature is not None:
        headers["X-Hub-Signature-256"] = signature
    return c.post("/api/v1/whatsapp/webhook", content=body, headers=headers)


def test_valid_signature_accepted(monkeypatch):
    monkeypatch.setattr(get_settings(), "WHATSAPP_APP_SECRET", SECRET)
    r = _post(BODY, _sig(BODY))
    assert r.status_code == 200


def test_invalid_signature_rejected(monkeypatch):
    monkeypatch.setattr(get_settings(), "WHATSAPP_APP_SECRET", SECRET)
    r = _post(BODY, "sha256=" + "0" * 64)
    assert r.status_code == 403


def test_missing_signature_rejected_when_secret_set(monkeypatch):
    monkeypatch.setattr(get_settings(), "WHATSAPP_APP_SECRET", SECRET)
    r = _post(BODY, None)
    assert r.status_code == 403


def test_signature_from_different_secret_rejected(monkeypatch):
    monkeypatch.setattr(get_settings(), "WHATSAPP_APP_SECRET", SECRET)
    r = _post(BODY, _sig(BODY, secret="attacker-secret"))
    assert r.status_code == 403


def test_unsigned_accepted_only_without_secret(monkeypatch):
    # Local/demo mode (no APP_SECRET configured) keeps working — the docstring
    # and .env.example document that any deployed env MUST set the secret.
    monkeypatch.setattr(get_settings(), "WHATSAPP_APP_SECRET", None)
    r = _post(BODY, None)
    assert r.status_code == 200
