from fastapi.testclient import TestClient

from app.main import app
from app.core.config import get_settings
from app.services.whatsapp import extract_message, parse_complaint_text
from tests.test_complaints_api import cleanup  # live-DB, self-cleaning pattern

c = TestClient(app)


def test_verify_echoes_challenge():
    # Meta always sends hub.verify_token; mirror the real handshake.
    token = get_settings().WHATSAPP_VERIFY_TOKEN or ""
    r = c.get("/api/v1/whatsapp/webhook",
              params={"hub.verify_token": token, "hub.challenge": "CHAL"})
    assert r.text == "CHAL"


def test_verify_rejects_wrong_token():
    r = c.get("/api/v1/whatsapp/webhook",
              params={"hub.verify_token": "wrong", "hub.challenge": "CHAL"})
    assert r.status_code == 403


def test_parse_pipe_format():
    p = parse_complaint_text("overcrowding | Adoor - Ekm | Bus was severely overcrowded today")
    assert (p.category.value, p.route_text) == ("overcrowding", "Adoor - Ekm")


def test_short_text_needs_more_info():
    assert parse_complaint_text("hi") is None


def test_webhook_ignores_non_message():
    r = c.post("/api/v1/whatsapp/webhook", json={"entry": [{"changes": [{"value": {}}]}]})
    assert r.json() == {"status": "ignored"}


def test_extract_message():
    payload = {"entry": [{"changes": [{"value": {"messages": [
        {"from": "91999", "type": "text", "text": {"body": "hello world here"}}]}}]}]}
    assert extract_message(payload) == ("91999", "hello world here")


def _wa_payload(sender: str, body: str):
    return {"entry": [{"changes": [{"value": {"messages": [
        {"from": sender, "type": "text", "text": {"body": body}}]}}]}]}


def test_webhook_files_complaint():
    r = c.post("/api/v1/whatsapp/webhook", json=_wa_payload(
        "919999999999", "overcrowding | Adoor - Ekm | Bus was severely overcrowded today"))
    try:
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "ok"
        assert body["reference_id"].startswith("KSRTC-")
        assert body["reference_id"] in body["reply"]
    finally:
        cleanup(r.json()["reference_id"])


def test_webhook_unknown_route_needs_triage():
    r = c.post("/api/v1/whatsapp/webhook", json=_wa_payload(
        "919999999999", "cleanliness | No Such Route XYZ | This bus was very dirty today indeed"))
    try:
        assert r.status_code == 200, r.text
        assert "needs_triage" in r.json()["reply"]
    finally:
        cleanup(r.json()["reference_id"])


def test_webhook_garbage_gets_help():
    # Non-greeting garbage ("hi" now opens the guided menu instead).
    r = c.post("/api/v1/whatsapp/webhook", json=_wa_payload("91999", "ok"))
    assert r.status_code == 200
    assert r.json()["complaint"] is None
    assert "CATEGORY" in r.json()["reply"]


def test_webhook_greeting_opens_menu():
    from app.services import whatsapp_flow

    whatsapp_flow.reset_conversations()
    r = c.post("/api/v1/whatsapp/webhook", json=_wa_payload("91999", "hi"))
    assert r.status_code == 200
    body = r.json()
    assert body["flow"] == "menu"
    assert body["complaint"] is None if "complaint" in body else True
    whatsapp_flow.reset_conversations()
