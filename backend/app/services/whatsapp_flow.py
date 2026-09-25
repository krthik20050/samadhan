"""Guided WhatsApp complaint flow — the Telegram /complain twin, local dev.

Cloud API interactive messages (button + list replies) drive a one-question-
at-a-time flow: category -> route suggestions from the dataset -> description
-> confirm -> file via the shared file_complaint() pipeline. Same contract the
Edge Function serves for Telegram (supabase/functions/api), minus ticket-photo
extraction and evidence uploads, which are Edge-Function/Storage features.

Conversation state is in-memory on purpose for the hackathon demo: FastAPI is
one long-lived local process, so a dict survives across webhook calls and the
Supabase DB stays clean. Persistence upgrade path (if this ever goes hosted):
mirror database/migrations/006_telegram_flow.sql with a whatsapp_conversations
table + tg_conv_* style RPCs, and swap the four _get/_save/_clear/_claim helpers.

Interactive send helpers degrade to plain text when WHATSAPP_* creds are
missing/expired — the webhook response still carries `reply`, so the whole
flow is testable with no working outbound token.
"""
from __future__ import annotations

import re

import httpx

from app.core.config import get_settings
from app.core.db import get_conn
from app.schemas.complaint import Category, ComplaintCreate
from app.services.complaints import file_complaint
from app.services.whatsapp import send_text as wa_send_text

GRAPH = "https://graph.facebook.com/v22.0"

# Labels mirror the Edge Function's CATEGORIES so both channels read alike.
CATEGORIES: list[tuple[str, str]] = [
    ("cleanliness", "🧹 Cleanliness"),
    ("unsafe_driving", "⚠️ Unsafe driving"),
    ("overcrowding", "👥 Overcrowding"),
    ("missed_stop", "🛑 Missed stop"),
    ("concession_denied", "🎓 Concession denied"),
    ("ticketing", "🎫 Ticketing"),
    ("staff_behaviour", "🧑‍✈️ Staff behaviour"),
    ("bus_condition", "🚌 Bus condition"),
    ("other", "📝 Other"),
]
CATEGORY_LABELS = dict(CATEGORIES)

MENU_TEXT = (
    "🚌 SAMADHAN on WhatsApp — file a KSRTC complaint in under a minute.\n\n"
    "Tap *File a complaint* to start, or just send:\n"
    "category | route | description"
)

# Greetings that open the menu instead of the legacy auto-file path.
_GREETINGS = {"hi", "hello", "hey", "menu", "start", "/start", "help"}

# Every flow screen offers Cancel; a stray tap must not destroy the draft
# (AUDIT.md §30). confirm/creating states keep their own handling.
_CONFIRM_CANCEL_KB = [("cancel:confirm", "Yes, cancel it"), ("back", "Continue editing")]


def _cancel_guard(phone: str, data: dict) -> dict:
    """Two-step cancel: ask before discarding an in-flight complaint draft."""
    _save(phone, "cancel_confirm", data)
    body = "Are you sure you want to cancel?\n\nYour current complaint draft will be discarded."
    return {"status": "ok", "flow": "cancel_confirm", "reply": body,
            "send": send_buttons(phone, body, _CONFIRM_CANCEL_KB)}


# ---------------------------------------------------------------------------
# Conversation store (in-memory; see module docstring)
# ---------------------------------------------------------------------------
_conversations: dict[str, dict] = {}


def reset_conversations() -> None:
    """Test/demo hook: forget all in-flight conversations."""
    _conversations.clear()


def _get(phone: str) -> dict:
    return _conversations.setdefault(phone, {"state": "idle", "data": {}})


def _save(phone: str, state: str, data: dict) -> None:
    _conversations[phone] = {"state": state, "data": data}


def _clear(phone: str) -> None:
    _save(phone, "idle", {})


# ---------------------------------------------------------------------------
# Outbound helpers (best-effort, same policy as the legacy webhook replies)
# ---------------------------------------------------------------------------
def send_buttons(to: str, body: str, buttons: list[tuple[str, str]]) -> dict:
    """Cloud API interactive buttons (max 3, title <= 20 chars)."""
    s = get_settings()
    if not s.WHATSAPP_ACCESS_TOKEN or not s.WHATSAPP_PHONE_NUMBER_ID:
        return {"skipped": "no WhatsApp credentials"}
    try:
        r = httpx.post(
            f"{GRAPH}/{s.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {s.WHATSAPP_ACCESS_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": body},
                    "action": {
                        "buttons": [
                            {"type": "reply", "reply": {"id": bid, "title": title[:20]}}
                            for bid, title in buttons[:3]
                        ]
                    },
                },
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"{e.response.status_code} {e.response.text[:120]}"}
    except Exception as e:  # noqa: BLE001 — never fail the webhook on a send error
        return {"error": str(e)}


