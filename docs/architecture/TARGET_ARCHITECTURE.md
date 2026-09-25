# Target Architecture

Where Samadhan is going. Written 2026-09-25; derives from `AUDIT.md` §5 and the
current stack (do not force a rewrite onto this shape — evolve incrementally).

## Architectural stance

**Modular monolith, RPC-centric.** One Postgres database, one Edge Function,
one website. The module boundaries are (a) Postgres schemas of RPCs per domain,
(b) the service layer in each runtime that calls them. No microservices, no
message queues until a measured need appears. The FastAPI app is the local-dev
and pytest harness for the same contract, not a second production backend.

```
                ┌───────────────────────────────┐
   Web (Vite) ──►                               │
   Telegram ────►  Edge Function `api` (Deno)   ├──► Supabase Storage (evidence)
   WhatsApp ────►  thin adapters: auth, CORS,   │
   Voice/ML ────►  rate limits, audit, webhook  │
                └───────────────┬───────────────┘
                                │ RPCs (service_role only)
                                ▼
                ┌───────────────────────────────┐
                │ Postgres — domains as RPCs    │
                │  filing:   app_file_complaint │
                │  tracking: app_track_complaint│
                │  accounts: app_me, app_users  │
                │  chats:    tg_conv_*, tg_trip_│
                │  audit:    app_audit_log      │
                └───────────────────────────────┘
```

## Rules that keep it trustworthy

1. **One filing pipeline.** `app_file_complaint` is the only place a complaint
   row is born. FastAPI's `services/complaints.py` delegates to it (same DB,
   same validation). No channel re-implements validation, routing, SLA or
   reference-ID issuance.
2. **Reference IDs are server-issued.** `app_reference_id()` + unique index +
   regex check. Frontends display; they never mint.
3. **Identity is verified, never assumed.** Clerk JWTs via JWKS; chat-keyed
   reads bound to the verified owner (`p_owner_chat_id` guard); staff via
   constant-time shared secret; WhatsApp webhooks via HMAC signature.
4. **Idempotency at every entry point.** Web: `X-Idempotency-Key` per draft.
   Telegram: `tg_conv_claim` atomic state claim. Webhooks: signature + 200-fast.
5. **Everything consequential is auditable.** `audit_log` rows from the service
   layer with request IDs; `status_history` remains the per-complaint timeline.
6. **Fail soft outward, fail loud inward.** User-facing errors are plain
   sentences; logs are structured JSON with request IDs; ML slots degrade.

## Domain map (current → owner)

| Domain | Owner | Notes |
|---|---|---|
| Filing | `app_file_complaint` (Postgres) | v6: + source_channel, idempotency |
| Reference IDs | `app_reference_id` | crypto-random, collision-retried |
| Routing | `app_resolve_route` + dataset tables | alias-normalised OD matching |
| SLA | `sla_rules` + `app_sla_sweep` (pg_cron) | breach flagging |
| Lifecycle | `enforce_status_transition` trigger | DB-enforced transitions |
| Tracking | `app_track_complaint` | allowlisted fields only |
| Accounts | `app_users`, `app_ensure_user`, `app_me` | Clerk ↔ bot identity merge |
| Chat state | `telegram_conversations` + `tg_conv_*` | atomic claim, cancel-confirm |
| Evidence | `evidence` + Storage bucket | private, metadata-in-DB |
| Audit | `audit_log` + `app_audit_log` | who/what/when/request-id |
| Lookups | `app_list_routes`, `app_list_depots` | bounded limits |

## Frontend shape

- Core journey (Home → File → Review → Success → Track → Account) in the
  initial bundle; voice/dashboard/login/admin code-split (M-1 done).
- One API client (`lib/api/client.ts`) with auth-token injection, timeouts,
  BackendUnavailable typing; services per domain. Server state stays local to
  pages with visible-state polling (M-6 done); do not introduce a global store
  until a second consumer of the same server state exists.
- Design tokens via CSS variables; primitives in `components/common/*` are the
  only sanctioned Button/Input/Card/Badge/Modal.

## Explicitly deferred (do not build yet)

- Separate admin/authority portal with RBAC roles beyond passenger/admin.
- Queue-based processing, per-channel microservices, event bus.
- ORM/SQLA models in FastAPI (raw RPC calls keep the harness thin).
- Multi-region, read replicas, CDN-sharded storage.
