# Why We Did It

The specific reasoning behind each major change — the problem, the failed
alternatives, and why the chosen approach won. Companion to
[WHAT_WE_ARE_DOING.md](WHAT_WE_ARE_DOING.md).

## 1. One filing pipeline

**The problem:** three codebases could create a complaint (Postgres RPC,
FastAPI service, Edge Function paths) with subtly different rules — e.g. one
raises on a missing route while another files to `needs_triage`, and the bots
inserted a fake route `'Telegram'` as a sentinel. A rule fixed in one place
silently stayed broken in the others; a security fix would have to be
triplicated.

**Alternatives considered:**
- *Keep three implementations and add contract tests* — the drift already
  happened; tests would just freeze the inconsistency.
- *Move all filing into the Edge Function* — makes FastAPI useless as a test
  harness and adds latency to every bot filing.

**Why this won:** the RPC already had the strongest validation and sits where
the data lives. One implementation, called by everyone, testable from pytest
over the same wire the bots use. The sentinel disappeared because channels are
now first-class (`source_channel`), not hacks inside `route_text`.

## 2. Idempotency keys

**The problem:** a double-tap or flaky-network retry created two complaints
with two reference IDs. The passenger then tracked the "wrong" one and the
depot worked a duplicate. Classic distributed-systems failure, but with civic
trust as the casualty.

**Alternatives:**
- *Client-side button disable only* — does nothing for retries after a timeout,
  page refresh, or two tabs.
- *Server-side fuzzy duplicate detection* — slow, error-prone, and wrong
  (two similar real complaints are legitimate).

**Why this won:** idempotency keys are the standard exact solution — the client
sends the same random key per draft; the DB's unique partial index makes the
guarantee hold under races; replays return the original complaint. Telegram
already had the equivalent (`tg_conv_claim`); now every channel shares the
property.

## 3. Chat-keyed endpoints needed an owner check

**The problem:** `GET /api/v1/my/complaints?chat_id=…` served anyone whatever
chat ID they typed. Chat IDs are sequential-ish and enumerable — that is a
privacy breach of every bot user's complaint history. It existed because the
feature predated web accounts.

**Alternatives:**
- *Remove the panel* — safest, but breaks real functionality for linked users.
- *Secret in localStorage per chat* — still spoofable (localStorage is readable
  by any script on the origin) and complicates the bot handoff.

**Why this won:** the account system already merges bot and web identities
(`app_ensure_user` claims the bot row by email/phone). So the *web session
itself* is the proof of ownership: bind the read to the Clerk-verified user's
merged chat id, and enforce it again inside the RPC (defence in depth). The
unauthenticated panel is a documented limitation until the Edge Function is
redeployed — deploy-order-safe by construction.

## 4. WhatsApp webhook signature

**The problem:** anyone who discovered the URL could POST forged messages —
file junk complaints or trigger outbound WhatsApp sends (real money, real
spam from our number). Telegram had a secret header; WhatsApp was naked.

**Why HMAC:** it's the platform's own mechanism (`X-Hub-Signature-256` over the
*raw* bytes, timing-safe compare, fail closed when configured). No custom
scheme, no state, and the local/dev mode without a secret is explicit and
documented rather than accidentally open.

## 5. Status writes in the database

**The problem:** the admin console could inspect complaints but the "Record
Action" button threw `"Status updates are not available"` — lifecycle progress
was SQL-manual-only, so tickets effectively stalled.

**Alternatives:**
- *Direct UPDATEs from the Edge Function* — bypasses the transition rules and
  scatters lifecycle knowledge into TypeScript.
- *Trigger-only enforcement with raw SQL* — the trigger does stop bad writes,
  but callers get ugly generic errors and the rule lives twice (trigger +
  caller intuition).

**Why this won:** `app_set_status` centralizes the lifecycle in the database
next to the data, pre-checks transitions so the API returns precise 404/422
semantics, records history *and* audit atomically, and stays idempotent for
same-state re-submissions. The 003 trigger remains as the last line of defence
for any path that bypasses the function. One subtle product bug surfaced during
testing: operator notes were invisible on the public track timeline — fixed in
the same migration, because a status the passenger can't see is a status that
didn't happen.

## 6. Audit log in the service layer (not triggers)

Triggers can't know the request ID, the channel, or the actor across runtimes;
service-layer writes can. We accept the trade-off (a rogue writer could skip
auditing) because the write surface is already service_role-only, and status
changes — the actions that most need integrity — audit *inside* their
transaction so a change without its audit row is impossible.

## 7. Polling hygiene + code splitting

Both were measured, not guessed: admin tabs polled every 5–15 s even hidden
(~90% of it waste), and the single 598 kB bundle made every passenger download
the admin console. `visibilitychange`-gated polling and route-level
`React.lazy` were the smallest correct fixes; a global state library or an
SSR framework would have been disproportionate.

## 8. Infisical-first secrets

The uncommitted local work had already chosen Infisical; we completed and
documented it instead of inventing a parallel `.env` convention, because
`.env` files are where secrets leak into git. `.env.example` remains as the
names-only checklist.
