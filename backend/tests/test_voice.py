from fastapi.testclient import TestClient

from app.main import app
from app.services import sarvam

c = TestClient(app)


def test_voice_status_without_key(monkeypatch):
    monkeypatch.setattr(sarvam.get_settings().__class__, "SARVAM_API_KEY", None)
    # Settings are cached — patch the service check instead
    from app.core import config

    config.get_settings.cache_clear()
    monkeypatch.setenv("SARVAM_API_KEY", "")
    config.get_settings.cache_clear()
    r = c.get("/api/v1/voice/status")
    assert r.status_code == 200
    assert r.json()["available"] is False
    config.get_settings.cache_clear()


def test_transcribe_503_without_key(monkeypatch):
    from app.core import config

    config.get_settings.cache_clear()
    monkeypatch.setenv("SARVAM_API_KEY", "")
    config.get_settings.cache_clear()
    r = c.post(
        "/api/v1/voice/transcribe",
        files={"file": ("t.webm", b"\x00\x01", "audio/webm")},
        data={"language_code": "unknown"},
    )
    assert r.status_code == 503
    config.get_settings.cache_clear()


def test_transcribe_returns_transcript(monkeypatch):
    def fake(_content, *, filename="x", language_code="unknown"):
        return {"transcript": "Bus from Palakkad to Thrissur was very late today morning", "language_code": "en-IN"}

    monkeypatch.setattr(sarvam, "transcribe_bytes", fake)
    r = c.post(
        "/api/v1/voice/transcribe",
        files={"file": ("t.webm", b"fakeaudio", "audio/webm")},
        data={"language_code": "en-IN"},
    )
    assert r.status_code == 200
    assert "Palakkad" in r.json()["transcript"]
