"""Hackathon smoke test: drive the WhatsApp webhook end-to-end.

Exercises the same pipeline as the Telegram bot — parse -> file -> reply —
by POSTing Cloud API webhook payloads to the local FastAPI app via TestClient.
No running server needed: real HTTP handler, real Supabase DB when --full is
passed (rows deleted at the end via the same cleanup() backend/tests use).

Usage (from backend/ with the venv active):

  py scripts/test_whatsapp_bot.py                        # dry run: parsing only
  py scripts/test_whatsapp_bot.py --full                 # + real DB rows (self-cleaning)
  py scripts/test_whatsapp_bot.py --full --send          # + probe Cloud API creds (no sends)
  py scripts/test_whatsapp_bot.py --full --send --to 91…  # + text a real phone

Env: DATABASE_URL always; WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID for
--send. Read from the environment — run through `infisical run --env=dev --`
once secrets live there; today they also come from backend/.env via
pydantic-settings.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
if hasattr(sys.stdout, "reconfigure"):  # emojis on a cp1252 Windows console
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services.whatsapp import extract_message, parse_complaint_text  # noqa: E402
from tests.test_complaints_api import cleanup  # noqa: E402  (conftest sets the staff token)

c = TestClient(app)
WEBHOOK = "/api/v1/whatsapp/webhook"
SENDER_BASE = "9199990000"

# (label, message body, expected outcome) — outcomes: filed / help / ignored
CASES: list[tuple[str, str, str]] = [
    ("pipe-format | Adoor - Ernakulam | filed with reference ID",
     "overcrowding | Adoor - Ernakulam | Bus was severely overcrowded today",
     "filed"),
    ("bare text | guessed category, filed",
     "The bus was really dirty and smelly inside today",
     "filed"),
    ("too short, not a greeting | HELP reply instead of filing",
     "ok",
     "help"),
    ("image-only message | ignored",
     None,
     "ignored"),
]

def wa_payload(sender: str, body: str | None) -> dict:
    """Cloud API webhook shape; body=None simulates an image-only message."""
    value: dict = {"messages": [{"from": sender, "type": "text" if body else "image"}]}
    if body:
        value["messages"][0]["text"] = {"body": body}
    return {"entry": [{"changes": [{"value": value}]}]}


def parse_checks() -> int:
    print("== parse-only checks (no DB rows) ==")
    failures = 0
    for label, body, expected in CASES:
        if body is None:
            _, text = extract_message(wa_payload("919999000004", None))
            ok = text is None
            got = "ignored" if ok else "parsed"
        else:
            complaint = parse_complaint_text(body)
            got = "filed" if complaint is not None else "help"
            ok = got == expected
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}")
        if not ok:
            failures += 1
    return failures


def webhook_checks(do_send: bool) -> int:
    print("== end-to-end via POST /api/v1/whatsapp/webhook (real DB rows, cleaned up) ==")
    failures = 0
    for i, (label, body, expected) in enumerate(CASES):
        sender = f"{SENDER_BASE}{i + 1}"
        r = c.post(WEBHOOK, json=wa_payload(sender, body))
        if r.status_code != 200:
            print(f"  [FAIL] {label}: HTTP {r.status_code} — {r.text[:200]}")
            failures += 1
            continue
        out = r.json()
        ref = out.get("reference_id")
        sent = out.get("send", {})
        if expected == "filed":
            ok = bool(ref) and out.get("status") == "ok" and out.get("complaint")
        elif expected == "help":
            ok = ref is None and out.get("complaint") is None and "CATEGORY" in out.get("reply", "")
        else:  # ignored
            ok = out.get("status") == "ignored"
        # Image-only (ignored) rows never file, so cleanup only when needed.
        if ref:
            cleanup(ref)
        note = ""
        send_err = sent.get("error")
        if send_err:
            note = f"  reply send failed: {send_err.split(' for url')[0][:90]} (filing itself worked; see Cloud API section)"
        elif do_send:
            note = f"  send -> {sent.get('skipped') or 'delivered'}"
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}{note}")
        if not ok:
            failures += 1
    return failures


HINTS_190 = (
    "  hint: error 190 means the access token itself was rejected — usually "
    "expired (temporary tokens from the API Setup page last 24h), revoked, "
    "or minted by a different Meta app than the phone number ID. Regenerate "
    "it in the WhatsApp > API Setup page (or a permanent System User token) "
    "and update WHATSAPP_ACCESS_TOKEN."
)


def send_checks(live_to: str | None) -> int:
    """Credential probe (no side effects) + optional live send to --to."""
    print("== Cloud API credentials (WHATSAPP_*) ==")
    s = get_settings()
    if not (s.WHATSAPP_ACCESS_TOKEN and s.WHATSAPP_PHONE_NUMBER_ID):
        print("  [SKIP] WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set")
        return 0
    failures = 0

    # 1. Token probe: read the phone-number node. 200 = token valid for it.
    r = httpx.get(
        f"https://graph.facebook.com/v22.0/{s.WHATSAPP_PHONE_NUMBER_ID}",
        params={"access_token": s.WHATSAPP_ACCESS_TOKEN},
        timeout=15,
    )
    if r.status_code == 200:
        node = r.json()
        name = node.get("verified_name") or node.get("display_phone_number") or "?"
        print(f"  [PASS] access token valid for phone number ID ...{s.WHATSAPP_PHONE_NUMBER_ID[-4:]} ({name})")
    else:
        err = r.json().get("error", {})
        print(f"  [FAIL] token rejected: HTTP {r.status_code} code {err.get('code')} — {err.get('message', '')[:120]}")
        if err.get("code") == 190:
            print(HINTS_190)
        failures += 1

    # 2. Live send — only to an explicit recipient (never to the number ID;
    #    that identifies your sender, it is not a phone number).
    if not live_to:
        print("  [SKIP] live send: pass --to 91XXXXXXXXXX (your own phone) to text "
              "yourself; nothing was sent")
        return failures
    try:
        from app.services.whatsapp import send_text
        result = send_text(live_to, "SAMADHAN WhatsApp smoke test 🚌")
        if "skipped" in result:
            print(f"  [SKIP] {result['skipped']}")
        elif "error" in result:
            print(f"  [FAIL] {result['error']}")
            failures += 1
        else:
            mid = result.get("messages", [{}])[0].get("id", "?")
            print(f"  [PASS] message accepted for delivery to {live_to} (id: {mid[:12]}...)")
    except httpx.HTTPStatusError as exc:
        err = {}
        try:
            err = exc.response.json().get("error", {})
        except Exception:  # noqa: BLE001
            pass
        print(f"  [FAIL] send failed: HTTP {exc.response.status_code} code {err.get('code')} — {err.get('message', '')[:160]}")
        if err.get("code") == 131030:
            print("  hint: recipient not allowed — in dev mode, add their number to "
                  "Recipient numbers on the API Setup page.")
        failures += 1
    return failures


def text_msg(sender: str, body: str) -> dict:
    return {"entry": [{"changes": [{"value": {"messages": [
        {"from": sender, "type": "text", "text": {"body": body}}]}}]}]}


def interactive_msg(sender: str, kind: str, picked_id: str) -> dict:
    inner = {"type": kind, f"{kind}_reply": {"id": picked_id, "title": "t"}}
    return {"entry": [{"changes": [{"value": {"messages": [
        {"from": sender, "type": "interactive", "interactive": inner}]}}]}]}


def flow_checks() -> int:
    """Guided flow end-to-end: menu -> category -> route -> description ->
    confirm -> submit (files one real row, cleaned up). Needs the DB (--full)."""
    from app.services import whatsapp_flow

    whatsapp_flow.reset_conversations()
    print("== guided flow (buttons/lists; one real row, cleaned up) ==")
    failures = 0
    sender = f"{SENDER_BASE}90"

    def step(label: str, payload: dict, checks) -> dict:
        nonlocal failures
        r = c.post(WEBHOOK, json=payload)
        out = r.json() if r.status_code == 200 else {}
        ok = r.status_code == 200 and checks(out)
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  ({str(out.get('reply', out))[:70]})")
        if not ok:
            failures += 1
        return out

    step("greeting opens the menu",
         text_msg(sender, "hi"),
         lambda o: o.get("flow") == "menu")
    step("File a complaint -> category picker",
         interactive_msg(sender, "button", "flow:start"),
         lambda o: o.get("flow") == "ask_category")
    step("pick category (list) -> route question",
         interactive_msg(sender, "list", "cat:overcrowding"),
         lambda o: o.get("flow") == "ask_route")

    out = step("type route -> dataset suggestions",
               text_msg(sender, "Adoor to Ernakulam"),
               lambda o: o.get("flow") == "pick_route" and "suggestions" in o)
    hits = whatsapp_flow.find_routes("Adoor to Ernakulam")
    if hits:
        step("tap exact route -> description question",
             interactive_msg(sender, "list", f"route:{hits[0]['id']}"),
             lambda o: o.get("flow") == "ask_description")
    else:
        step("no dataset hit -> use-my-text path",
             interactive_msg(sender, "list", "route:raw"),
             lambda o: o.get("flow") == "ask_description")

    step("description -> proof step",
         text_msg(sender, "Bus was severely overcrowded and skipped my stop"),
         lambda o: o.get("flow") == "ask_proof")
    step("Done -> FINAL REPORT confirm",
         interactive_msg(sender, "button", "proof:done"),
         lambda o: o.get("flow") == "confirm" and "FINAL REPORT" in o.get("reply", ""))
    out = step("Submit -> filed with reference ID",
               interactive_msg(sender, "button", "submit"),
               lambda o: o.get("flow") == "filed" and bool(o.get("reference_id")))
    if out.get("reference_id"):
        cleanup(out["reference_id"])

    # Cancel path on a fresh conversation.
    sender2 = f"{SENDER_BASE}91"
    step("second user: menu -> flow -> cancel",
         interactive_msg(sender2, "button", "flow:start"),
         lambda o: o.get("flow") == "ask_category")
    step("cancel aborts with nothing filed",
         interactive_msg(sender2, "button", "cancel"),
         lambda o: o.get("flow") == "cancelled")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--full", action="store_true", help="also file real rows via the webhook (self-cleaning)")
    parser.add_argument("--send", action="store_true", help="probe the Cloud API credentials (no messages sent)")
    parser.add_argument("--to", metavar="E164", help="with --send, also deliver a real text to this number, e.g. 919999999999")
    args = parser.parse_args()

    failures = parse_checks()
    if args.full:
        failures += webhook_checks(do_send=bool(args.to))
        failures += flow_checks()
    if args.send:
        failures += send_checks(args.to)
    print(f"\n{'ALL PASS' if failures == 0 else f'{failures} FAILURE(S)'} — "
          f"{'dry run' if not args.full else 'full run'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
