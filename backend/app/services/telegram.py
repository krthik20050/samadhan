"""Telegram Bot API adapter — parse inbound, best-effort reply.

Core rule (docs/ARCHITECTURE.md): adapter only. It builds the same
ComplaintCreate the web form posts; DB insert happens in file_complaint,
not here. Parsing reuses the WhatsApp adapter so both channels stay in sync.
"""
from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.services.whatsapp import HELP, parse_complaint_text  # noqa: F401 (re-export)

__all__ = ["HELP", "extract_message", "parse_complaint_text", "send_text"]


def extract_message(payload: dict) -> tuple[int | None, str | None]:
    """Pull (chat_id, text) from a Bot API Update. Returns (None, None) if unusable."""
    try:
        msg = payload.get("message") or payload.get("edited_message") or {}
        chat_id = (msg.get("chat") or {}).get("id")
        text = (msg.get("text") or "").strip() or None
        if chat_id is None:
            return None, None
        return int(chat_id), text
    except (AttributeError, TypeError, ValueError):
        return None, None


def send_text(chat_id: int, body: str) -> dict:
    s = get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return {"skipped": "no Telegram credentials"}
    r = httpx.post(
        f"https://api.telegram.org/bot{s.TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": chat_id, "text": body},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()