def send_list(to: str, body: str, button_title: str,
              rows: list[tuple[str, str, str | None]]) -> dict:
    """Cloud API list message (up to 10 rows) — used for 9 categories + routes."""
    s = get_settings()
    if not s.WHATSAPP_ACCESS_TOKEN or not s.WHATSAPP_PHONE_NUMBER_ID:
        return {"skipped": "no WhatsApp credentials"}
    try:
        r = httpx.post(
            f"{GRAPH}/{s.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {s.WHATSAPP_ACCESS_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "interactive",
                "interactive": {
                    "type": "list",
                    "body": {"text": body},
                    "action": {
                        "button": button_title[:20],
                        "sections": [{
                            "title": "Options",
                            "rows": [
                                {"id": rid, "title": title[:24],
                                 **({"description": desc[:60]} if desc else {})}
                                for rid, title, desc in rows[:10]
                            ],
                        }],
                    },
                },
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"{e.response.status_code} {e.response.text[:120]}"}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Route suggestions — same dataset chain as GET /api/v1/routes (lookups.py)
# ---------------------------------------------------------------------------
def find_routes(q: str, limit: int = 5) -> list[dict]:
    """Route suggestions via the same canonical pipeline as filing — the
    app_list_routes RPC (OD-phrase aware, alias-resolved, dataset-backed).
    Mirrors the Edge Function's suggestRoutes for Telegram."""
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT app_list_routes(%s, %s)", ((q or "").strip(), limit))
            row = cur.fetchone()
            items = ((row or {}).get("app_list_routes") or {}).get("items", [])
            return [{"id": str(i["id"]), "name": i["name"], "depot": i.get("depot_name")}
                    for i in items if i.get("name")]
    except Exception:  # noqa: BLE001 — suggestions are best-effort, never fatal
        return []


# ---------------------------------------------------------------------------
# Screens
# ---------------------------------------------------------------------------
def _menu(phone: str) -> dict:
    _save(phone, "menu", {})
    reply = send_buttons(phone, MENU_TEXT,
                         [("flow:start", "🚨 File a complaint"),
                          ("help", "❓ Help")])
    return {"status": "ok", "flow": "menu", "reply": MENU_TEXT, "send": reply}


def _help(phone: str) -> dict:
    body = (
        "*(1)* Tap File a complaint and answer step by step.\n"
        "*(2)* Or send: category | route | description\n\n"
        "Example: overcrowding | Adoor - Ernakulam | Bus was packed, my stop was skipped"
    )
    return {"status": "ok", "flow": "help", "reply": body,
            "send": send_buttons(phone, body, [("flow:start", "🚨 File a complaint")])}


def _ask_category(phone: str, data: dict) -> dict:
    _save(phone, "ask_category", data)
    body = "What is the complaint about?"
    reply = send_list(phone, body, "Choose category",
                      [(f"cat:{v}", label, None) for v, label in CATEGORIES])
    return {"status": "ok", "flow": "ask_category", "reply": body, "send": reply}


def _ask_route(phone: str, data: dict) -> dict:
    _save(phone, "ask_route", data)
    body = ("Which route? Send start and destination (e.g. *Adoor to Ernakulam*) "
            "— I'll suggest matching KSRTC routes.")
    reply = send_buttons(phone, body, [("route:skip", "⏭️ Skip route"),
                                       ("cancel", "❌ Cancel")])
    return {"status": "ok", "flow": "ask_route", "reply": body, "send": reply}


def _suggest_routes(phone: str, text: str, data: dict) -> dict:
    hits = find_routes(text)
    _save(phone, "pick_route", {**data, "route_text": text})
    if hits:
        body = "Tap the exact route, or use your text as-is:"
    else:
        body = "No close match in the KSRTC dataset — you can still file it with your text."
    rows = [(f"route:{h['id']}", h["name"], h.get("depot") or None) for h in hits]
    rows.append(("route:raw", f'✅ Use my text: "{text[:22]}"', None))
    rows.append(("route:skip", "⏭️ File without route", None))
    reply = send_list(phone, body, "Choose route", rows)
    return {"status": "ok", "flow": "pick_route", "reply": body, "send": reply,
            "suggestions": [h["name"] for h in hits]}


