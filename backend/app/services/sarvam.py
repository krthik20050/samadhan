"""Sarvam AI speech-to-text adapter (REST, saaras:v3)."""
from __future__ import annotations

import httpx

from app.core.config import get_settings

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
MAX_BYTES = 8 * 1024 * 1024  # ~30s compressed webm


class SarvamNotConfigured(Exception):
    pass


class SarvamTranscriptionError(Exception):
    pass


def transcribe_bytes(
    content: bytes,
    *,
    filename: str = "recording.webm",
    language_code: str = "unknown",
) -> dict:
    """Return Sarvam JSON (at least transcript + language_code)."""
    key = get_settings().SARVAM_API_KEY
    if not key:
        raise SarvamNotConfigured("SARVAM_API_KEY not set")
    if len(content) > MAX_BYTES:
        raise SarvamTranscriptionError("audio too large (max ~30s)")
    if not content:
        raise SarvamTranscriptionError("empty audio")

    files = {"file": (filename, content, "application/octet-stream")}
    data = {
        "model": "saaras:v3",
        "mode": "transcribe",
        "language_code": language_code or "unknown",
    }
    try:
        r = httpx.post(
            SARVAM_STT_URL,
            headers={"api-subscription-key": key},
            data=data,
            files=files,
            timeout=45.0,
        )
        r.raise_for_status()
        body = r.json()
    except httpx.HTTPStatusError as exc:
        raise SarvamTranscriptionError(f"Sarvam HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise SarvamTranscriptionError("Sarvam request failed") from exc

    transcript = (body.get("transcript") or "").strip()
    if not transcript:
        raise SarvamTranscriptionError("empty transcript")
    return body
