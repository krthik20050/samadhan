# Telegram bot setup

Bot adapter: `POST /api/v1/telegram/webhook` — same complaint flow as WhatsApp and the web form.

## 1. Create the bot (once)

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. `/newbot` → pick a name and username (this project uses **@esamadhanbot**).
3. Copy the HTTP API token into repo `.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_SECRET_TOKEN=   # generate: py -c "import secrets; print(secrets.token_urlsafe(24))"
```

`TELEGRAM_SECRET_TOKEN` is optional for local demos; set it before any public deployment so only Telegram can call your webhook (`X-Telegram-Bot-Api-Secret-Token` header).

## 2. Run the API

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
py -m uvicorn app.main:app --reload --port 8000
```

Check: `GET http://localhost:8000/api/v1/telegram/webhook` → `{"status":"ok"}` when the token is set.

## 3. Expose HTTPS (required for webhooks)

Telegram must reach your server over **HTTPS**. For local dev, tunnel port 8000, e.g.:

- [ngrok](https://ngrok.com): `ngrok http 8000` → use the `https://….ngrok-free.app` host
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/): `cloudflared tunnel --url http://localhost:8000`

## 4. Register the webhook

From repo root (venv active):

```powershell
py backend/scripts/setup_telegram_webhook.py info
py backend/scripts/setup_telegram_webhook.py set https://YOUR_TUNNEL_HOST
```

Verify:

```powershell
py backend/scripts/setup_telegram_webhook.py info
```

## 5. Try it in Telegram

Message your bot:

| Message | Result |
|--------|--------|
| `/start` or `/help` | Format help |
| `overcrowding \| Adoor - Ernakulam \| Bus was severely overcrowded today` | Files complaint, returns `KSRTC-…` |
| `/track KSRTC-2026-XXXXXX` | Status lookup |

Complaints appear on the dashboard like web submissions (no phone on Telegram channel).

## Troubleshooting

- **No replies:** `setup_telegram_webhook.py info` — URL empty? Re-run `set`. Check tunnel still points at `:8000`.
- **403 secret mismatch:** `TELEGRAM_SECRET_TOKEN` in `.env` must match what was sent on `setWebhook` (re-run `set` after changing `.env`).
- **Send skipped:** Backend logs / webhook JSON may show `{"skipped":"no Telegram credentials"}` — restart uvicorn after editing `.env`.