def _ask_description(phone: str, data: dict) -> dict:
    _save(phone, "ask_description", data)
    body = "🎙️ Now describe the problem (min 10 characters)."
    reply = send_buttons(phone, body, [("cancel", "❌ Cancel")])
    return {"status": "ok", "flow": "ask_description", "reply": body, "send": reply}


def _ask_proof(phone: str, data: dict) -> dict:
    _save(phone, "ask_proof", data)
    body = "📎 Attach proof photos if you have them (optional in this flow), then tap Done."
    reply = send_buttons(phone, body, [("proof:done", "➡️ Done — continue"),
                                       ("cancel", "❌ Cancel")])
    return {"status": "ok", "flow": "ask_proof", "reply": body, "send": reply}


def _report_text(data: dict) -> str:
    cat = CATEGORY_LABELS.get(str(data.get("category")), str(data.get("category") or "—"))
    route = data.get("route_name") or data.get("route_text") or "(no route)"
    desc = str(data.get("description") or "")
    return (
        "🧾 FINAL REPORT — please review:\n\n"
        f"• Category: {cat}\n"
        f"• Route: {route}\n"
        f"• Problem: {desc}\n\n"
        "Tap *Submit* to file it (it appears on the dashboard instantly), "
        "*Edit* to change something, or *Cancel*."
    )


def _confirm(phone: str, data: dict) -> dict:
    _save(phone, "confirm", data)
    text = _report_text(data)
    reply = send_buttons(phone, text, [("submit", "✅ Submit complaint"),
                                       ("edit", "✏️ Edit details"),
                                       ("cancel", "❌ Cancel")])
    return {"status": "ok", "flow": "confirm", "reply": text, "send": reply}


def _edit_menu(phone: str, data: dict) -> dict:
    _save(phone, "edit_menu", {**data, "editing": True})
    body = "What should we change?"
    reply = send_list(phone, body, "Edit field",
                      [("edit:cat", "Category", None),
                       ("edit:route", "Route", None),
                       ("edit:desc", "Description", None)])
    return {"status": "ok", "flow": "edit_menu", "reply": body, "send": reply}


def _file(phone: str, data: dict) -> dict:
    """Shared filing pipeline (validate -> depot -> SLA -> insert)."""
    complaint = ComplaintCreate(
        category=Category(str(data.get("category") or "other")),
        route_id=data.get("route_id") or None,
        route_text=(data.get("route_name") or data.get("route_text") or None),
        description=str(data.get("description") or ""),
        contact_phone=phone,
    )
    try:
        out = file_complaint(complaint, source_channel="whatsapp", actor_id=phone)
    except ValueError as e:
        body = f"Couldn't file it: {e}. Let's fix the route."
        reply = send_buttons(phone, body, [("edit:route", "✏️ Change route"),
                                           ("cancel", "❌ Cancel")])
        _save(phone, "edit_menu", {**data, "editing": True})
        return {"status": "ok", "flow": "edit_menu", "reply": body, "send": reply}
    _clear(phone)
    body = (
        f"✅ Filed {out.reference_id} ({out.status}"
        f"{', depot: ' + out.depot if out.depot else ''}).\n"
        "Track it on the website /track page with your reference ID."
    )
    try:  # same best-effort policy as every other send in this flow
        reply = wa_send_text(phone, body)
    except Exception as exc:  # noqa: BLE001
        reply = {"error": str(exc)}
    return {"status": "ok", "flow": "filed", "reply": body, "send": reply,
            "reference_id": out.reference_id}


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------
def _cancel(phone: str) -> dict:
    _clear(phone)
    return {"status": "ok", "flow": "cancelled",
            "reply": "Cancelled — nothing was filed.",
            "send": send_buttons(phone, "Cancelled — nothing was filed.",
                                 [("flow:start", "🚨 Start over")])}


