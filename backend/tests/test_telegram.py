from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.telegram import extract_message
from tests.test_complaints_api import cleanup  # live-DB, self-cleaning pattern

c = TestClient(app)


def _headers():
    s = get_settings().TELEGRAM_SECRET_TOKEN
    return {"X-Telegram-Bot-Api-Secret-Token": s} if s else {}


def _post(payload):
    return c.post("/api/v1/telegram/webhook", json=payload, headers=_headers())


def test_extract_message():
    assert extract_message({"message": {"chat": {"id": 123}, "text": "  hi there  "}}) == (123, "hi there")
    assert extract_message({"edited_message": {"chat": {"id": "7"}, "text": "x" * 12}}) == (7, "x" * 12)
    assert extract_message({"message": {"chat": {}}}) == (None, None)
    assert extract_message({}) == (None, None)


def test_webhook_ignores_non_message():
    assert _post({}).json() == {"status": "ignored"}


def test_webhook_rejects_bad_secret():
    if not get_settings().TELEGRAM_SECRET_TOKEN:
        return  # ponytail: secret unset locally = auth disabled, nothing to reject.
    r = c.post("/api/v1/telegram/webhook", json={},
               headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"})
    assert r.status_code == 403


def test_start_returns_help():
    r = _post({"message": {"chat": {"id": 1}, "text": "/start"}})
    assert r.status_code == 200
    assert "CATEGORY" in r.json()["reply"]


def test_short_text_gets_help():
    r = _post({"message": {"chat": {"id": 1}, "text": "hi"}})
    assert r.json()["complaint"] is None


def test_webhook_files_complaint():
    r = _post({"message": {"chat": {"id": 999},
        "text": "overcrowding | Adoor - Ekm | Bus was severely overcrowded today"}})
    try:
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reference_id"].startswith("KSRTC-")
        assert body["reference_id"] in body["reply"]
    finally:
        cleanup(r.json()["reference_id"])
