# Complaint Workflow

The single pipeline every channel shares. Complexity is absorbed by the
system; the passenger tells Samadhan what happened.

## Web (primary)

```
Home
 → /file-complaint   Step 1: What happened? (category, description; ticket
                              photo optionally auto-read via Groq slot)
                     Step 2: Where/when? (route autocomplete from the KSRTC
                              dataset, bus number, travel date, proof upload)
 → /file-complaint/review   Step 3: full summary + optional phone + channel
                              (Edit links jump back; Submit is idempotent)
 → /file-complaint/success    Reference ID (KSRTC-YYYY-XXXXXX) + depot + SLA
 → /track                     Reference → status timeline, depot, SLA state
```

- Draft persists in context per step; submit sends `X-Idempotency-Key`
  (generated once per draft) — double-clicks or retries never duplicate.
- Proof files upload straight to the private `evidence` bucket via
  `POST /api/v1/uploads` (type + 20 MB validated server-side); only metadata
  rides with the complaint.

## Telegram (@esamadhanbot) — ticket-first

```
/complain
 → 📸 ticket photo? (auto-read: bus, route, date; stored as proof of travel
    even if the ML slot is empty; Skip supported)
 → category (tap) → route (dataset suggestions or your text) → description
   (text or voice note)
 → 📎 proof stage (multiple photos/videos, Done to continue)
 → FINAL REPORT review → Submit | Edit | Cancel-with-confirmation
 → ✅ Reference ID + depot + SLA + Track/My links
```

State lives in `telegram_conversations` (Postgres); `tg_conv_claim` makes
submit atomic against double-taps; Cancel asks before discarding a draft;
`/track <ref>` and `/my` work anytime; `/link` shares the phone so trips are
remembered (two-tap filing next time) and the depot can call back.

## WhatsApp (Cloud API)

Guided twin of the Telegram flow (buttons/lists, same categories, same
suggestions, same review/confirm screens) plus the legacy
`category | route | description` pipe format. Files via the shared filing
service; webhook verified by `X-Hub-Signature-256`. Conversation state is
in-memory for now (see KNOWN_LIMITATIONS #3).

## Voice (web)

Record on /file-complaint/voice → Sarvam STT (slot-gated) → transcript lands
in the description → continue through the standard review/submit path.

## What happens server-side (identical for all channels)

```
validate (category/description/route/evidence)
 → resolve route → depot (dataset aliases; ambiguity ⇒ needs_triage, no guess)
 → SLA due from sla_rules
 → idempotency replay check
 → INSERT complaint (source_channel stamped) + evidence rows + status_history
 → reference ID issued server-side
 → audit_log row (channel, actor, request id)
```

## Status lifecycle

`submitted → in_review/needs_triage/escalated → resolved → closed`
(enforced by trigger; every move recorded in `status_history` and visible on
/track, in the bot, and in the admin console).

## Cross-channel guarantee

One database, one filing RPC: a complaint filed on Telegram appears on
/track and in the web account panel with the same reference ID, and vice
versa (web filings linked by phone/email appear in the bot's /my when the
account is linked).
