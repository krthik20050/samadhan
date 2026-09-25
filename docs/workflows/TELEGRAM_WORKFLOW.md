# Telegram Workflow

Bot: **@esamadhanbot**. Webhook: `POST <api>/api/v1/telegram/webhook` with the
`x-telegram-bot-api-secret-token` header checked against `TELEGRAM_SECRET_TOKEN`.
All state is server-side; the function is stateless (one request per isolate).

## Commands

| Command | Behavior |
|---|---|
| `/start` | Welcome + what Samadhan does + main menu buttons |
| `/complain` | Start the guided flow at the ticket-photo step |
| `/my` | Recent complaints for this chat (reference, status, depot) |
| `/track <ref>` | Track one complaint by reference ID |
| `/link` | One-tap phone share (`request_contact`) → account linking |
| `/unlink` | Remove the chat link (complaints unaffected) |
| `/cancel` | Confirmed cancel — never destroys a draft on a single tap |
| `/help` | Usage summary |

## Guided flow (state machine in `telegram_conversations`)

| State | Consumes | Advances to |
|---|---|---|
| `ask_ticket` | ticket photo (or Skip) | `ticket_review` / `ask_category` |
| `ticket_review` | "Details look right" / "Ignore & continue manually" | route suggestions / `ask_category` |
| `ask_category` | category tap (or typed text → guessed category + route hints) | route suggestions / `ask_route` |
| `pick_route` / `ask_route` | dataset route tap / raw text / Skip | `ask_description` |
| `ask_description` | text (≥10 chars) or voice note (Sarvam, fail-soft) | `ask_proof` |
| `ask_proof` | photos/videos (multiple) or Done | `confirm` |
| `confirm` | Submit / Edit / Cancel-with-confirmation | `creating` → cleared on success |
| `edit_menu` (+ `edit_bus`) | field edits | back to `confirm` |

Guarantees:

- **Duplicate-proof submit**: `tg_conv_claim('confirm'→'creating')` is an
  atomic conditional transition; a double-tap finds the wrong state and is
  ignored — exactly one complaint per confirmation.
- **Ticket photo is kept even when ML fails**: stored to the evidence bucket
  before extraction; extraction is a bonus, never a gate.
- **MIME/size verified by download**: file bytes + content-type come from the
  actual fetch (20 MB cap enforced pre-download via `getFile` metadata).
- **Cancel is two-step** when a draft exists: "Yes, cancel it" /
  "Continue editing". `/cancel` on an empty state is harmless.
- **Errors are honest and recoverable**: DB validation messages surface
  verbatim (shortened); fatal data problems reset the flow, transient ones
  return to the review screen with Submit again.
- **Success shows everything**: reference ID, depot, proof count, SLA due,
  `/track` and `/my` — and the same reference ID works on the website.

## Account linking (bot ↔ website)

`/link` → contact share → `tg_passenger_link` → `passengers` row → mirrored
into `app_users` (010 backfill). When the same person signs in on the web
(Clerk), `app_ensure_user` claims the row by email/phone, merging identities:
bot trips appear in the web account panel; web filings with a shared phone
appear in the bot's `/my`. Linked chats get two-tap filing from saved trips
(`tg_trip_*`) and depot callbacks (operational phone, never published).

## ML slots (all optional, fail-soft)

- `GROQ_API_KEY` — ticket photo → structured JSON (bus, route, date, PNR…),
  shown for human verification before anything is trusted.
- `SARVAM_API_KEY` — voice notes → description text.

Missing keys degrade to manual entry with a clear notice; the flow never 500s
because a slot is absent.
