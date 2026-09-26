# SAMADHAN — Production Readiness Audit

Audited: 2026-09-25, against the **local repository** (source of truth), before the
production-transformation work. Scope: architecture, database, backend, frontend,
Telegram/WhatsApp channels, security, testing, DevOps, documentation.

## 1. Current architecture (as found)

```
Website (Vite + React 18, react-router; Vercel)
  └─ src/lib/api/client.ts → Supabase Edge Function `api` (Deno, hosted backend)
Telegram (@esamadhanbot) → same Edge Function (POST /api/v1/telegram/webhook)
WhatsApp (Cloud API)     → local FastAPI webhook only (not deployed)
FastAPI (backend/)       → local dev + pytest harness (same contract, raw psycopg2)
Database                 → Postgres (Supabase); migrations 001–010 are the schema truth;
                           all writes/reads via SQL RPCs (app_*), service-role only
Evidence                 → Supabase Storage bucket `evidence` (private)
Auth                     → Clerk JWT (website users) + shared ADMIN_API_TOKEN (staff)
ML slots                 → Groq vision (ticket photos), Sarvam STT (voice) — optional
Hosting                  → Vercel (frontend), Supabase (API + DB + cron SLA sweep)
```

Domain: **public-transport grievance management for KSRTC** — passengers file
complaints (9 categories) via web, Telegram, WhatsApp or voice; complaints route to
depots through a 5,881-alias dataset, get reference IDs (`SAM-YYYY-NNNNNN`
canonical since migration 013; `KSRTC-YYYY-XXXXXX` legacy rows still resolve), SLA
deadlines, status lifecycle (`submitted → in_review/needs_triage/escalated →
resolved → closed`), and appear on an anonymised public dashboard + staff admin.

Key structural facts:

- Business logic for filing is **duplicated** across three runtimes: Postgres RPC
  `app_file_complaint` (v1→v5 across migrations 005/006/007/009/010 — authoritative),
  FastAPI `services/complaints.py`, and inline handlers in the Edge Function.
- Telegram conversation state lives in `telegram_conversations` (Postgres, RPC-backed,
  atomic `tg_conv_claim` for double-tap protection) — good. WhatsApp flow state is
  **in-memory Python dicts** (`whatsapp_flow._conversations`) — single-process only.
- Reference IDs: DB-side `app_reference_id()` (crypto-random, retry-on-collision,
  regex-validated `chk_complaint_ref`), FastAPI-side `services/reference.py`
  (same format, separate implementation). Frontend never generates them. ✔
- `updated_at` trigger, status-transition trigger, SLA sweep (`app_sla_sweep`,
  pg_cron) exist from migration 003/005. ✔

## 2. Baseline verification (before changes)

- `pytest -q` (backend, no live DB): **41 passed**.
- `npm run build` (frontend): succeeds; bundle **598 kB / 163 kB gzip** (one chunk,
  warning emitted). `npm run typecheck`: **script missing** (see F-1).
- Local uncommitted work (preserved, not discarded): Infisical secrets workflow
  (docs + package.json + .env.example), WhatsApp guided flow
  (`services/whatsapp_flow.py` + webhook wiring + tests), Groq base64 chunking fix
  (`supabase/functions/api/index.ts`). All coherent and additive.

## 3. Findings

Severity: CRITICAL / HIGH / MEDIUM / LOW. Category tags: [Architecture] [Security]
[Database] [Backend] [Frontend] [UX] [Testing] [DevOps] [Documentation].

### CRITICAL

**C-1. [Security] Chat-keyed account endpoints have no authentication (IDOR).**
- Location: `supabase/functions/api/index.ts` — `GET /api/v1/my/complaints`,
  `GET /api/v1/my/trips`; DB: `app_my_complaints` / `app_my_trips` (migration 008);
  frontend: `MyAccount.tsx` chat panel, `complaintsService.getStoredChatId()`.
- Problem: `chat_id` is a **client-supplied query parameter**; the handler never
  verifies the caller owns that chat. Anyone can enumerate chat IDs and read
  strangers' complaint history, routes, depot, status. The migration header
  acknowledges "self-service chat_id in future Supabase Auth" — that future is now.
