"""WhatsApp Cloud API adapter — parse inbound, best-effort reply.

Core rule (docs/ARCHITECTURE.md): adapter only. It builds the same
ComplaintCreate the web form posts; DB insert happens in POST /complaints
(Phase 3), not here.
"""
from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.schemas.complaint import Category, ComplaintCreate

HELP = (
    "Send: CATEGORY | route | description (min 10 chars). "
    "Categories: cleanliness, unsafe_driving, overcrowding, missed_stop, "
    "concession_denied, ticketing, staff_behaviour, bus_condition, other."
)

# ponytail: keyword guess, replace with LLM extraction (Phase 10) if it misfires.
_KEYWORDS: tuple[tuple[Category, tuple[str, ...]], ...] = (
    (Category.cleanliness, ("dirty", "clean", "garbage", "smell")),
    (Category.unsafe_driving, ("rash", "speed", "unsafe", "accident", "brake")),
    (Category.overcrowding, ("crowd", "full", "overcrowd", "standing")),
    (Category.missed_stop, ("miss", "skip", "stop")),
    (Category.concession_denied, ("concession", "student", "denied")),
    (Category.ticketing, ("ticket", "fare", "change")),
    (Category.staff_behaviour, ("rude", "staff", "driver", "conductor", "behav")),
    (Category.bus_condition, ("break", "bus condition", "seat", "window", "door")),
)


def guess_category(text: str) -> Category:
    low = text.lower()
    for cat, words in _KEYWORDS:
        if any(w in low for w in words):
            return cat
    return Category.other


def extract_message(payload: dict) -> tuple[str | None, str | None]:
    """Pull (from_phone, text) from a Cloud API webhook payload."""
    try:
        value = payload["entry"][0]["changes"][0]["value"]
        msg = value["messages"][0]
        if msg.get("type") != "text":
            return msg.get("from"), None
        return msg.get("from"), (msg.get("text") or {}).get("body", "").strip() or None
    except (KeyError, IndexError, TypeError, AttributeError):
        return None, None


def parse_complaint_text(text: str) -> ComplaintCreate | None:
    """'cat | route | desc' -> ComplaintCreate; bare text -> other/WhatsApp."""
    parts = [p.strip() for p in text.split("|")]
    if len(parts) == 3:
        cat_raw, route, desc = parts
        try:
            cat = Category(cat_raw.lower().replace(" ", "_"))
        except ValueError:
            cat = guess_category(text)
        route_text = route or "WhatsApp"
        description = desc
    else:
        cat, route_text, description = guess_category(text), "WhatsApp", text
    if len(description) < 10:
        return None
    return ComplaintCreate(category=cat, route_text=route_text, description=description)


def send_text(to: str, body: str) -> dict:
    s = get_settings()
    if not s.WHATSAPP_ACCESS_TOKEN or not s.WHATSAPP_PHONE_NUMBER_ID:
        return {"skipped": "no WhatsApp credentials"}
    r = httpx.post(
        f"https://graph.facebook.com/v22.0/{s.WHATSAPP_PHONE_NUMBER_ID}/messages",
        headers={"Authorization": f"Bearer {s.WHATSAPP_ACCESS_TOKEN}"},
        json={"messaging_product": "whatsapp", "to": to, "text": {"body": body}},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()
