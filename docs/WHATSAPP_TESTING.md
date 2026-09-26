# WhatsApp bot — smoke test (hackathon mode)

The Telegram bot runs on the hosted Edge Function (`docs/TELEGRAM.md`). The
WhatsApp adapter is the FastAPI twin: same parse -> file -> reply pipeline, same
`cat | route | desc` pipe format, same response shapes. This guide gets you a
working test loop on your laptop in ~5 minutes — no server, no tunnel, no
testers needed beyond you.

## What already works vs what's missing

| Capability | Status |
|---|---|
| Parse `category \| route \| description` into a complaint | ✅ `backend/app/services/whatsapp.py` |
| Guess a category from bare text (no pipes) | ✅ keyword matcher |
| File to DB via the real route→depot→SLA pipeline | ✅ `POST /api/v1/whatsapp/webhook` |
| Reply with reference ID / HELP / errors | ✅ best-effort, never 5xx |
| Image-only messages ignored | ✅ |
| **Guided button flow (the `/complain` twin)** | ✅ `backend/app/services/whatsapp_flow.py` — menu → category → route suggestions → description → confirm → file, with edit + cancel |
| **Outbound Cloud API send** | ⚠️ code ready, blocked on a valid access token |
| Ticket-photo auto-read (Groq) + evidence uploads | ❌ Edge Function/Storage feature; not ported |
| Hosted webhook (Edge Function reads `WHATSAPP_*`) | ❌ FastAPI local only |

## Run the smoke test

From `app/backend/` (venv active):

```powershell
py scripts/test_whatsapp_bot.py                    # parse-only dry run
py scripts/test_whatsapp_bot.py --full             # + files real rows, then deletes them
py scripts/test_whatsapp_bot.py --full --send      # + probes Cloud API creds (nothing sent)
py scripts/test_whatsapp_bot.py --full --send --to 91XXXXXXXXXX   # + texts a real phone
```

Everything reads config from the environment — run through
`infisical run --env=dev -- py scripts/test_whatsapp_bot.py --full` once secrets
live there (today `backend/.env` also feeds pydantic-settings). The full run
files real complaints into Supabase and deletes them at the end via the same
`cleanup()` the pytest suite uses, so the dashboard stays clean.

`--full` end-to-end cases (edit freely — they are plain tuples in the script):

1. `overcrowding | Adoor - Ernakulam | …` → filed, depot **ADOOR**, reference ID in reply
2. bare "the bus was really dirty…" → guessed category, filed
3. `hi` → HELP text, nothing filed
4. image-only payload → ignored

## Cloud API status probe (the important one for the demo)

`--send` first probes the credential pair without sending anything:

```
== Cloud API credentials (WHATSAPP_*) ==
  [FAIL] token rejected: HTTP 400 code 190 — Error validating access token:
         Session has expired on Wednesday, 23-Sep-26 …
```

That is the current state: **your WHATSAPP_ACCESS_TOKEN expired on Sep 23.**
The API Setup page's "generate token" button issues a ~24-hour token, so it dies
mid-hackathon. Fix:

1. Regenerate the token: developers.facebook.com → your app → **WhatsApp →
   API Setup** → copy a fresh one (or mint a permanent **System User** token in
   Business Settings if you want it to outlive the weekend).
2. Update `WHATSAPP_ACCESS_TOKEN` (Infisical prod env, or `backend/.env` for
   this local test), then rerun `--full --send`.
3. When it goes `[PASS]`, `--to` your own phone for the end-to-end text.

Other codes you may hit: `131030` = recipient not in the dev-mode allow-list
(add your number under **To** on the API Setup page); `131047` = 24h customer
service window — expected if nobody ever messaged the test number.

## Receive: point Meta at your laptop (only for a live webhook demo)

The webhook only matters once Meta must *deliver* passenger messages to you.
For the hackathon demo there are two options:

- **Simulated inbound (no tunnel):** the smoke test posts the exact Cloud API
  payload to the handler — that is what the `--full` run does.
- **Real inbound:** run FastAPI, expose it with `ngrok http 8000`, then in
  Meta's WhatsApp → **Configuration** set the callback URL to
  `https://<tunnel>/api/v1/whatsapp/webhook` with
  **Verify token = `WHATSAPP_VERIFY_TOKEN`**, and click Verify. (Meta only
  accepts https, hence the tunnel. There is no `setup_telegram_webhook.py`
  equivalent here because Meta's webhook is configured in the dashboard, not
  via an API call.)

## Guided flow (the `/complain` twin)

Send *hi* to the test number and the bot opens a menu; **File a complaint**
starts the one-question-at-a-time flow:

1. **Category** — WhatsApp list message, 9 options (same labels as Telegram)
2. **Route** — type "Adoor to Ernakulam" → tap an exact dataset match (found
   through the same OD-key pipeline as filing), use your text as-is, or skip
3. **Description** — one text message (min 10 chars)
4. **Proof** — optional; Done continues
5. **Confirm** — FINAL REPORT summary → ✅ Submit · ✏️ Edit (category/route/
   description) · ❌ Cancel
6. Filed → reference ID + depot; `\|` pipe format and bare-text filing still
   work unchanged for anyone who skips the menu

State is in-memory per phone number (`whatsapp_flow.py`) — right for a
single-process local demo; a hosted port would persist it like
`telegram_conversations` (migration 006). Every send degrades to a plain
response payload when Cloud API creds are missing, so the flow is fully
testable with the expired token too — `--full` covers all of it.

## Demo script (once the token passes)

1. From your own phone, WhatsApp your test number: `hi` → tap through the
   guided flow (or send `overcrowding | Adoor - Ernakulam | Bus was packed and
   skipped my stop` directly)
2. Bot replies `Filed SAM-2026-000123 (submitted, depot: ADOOR). Track it on
   the website /track page with your reference ID.`
3. Open the web `/track` page with that reference ID — same pipeline, same DB.

## Troubleshooting

- **Token rejected (code 190):** see above — regenerate.
- **`[SKIP] WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set`:** the
  vars are missing from the environment; run through `infisical run` or fill
  `backend/.env` for this local test.
- **Filing works but replies fail with 401:** same expired-token cause; the
  pipeline section still passing means your complaint flow is fine.
- **Route resolves to `needs_triage`:** expected for unknown routes — try one
  from the dataset, e.g. `Adoor - Ernakulam`.
