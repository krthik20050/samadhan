"""Register or clear the Telegram Bot API webhook for this app.

Usage (from repo root, with backend venv active):

  py backend/scripts/setup_telegram_webhook.py info
  py backend/scripts/setup_telegram_webhook.py set https://YOUR_PUBLIC_HOST
  py backend/scripts/setup_telegram_webhook.py delete

Reads TELEGRAM_BOT_TOKEN and TELEGRAM_SECRET_TOKEN from the repo .env.
Webhook path is always: {base}/api/v1/telegram/webhook
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
ENV = dotenv_values(ROOT / ".env")


def _token() -> str:
    t = (ENV.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if not t:
        sys.exit("TELEGRAM_BOT_TOKEN is missing in .env")
    return t


def _api(method: str, **params: object) -> dict:
    r = httpx.post(
        f"https://api.telegram.org/bot{_token()}/{method}",
        json=params or None,
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        sys.exit(f"{method} failed: {json.dumps(data)}")
    return data


def cmd_info() -> None:
    me = _api("getMe")["result"]
    wh = _api("getWebhookInfo")["result"]
    print(f"Bot: @{me.get('username')} ({me.get('first_name')})")
    print(f"Webhook URL: {wh.get('url') or '(not set)'}")
    if wh.get("last_error_message"):
        print(f"Last error: {wh['last_error_message']}")
    secret = (ENV.get("TELEGRAM_SECRET_TOKEN") or "").strip()
    print(f"Secret token in .env: {'set' if secret else 'not set (webhook accepts any caller)'}")


def cmd_set(base_url: str) -> None:
    base = base_url.rstrip("/")
    url = f"{base}/api/v1/telegram/webhook"
    payload: dict[str, object] = {"url": url, "drop_pending_updates": True}
    secret = (ENV.get("TELEGRAM_SECRET_TOKEN") or "").strip()
    if secret:
        payload["secret_token"] = secret
    _api("setWebhook", **payload)
    print(f"Webhook set to {url}")
    if not secret:
        print("Tip: set TELEGRAM_SECRET_TOKEN in .env and re-run set for production.")


def cmd_delete() -> None:
    _api("deleteWebhook", drop_pending_updates=True)
    print("Webhook deleted (bot will not receive updates until set again).")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1].lower()
    if cmd == "info":
        cmd_info()
    elif cmd == "set":
        if len(sys.argv) < 3:
            sys.exit("Usage: setup_telegram_webhook.py set https://public-host")
        cmd_set(sys.argv[2])
    elif cmd == "delete":
        cmd_delete()
    else:
        sys.exit(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
