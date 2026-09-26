"""Telegram webhook — receive Bot API Updates, file complaints, track by ref."""
from fastapi import APIRouter, Header, Request, Response

from app.core.config import get_settings
from app.core.db import get_conn
from app.services.complaints import file_complaint
from app.services.telegram import HELP, extract_message, parse_complaint_text, send_text

router = APIRouter()


def _send(chat_id: int, body: str) -> dict:
    try:  # ponytail: reply is best-effort, never fail the webhook on send error.
        return send_text(chat_id, body)
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def _track_reply(ref: str) -> str:
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT status, sla_breached FROM complaints WHERE reference_id = %s",
                (ref.strip().upper(),),
            )
            row = cur.fetchone()
        if row is None:
            return f"Unknown ID {ref.strip().upper()} — check and retry."
        return f"{ref.strip().upper()}: {dict(row)['status']}."
    except Exception:  # noqa: BLE001
        return "Tracking failed — try the web /track page."


@router.get("/webhook")
def webhook_info():
    return {"status": "ok"} if get_settings().TELEGRAM_BOT_TOKEN else {"status": "no-token"}


@router.post("/webhook")
async def receive(
    request: Request,
    secret: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
):
    expected = get_settings().TELEGRAM_SECRET_TOKEN
    # ponytail: no secret set = accept any (local demo); set SECRET_TOKEN on setWebhook in prod.
    if expected and secret != expected:
        return Response(status_code=403, content="secret token mismatch")
    payload = await request.json()
    chat_id, text = extract_message(payload)
    if chat_id is None or not text:
        return {"status": "ignored"}
    low = text.strip().lower()
    if low in ("/start", "/help"):
        return {"status": "ok", "reply": HELP, "send": _send(chat_id, HELP)}
    if low.startswith("/track"):
        ref = text[6:].strip()
        reply = _track_reply(ref) if ref else "Send: /track SAM-2026-000123"
        return {"status": "ok", "reply": reply, "send": _send(chat_id, reply)}
    complaint = parse_complaint_text(text)
    if complaint is None:
        return {"status": "ok", "reply": HELP, "complaint": None,
                "send": _send(chat_id, HELP)}
    # ponytail: Telegram chat_id is not a phone; leave contact_phone NULL (DB check).
    try:
        out = file_complaint(complaint, source_channel="telegram", actor_id=str(chat_id))
    except Exception:  # noqa: BLE001
        reply = "Sorry, filing failed — please use the web form at /complain."
        return {"status": "ok", "reply": reply,
                "complaint": complaint.model_dump(mode="json"), "send": _send(chat_id, reply)}
    reply = (
        f"Filed {out.reference_id} ({out.status}"
        f"{', depot: ' + out.depot if out.depot else ''}). "
        "Track with /track <ID>."
    )
    return {
        "status": "ok",
        "reply": reply,
        "reference_id": out.reference_id,
        "complaint": complaint.model_dump(mode="json"),
        "send": _send(chat_id, reply),
    }
