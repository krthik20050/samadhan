# What We Are Doing

A plain-language inventory of the production-readiness transformation — what
changed, where, and how each change is verified. For the reasoning behind each
decision see [WHY_WE_DID_IT.md](WHY_WE_DID_IT.md); for stakeholder framing see
[WHY_THIS_MATTERS.md](WHY_THIS_MATTERS.md); for what comes next see
[FUTURE_SCOPE.md](FUTURE_SCOPE.md).

## 1. One filing pipeline (all channels)

**What:** Every channel — website, Telegram, WhatsApp, voice — files complaints
through the same Postgres RPC (`app_file_complaint`, v6). The FastAPI harness
no longer re-implements validation; it delegates.
**Where:** `database/migrations/011`, `backend/app/services/complaints.py`,
`supabase/functions/api/index.ts`.
**Verified:** 52-test suite incl. live-DB depot routing; duplicate-submit test.

## 2. Reference IDs stay server-issued and provably unique

**What:** `app_reference_id()` (`SAM-YYYY-NNNNNN`, canonical — migration 013
per-year counter), DB-enforced unique + dual-format regex constraints.
**Where:** migrations 005/011/013; `backend/app/services/reference.py` (tests only).
**Verified:** `test_reference_id.py` — 1,000 generations, all unique, format-checked.

## 3. Idempotent submission (no duplicate complaints)

**What:** The web form sends `X-Idempotency-Key` (one key per draft). A
replayed key returns the *original* complaint instead of creating a second one.
Telegram already had atomic claim (`tg_conv_claim`); WhatsApp submit is guarded
the same way.
**Where:** migration 011 (`idempotency_key` + unique partial index + replay
path), `frontend/src/context/ComplaintDraftContext.tsx`,
`frontend/src/pages/ReviewComplaint.tsx`, `complaintsService.ts`.
**Verified:** live double-submit → same reference ID;
`test_e2e_journey.py::test_full_website_journey_submit_duplicate_track`.

## 4. Audit trail + request correlation

**What:** `audit_log` records who did what to which entity, with the request ID
from the API response. Status changes are audited inside the status RPC.
**Where:** migration 011 (`audit_log`, `app_audit_log`), 012 (`status_changed`
audit rows), Edge Function (web/telegram filings, uploads), FastAPI service.
**Verified:** audit rows asserted in `test_status_writes.py` and the E2E journey.

## 5. Security hardening

| Change | Where | Verified by |
|---|---|---|
| Chat-keyed account data bound to a verified identity (IDOR closed) | Edge Function `verifiedChatId()`; `p_owner_chat_id` guard in RPCs (011) | deploy-pending; RPC guard live |
| WhatsApp webhook HMAC (`X-Hub-Signature-256`, fail closed) | `backend/app/api/v1/whatsapp.py` | `test_whatsapp_security.py` (5 tests) |
| CORS pinned to `SITE_URL` (safe fallback), preflight matches responses | Edge Function `json()` + OPTIONS handler | manual after deploy |
| Telegram downloads size-capped *before* fetch (20 MB) | `tgDownloadFile` | code path + manual |
| Staff endpoints fail closed (503 without token), constant-time compare | `core/auth.py`, Edge `requireStaff*` | existing tests |

## 6. Ticket lifecycle writes (staff)

**What:** Depot staff can advance complaints — `POST
/api/v1/complaints/{ref}/status` — with the transition map enforced in the RPC
(mirroring the DB trigger), notes recorded, passenger-visible history, and
idempotent same-state writes.
**Where:** migration 012 (`app_set_status`, `app_status_history`,
`app_track_complaint` note fix), Edge Function routes, FastAPI routes,
`complaintsService.updateStatus` (was a stub), admin modal error state.
**Verified:** live RPC matrix (legal/illegal/terminal/idempotent);
`test_status_writes.py` — 5 tests: auth, 404, 422, happy path + history +
audit, staff-only history.

## 7. Channel provenance

**What:** Every complaint records `source_channel`
(web/telegram/whatsapp/voice/api) — analytics can finally split channels.
**Where:** migration 011; filing paths stamp it.
**Verified:** E2E journey asserts `source_channel = 'web'`.

## 8. Passenger-visible operator notes

**What:** The public track timeline now includes the depot's note ("crew
counseled, bay cleaned"), closing the silent-status gap identified in UX
research.
**Where:** migration 012 (`app_track_complaint`), FastAPI track query +
`HistoryItem` schema, frontend timeline mapping.
**Verified:** asserted in `test_status_writes.py`.

## 9. UX + performance

- Two-step Cancel in both bots (a stray tap cannot destroy a draft).
- Visibility-aware polling (tabs pause; refresh on return).
- Code splitting: main bundle 598→484 kB (admin/voice/login/dashboard load on
  demand).
- Every submit retry-safe; error states human-readable ("That status change is
  not allowed…" instead of a raw 422).

## 10. Documentation suite

`docs/architecture/` (audit, target architecture, API gaps, known limitations),
`docs/database/`, `docs/workflows/` (complaint, Telegram, ticket lifecycle),
`docs/operations/` (deployment runbook, observability), `docs/product/`
(UX research), and the four documents you are reading now, indexed in
`docs/INDEX.md`.
