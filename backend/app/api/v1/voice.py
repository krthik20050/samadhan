"""Voice intake — audio upload → Sarvam STT → transcript for the complaint form."""
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.services import sarvam
from app.services.sarvam import (
    SarvamNotConfigured,
    SarvamTranscriptionError,
)

router = APIRouter()


@router.get("/status")
def voice_status():
    from app.core.config import get_settings

    return {"available": bool(get_settings().SARVAM_API_KEY)}


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language_code: str = Form("unknown"),
):
    raw = await file.read()
    name = file.filename or "recording.webm"
    try:
        body = sarvam.transcribe_bytes(raw, filename=name, language_code=language_code)
    except SarvamNotConfigured:
        return JSONResponse({"detail": "voice transcription not configured"}, status_code=503)
    except SarvamTranscriptionError as exc:
        return JSONResponse({"detail": str(exc)}, status_code=422)
    return {
        "transcript": body.get("transcript", "").strip(),
        "language_code": body.get("language_code"),
        "request_id": body.get("request_id"),
    }