def _dispatch(phone: str, kind: str, value: str | None) -> dict:
    conv = _get(phone)
    state, data = conv["state"], dict(conv["data"])
    text = (value or "").strip()

    if state == "idle":
        if kind == "button":
            if value == "flow:start":
                return _ask_category(phone, {})
            if value == "help":
                return _help(phone)
        if kind == "text" and text.lower() in _GREETINGS:
            return _menu(phone)
        return {}  # unclaimed: legacy pipe-format / auto-file path handles it

    if value == "cancel" and state not in ("creating",):
        # Destructive-on-single-tap is dangerous (AUDIT.md §30): confirm first
        # when a draft is in flight.
        return _cancel_guard(phone, data) if data else _cancel(phone)

    if state == "cancel_confirm":
        if value == "back":
            # Resume the flow at the review screen with the draft intact.
            return _confirm(phone, data)
        if value == "cancel:confirm":
            return _cancel(phone)
        return _cancel_guard(phone, data)

    if state == "menu":
        if value == "flow:start":
            return _ask_category(phone, {})
        if value == "help":
            return _help(phone)
        return _menu(phone)

    if state == "ask_category":
        if kind in ("button", "list") and value and value.startswith("cat:"):
            cat = value[4:]
            if cat in CATEGORY_LABELS:
                return _ask_route(phone, {**data, "category": cat})
        return _ask_category(phone, data)

    if state == "ask_route":
        if value == "route:skip":
            return _ask_description(phone, data)
        if kind == "text" and text:
            return _suggest_routes(phone, text, data)
        return _ask_route(phone, data)

    if state == "pick_route":
        if value and value.startswith("route:") and value != "route:raw" and value != "route:skip":
            hit = next((h for h in find_routes(data.get("route_text") or "")
                        if h["id"] == value[6:]), None)
            if hit:
                return _ask_description(
                    phone, {**data, "route_id": hit["id"], "route_name": hit["name"]})
            return _ask_route(phone, data)  # stale suggestions: re-pick
        if value == "route:raw":
            return _ask_description(phone, data)
        if value == "route:skip":
            return _ask_description(phone, {**data, "route_text": None, "route_name": None})
        if kind == "text" and text:
            return _suggest_routes(phone, text, data)
        return _suggest_routes(phone, data.get("route_text") or "", data)

    if state == "ask_description":
        if kind == "text":
            if len(text) < 10:
                body = f"That is {len(text)} characters — a little more detail helps (min 10)."
                return {"status": "ok", "flow": "ask_description", "reply": body,
                        "send": send_buttons(phone, body, [("cancel", "❌ Cancel")])}
            data = {**data, "description": text}
            return _confirm(phone, data) if data.get("editing") else _ask_proof(phone, data)
        return _ask_description(phone, data)

    if state == "ask_proof":
        if value == "proof:done":
            return _confirm(phone, data)
        return _ask_proof(phone, data)

    if state == "confirm":
        if value == "submit":
            _save(phone, "creating", data)  # atomic-ish guard vs double-taps
            out = _file(phone, data)
            if out.get("flow") != "filed":
                _save(phone, "confirm", data)  # allow retry after a validation error
            return out
        if value == "edit":
            return _edit_menu(phone, data)
        return _confirm(phone, data)

    if state == "edit_menu":
        if value == "edit:cat":
            return _ask_category(phone, {**data, "editing": True})
        if value == "edit:route":
            return _ask_route(phone, data)
        if value == "edit:desc":
            return _ask_description(phone, data)
        if value == "back":
            return _confirm(phone, data)
        return _edit_menu(phone, data)

    _clear(phone)
    return _menu(phone)


def handle_update(payload: dict) -> dict | None:
    """Route one Cloud API webhook payload through the guided flow.

    Returns the webhook response dict when the flow consumed the message,
    or None when the legacy handler should take it (idle bare text / pipes).
    """
    try:
        value = payload["entry"][0]["changes"][0]["value"]
        msg = value["messages"][0]
        sender = str(msg.get("from") or "")
        if not sender:
            return None
        if msg.get("type") == "interactive":
            inner = msg.get("interactive") or {}
            reply = inner.get("button_reply") or inner.get("list_reply") or {}
            kind, picked = ("button" if inner.get("button_reply") else "list"), str(reply.get("id") or "")
            if picked:
                return _dispatch(sender, kind, picked)
            return None
        if msg.get("type") == "text":
            text = ((msg.get("text") or {}).get("body") or "").strip()
            if text.lower() in _GREETINGS:
                return _dispatch(sender, "text", text)
            conv = _get(sender)
            if conv["state"] != "idle":
                return _dispatch(sender, "text", text)
            return None  # idle free text: legacy parse/file path
        return None
    except (KeyError, IndexError, TypeError, AttributeError):
        return None