- Impact: privacy breach of complaint data across all users; trivially scriptable.
- Fix: server-side session binding — store the chat link in localStorage under a
  random token, or (better) bind chat→user at Clerk sign-in and only serve
  `chat_id` derived from a verified identity; else require a per-chat secret
  (HMAC) issued when the bot links the account. FastAPI-side Telegram
  `/webhook` `/track` is a public by-design lookup (reference ID is the capability,
  unguessable at 36^6) — acceptable; chat-keyed *history* is not.
- Priority: do first. Testing: negative tests (wrong chat → 403).

**C-2. [Security] WhatsApp webhook is unauthenticated.**
- Location: `backend/app/api/v1/whatsapp.py` `POST /webhook`.
- Problem: no `X-Hub-Signature-256` HMAC check against `WHATSAPP_APP_SECRET`.
  Anyone who finds the URL can forge inbound messages and file complaints /
  trigger outbound WhatsApp sends (message cost + spam via the linked number).
  Telegram webhook checks its secret; WhatsApp does not. GET verify also accepts
  any token when `WHATSAPP_VERIFY_TOKEN` is unset (documented "local demo"), but
  nothing forces it to be set in a deployed env.
- Fix: implement HMAC-SHA256 signature verification (timing-safe compare), fail
  closed when the secret is configured; document `WHATSAPP_APP_SECRET` in
  `.env.example`.
- Testing: unit tests for valid/invalid/missing signature.

**C-3. [DevOps] CI frontend job fails: `typecheck` script referenced but absent.**
- Location: `.github/workflows/ci.yml` runs `npm run typecheck` in `frontend/`;
  `frontend/package.json` (modified, uncommitted) defines only `dev`, `dev:local`,
  `build`. CI has been red since that change.
- Fix: add `"typecheck": "tsc -b --noEmit"` (or run `tsc -b` without emit) to
  package.json; verify locally; keep CI green thereafter.

### HIGH

**H-1. [Security] Cross-origin API is fully open (`Access-Control-Allow-Origin: *`).**
- Location: Edge Function `json()` helper + OPTIONS preflight.
- Problem: any website can call all endpoints from a browser (staff token in a
  browser is out of scope, but Clerk-JWT endpoints — `/api/v1/me`, complaint
  filing with identity — accept Authorization headers regardless of origin).
  No cookies are used today, which limits exploitability, but once sessions/cookies
  appear this becomes credential CSRF. It also lets third-party sites embed
  Samadhan's API silently.
