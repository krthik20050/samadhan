"""WhatsApp webhook (Phase 11 stretch) — verify + receive, files via shared path."""
from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import PlainTextResponse

from app.core.config import get_settings
from app.services.complaints import file_complaint
from app.services.whatsapp import HELP, extract_message, parse_complaint_text, send_text

router = APIRouter()


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
    payload = await request.json()
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
        out = file_complaint(complaint)
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
