"""WhatsApp webhook (Phase 11 stretch) — guided flow + legacy pipe format.

Dispatch order per message: guided flow (buttons/lists, in-memory state, see
app/services/whatsapp_flow.py) -> legacy pipe-format / bare-text auto-file
(chat twinning with the Telegram bot: cat | route | desc still works, and bare
text of 10+ chars gets a guessed category) -> HELP when nothing fits.

Security: POST /webhook verifies Meta's X-Hub-Signature-256 HMAC over the raw
body when WHATSAPP_APP_SECRET is configured, and fails closed — a request
without a valid signature is rejected with 403 (AUDIT.md C-2).
"""
from __future__ import annotations

import hashlib
import hmac

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.services.complaints import file_complaint
from app.services.whatsapp import HELP, extract_message, parse_complaint_text, send_text
from app.services import whatsapp_flow

router = APIRouter()


def _signature_valid(secret: str, raw_body: bytes, header: str | None) -> bool:
    """Meta signs the raw body: 'sha256=' + HMAC-SHA256(secret, body) hex."""
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:].lower())


@router.get("/webhook")
def verify(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    expected = get_settings().WHATSAPP_VERIFY_TOKEN
    # ponytail: no token set = accept any (local demo); set VERIFY_TOKEN in prod.
    if expected and hub_verify_token != expected:
        return Response(status_code=403, content="verify token mismatch")
    return PlainTextResponse(hub_challenge)


@router.post("/webhook")
async def receive(request: Request):
    raw = await request.body()
    secret = get_settings().WHATSAPP_APP_SECRET
    # Fail closed when the secret is configured; the signature must match the
    # exact bytes Meta signed (never re-serialize the parsed JSON).
    if secret and not _signature_valid(secret, raw, request.headers.get("X-Hub-Signature-256")):
        return Response(status_code=403, content="invalid signature")
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    # Guided flow first: interactive replies, greetings, in-flight conversations.
    flow_result = whatsapp_flow.handle_update(payload)
    if flow_result is not None:
        return flow_result

    sender, text = extract_message(payload)
    if not sender or not text:
        return {"status": "ignored"}
    complaint = parse_complaint_text(text)
    if complaint is None:
        try:  # ponytail: reply is best-effort, never fail the webhook on send error.
            send_result = send_text(sender, HELP)
        except Exception as exc:  # noqa: BLE001
            send_result = {"error": str(exc)}
        return {"status": "ok", "reply": HELP, "complaint": None, "send": send_result}
    complaint.contact_phone = complaint.contact_phone or sender
    try:
        out = file_complaint(complaint, source_channel="whatsapp")
    except ValueError as e:
        reply = f"Couldn't file it: {e}. {HELP}"
        try:
            send_result = send_text(sender, reply)
        except Exception as exc:  # noqa: BLE001
            send_result = {"error": str(exc)}
        return {"status": "ok", "reply": reply,
                "complaint": complaint.model_dump(mode="json"), "send": send_result}
    except Exception:
        reply = "Sorry, filing failed — please use the web form at /complain."
        try:
            send_result = send_text(sender, reply)
        except Exception as exc:  # noqa: BLE001
            send_result = {"error": str(exc)}
        return {"status": "ok", "reply": reply,
                "complaint": complaint.model_dump(mode="json"), "send": send_result}
    reply = (
        f"Filed {out.reference_id} ({out.status}"
        f"{', depot: ' + out.depot if out.depot else ''}). "
        "Track it at /track with your reference ID."
    )
    try:  # ponytail: reply is best-effort, never fail the webhook on send error.
        send_result = send_text(sender, reply)
    except Exception as exc:  # noqa: BLE001
        send_result = {"error": str(exc)}
    return {
        "status": "ok",
        "reply": reply,
        "reference_id": out.reference_id,
        "complaint": complaint.model_dump(mode="json"),
        "send": send_result,
    }
