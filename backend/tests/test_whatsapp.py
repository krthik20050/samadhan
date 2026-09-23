from fastapi.testclient import TestClient

from app.main import app
from app.services.whatsapp import extract_message, parse_complaint_text

c = TestClient(app)


def test_verify_echoes_challenge():
    r = c.get("/api/v1/whatsapp/webhook", params={"hub.challenge": "CHAL"})
    assert r.text == "CHAL"


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
