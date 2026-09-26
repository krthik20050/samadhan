# Telegram bot — @esamadhanbot

Button-driven complaint flow (BloodLink pattern): one question at a time,
inline buttons, dataset-backed route suggestions, edit-before-submit.
Hosted on the Supabase Edge Function (`supabase/functions/api`); conversation
state lives in Postgres (`telegram_conversations`, migration 006).

## User flow

1. `/start` → welcome + menu (🚨 File a complaint · 📋 My complaints · ❓ Help)
2. **Category** — 9 tappable buttons (cleanliness, overcrowding, …)
3. **Route** — type "Guruvayoor to Kozhikode" → bot suggests matching dataset
   routes as buttons (exact name, use-as-typed, or skip)
4. **Description** — one text message (min 10 chars)
5. **Confirm** — summary with ✅ Submit · ✏️ Edit (per-field) · ❌ Cancel
6. Filed → reference ID + depot, chat linked (`/my` lists your complaints)

Safety valves: `/cancel` aborts anytime (nothing filed), double-tap Submit is
an atomic claim (no duplicates), the legacy `cat | route | desc` pipe format
still works, and a 10+ char bare message pre-fills the flow with a guessed
category.

## Commands

| Command | Effect |
|---|---|
| `/complain` | Start the guided flow |
| `/my` | Your recent complaints from this chat |
| `/track SAM-…` | Status of any complaint (legacy KSRTC-… IDs also resolve) |
| `/cancel` | Abort the current flow |
| `/help` | Overview |

## Where it runs

- **Hosted (production):** Supabase Edge Function — webhook is
  `https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api/api/v1/telegram/webhook`,
  secrets via `supabase secrets set` (TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN,
  ADMIN_API_TOKEN). See `supabase/README.md`.
- **Local dev:** FastAPI `:8000` + a tunnel (ngrok / cloudflared), then
  `py backend/scripts/setup_telegram_webhook.py set https://YOUR_TUNNEL_HOST`.
  Pipe-format parity is covered by `backend/tests/test_telegram.py`.

## Troubleshooting

- **Bot silent:** `setup_telegram_webhook.py info` — check URL, `last_error_message`,
  and that the webhook was re-`set` after any deploy/rename.
- **403 secret mismatch:** `TELEGRAM_SECRET_TOKEN` must match what `set` registered.
- **Changed the bot token in @BotFather:** update `.env` + function secrets, then re-run `set`.