- Fix: allow-list origins (`Vercel` prod domain, `localhost:3000`) via
  `FRONTEND_URL`/`SITE_URL` function secrets; wildcard only for webhook paths
  (Telegram doesn't send Origin). Keep `Allow-Headers` minimal.

**H-2. [Backend] Telegram file/photo uploads unbounded → unbounded memory + cost.**
- Location: `supabase/functions/api/index.ts` `tgDownloadFile` + `storeEvidence`;
  comment admits "20 MB bot cap" but nothing checks it; photo `file_size` from the
  update is **never consulted**; documents pass only a MIME check.
- Impact: a crafted/looping bot could pull large files into function memory
  (Edge Functions have tight memory limits → 5xx), store junk in the evidence
  bucket, and burn Groq tokens on huge images (base64 body).
- Fix: enforce size limits from `getFile` metadata before download; reject
  non-allowlisted MIME types server-side (already partly done for web uploads via
  `handleUpload`, mirror it here); reuse `handleUpload` validation logic.

**H-3. [Database] No complaint→user table-level linkage index / audit history.**
- Location: `complaints` (migration 001 + 010 `user_id`, `telegram_chat_id`).
- Problem: (a) `complaints.user_id` / `telegram_chat_id` have no indexes —
  "my complaints" queries and analytics per-user will scan; (b) there is no
  audit-log table for *actions* (status changes are captured in `status_history`,
  but evidence uploads, admin analytics access, webhook receipt events are not
  auditable).
- Fix: add indexes (`complaints(user_id)`, `complaints(telegram_chat_id)`); add
  `audit_log(id, actor_type, actor_id, action, entity_type, entity_id, detail
  jsonb, request_id, created_at)` + write points in Edge/FastAPI service layer
  (not triggers) for: complaint_filed, evidence_uploaded, status_changed (mirrors
  status_history), webhook_received, notification_sent.
- Testing: query-plan check (EXPLAIN uses index); audit rows written on each event.

**H-4. [Architecture] Three divergent filing implementations.**
- Location: `app_file_complaint` (RPC), `backend/app/services/complaints.py`,
  Edge Function inline Telegram legacy path + WhatsApp flow's `file_complaint`.
- Problem: rules drift (e.g. RPC treats missing route by falling to
  needs_triage; FastAPI raises ValueError when neither route_id nor route_text;
  WhatsApp flow maps `route:skip` to `route_text: 'Telegram'` — a magic sentinel
  value living in the Edge Function too). A fix must be applied three times.
- Fix (incremental, not a rewrite): declare the **Postgres RPC the single source
  of truth** (it already has the strongest validation); align FastAPI's
  `file_complaint` to delegate to the RPC when a DB is reachable (it can call the
  function directly — same connection, no HTTP), keeping the Python path only as
  a test harness; remove the Edge Function's pipe-format inline filing in favour
  of the same RPC (already done — it calls `app_file_complaint`; document it).
  Kill the `'Telegram'` sentinel → use NULL + a `source_channel` column
  (see H-5).
- Testing: contract tests asserting identical outcomes for identical inputs
  across paths.

**H-5. [Database] Complaint source channel is implicit.**
- Location: `complaints` table.
- Problem: `telegram_chat_id` presence is the only hint of Telegram origin; web
  uploads vs bot vs WhatsApp can't be distinguished in analytics; `route_text =
  'Telegram'` sentinel pollutes route data.
- Fix: `ALTER TABLE complaints ADD COLUMN source_channel text NOT NULL DEFAULT
  'web' CHECK (source_channel IN ('web','telegram','whatsapp','voice','api'))`;
  populate from all filing paths; include in dashboards.
- Testing: unit tests per channel; dashboard grouping test.

**H-6. [Testing] No failure-path or security tests; no E2E.**
- Location: `backend/tests/` (41 tests, mostly happy-path + parse units).
- Gaps: no test that a forged WhatsApp webhook is rejected (after C-2), no test
  for oversized files (after H-2), no test for double-submit idempotency on the
  RPC path (`tg_conv_claim` is untested at the DB level — tested indirectly only),
  no browser E2E for register→file→track→refresh, no cross-channel test
  (Telegram-created → visible via web track + same reference).
- Fix: add pytest security tests + DB-level idempotency tests; add a Playwright
  E2E skeleton gated behind a `RUN_E2E=1` env (runs against local stack; CI can
  run the web flow with a stub API initially).
- Testing: the tests themselves; CI runs them.

**H-7. [UX] Track page refresh history + duplicate-submission UX.**
- Location: `frontend/src/pages/TrackComplaint.tsx`, `ReviewComplaint.tsx`,
  `FileComplaint.tsx`.
- Problem: (a) tracking relies on one fetch with a 15 s timeout and no retry/backoff;
  (b) submit double-click protection is ad-hoc (button disable only; a double POST
  creates two complaints with different reference IDs); (c) no offline state.
- Fix: idempotency key header (`X-Idempotency-Key: uuid`) generated once per draft
  and honoured by `app_file_complaint` (new `p_idempotency_key` + unique partial
  index → same key returns the original complaint); client-side disable + retry
  messaging; exponential backoff on track fetches.
- Testing: double-submit test at the API layer (same key → same reference ID).

### MEDIUM

**M-1. [Frontend] 598 kB single-chunk bundle.** Route-level code splitting
(`React.lazy` for admin routes + voice) and `build.chunkSizeWarningLimit` tuning
would cut initial payload ~40%. Verify with `vite build` output before/after.

**M-2. [Documentation] README/docs describe the hackathon MVP, not the current
system** (Clerk auth, Telegram ticket-first flow, analytics, Edge-Function hosting
model are undocumented or scattered in PROJECT_STATUS.md). Rewrite README; add
TARGET_ARCHITECTURE, API_GAPS, KNOWN_LIMITATIONS, DATABASE_ARCHITECTURE,
workflow docs (complaint/telegram/ticket lifecycle), OBSERVABILITY.

**M-3. [Backend] Request IDs / structured logging absent** in FastAPI and the Edge
Function logs raw errors with no correlation ID. Add middleware (FastAPI) and a
wrapper (Deno) that assigns `X-Request-Id` (accept inbound or generate), logs JSON
lines, and never logs tokens/phones. Document in OBSERVABILITY.md.

**M-4. [Backend] Rate limiting absent** on `/api/v1/complaints`, `/uploads`,
`/voice/transcribe`, `/auth/login`. Supabase has platform limits; add a cheap
per-IP token bucket in the Edge Function (Deno KV or in-memory per isolate) and
document the platform-level config. Login endpoint: constant-time compare already
used ✔; add attempt throttling.

**M-5. [Database] `status_history.changed_by` is free text**, no FK to
`app_users`. Acceptable short-term (channels differ), but add `changed_by_user_id
uuid REFERENCES app_users(id)` alongside and populate from admin paths.

**M-6. [Frontend] Admin pages poll every 5–15 s unconditionally** (visible when
tab hidden). Pause polling on `document.hidden`, use `visibilitychange` to refresh
on return. Cuts requests ~90% for idle staff tabs.

**M-7. [WhatsApp] Guided flow loses state on process restart** (in-memory store).
Documented in-code; long-term fix is the Postgres store (mirror 006). For now:
document in KNOWN_LIMITATIONS, keep the seam (four helpers) so the swap is
mechanical.

**M-8. [Security] `app_my_complaints`/`app_my_trips` exist as service-role
functions with no caller binding** — the functions themselves are fine (GRANTed
only to service_role); the binding must happen in the Edge Function (see C-1).
Add a comment in the migration documenting the contract.

**M-9. [DevOps] No deployment docs for the Edge Function** (deploy command lives
in PROJECT_STATUS prose). Add `docs/operations/DEPLOYMENT.md`: Vercel envs,
Supabase function deploy, secrets list, webhook registration scripts, rollback.

### LOW

**L-1. [Frontend] Dead/duplicated UI primitives** (Button/Input/Card/Badge/Modal
exist once — good; ensure new screens reuse them; no action beyond a lint rule
note in TARGET_ARCHITECTURE).
**L-2. [Docs] `docs/API.md` still lists 501 TODO endpoints** that now exist.
Regenerate from the router + Edge Function (single API.md source).
**L-3. [Backend] `test_foundation.py` asserts reference format only; add
uniqueness-under-load test** (1,000 generations → all distinct, correct format).
**L-4. [UX] Public dashboard has no data freshness indicator** ("updated X s ago"
footer on poll).

## 4. What is already good (do not break)

- Postgres RPC-centric API with deny-by-default grants, RLS on state tables,
  status-transition enforcement, `updated_at` triggers, SLA matrix seeding.
- Reference ID generation is server-side, collision-safe, regex-checked.
- Telegram conversation state is DB-backed with atomic claim (double-tap safe),
  cancel-safe UX, ticket-first extraction with fail-soft ML slots.
- Evidence stored in private object storage with metadata rows; Telegram files
  re-verified by download (MIME from actual bytes).
- Clerk JWTs cryptographically verified (JWKS), never decode-and-trust; staff
  token compares are constant-time; endpoints fail closed (503) when unconfigured.
- `.env.example` is names-only; no secrets tracked in git (verified via
  `git ls-files`); `.gitignore` covers env/venv/node/dist.

## 5. Transformation order (derives from this audit)

1. C-3 (unbreak CI) → C-2 (WhatsApp HMAC) → C-1 (bind chat endpoints) — security
   first, smallest surface first.
2. H-2/H-4/H-5/H-7 hardening + `source_channel` migration + idempotency key.
3. H-3 audit log + indexes; M-3 request IDs; M-4 rate limits.
4. Frontend: M-1 code splitting, M-6 polling hygiene, H-7 UX polish.
5. Testing: H-6 (security, idempotency, E2E skeleton) before refactors rely on it.
6. Docs (M-2/M-9/L-2) last, describing the system as it now is.
7. Each phase: run pytest + build locally, commit with a conventional message,
   push, verify remote.
