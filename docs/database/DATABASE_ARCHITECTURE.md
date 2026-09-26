# Database Architecture

Postgres (Supabase). Migrations in `database/migrations/` are the single source
of truth; apply in numeric order (001→011). All application access flows through
RPCs granted to `service_role` only; the Edge Function and FastAPI harness are
the only callers. RLS is enabled on state tables and denies by default.

## Table map

| Table | Purpose | Key constraints |
|---|---|---|
| `depots`, `routes`, `route_depot_mapping` | KSRTC dataset (5,881 aliases; VERIFIED/PROBABLE) | unique external ids; mapping PK (route, depot) |
| `sla_rules` | 36-combo category×priority SLA matrix | unique (category, priority), positive hours |
| `complaints` | the grievance record | `chk_complaint_ref` regex on reference_id; status CHECK; priority CHECK; route_id-or-route_text; `source_channel` CHECK (011); `idempotency_key` format CHECK + unique partial index (011) |
| `status_history` | per-complaint status timeline | from/to CHECKs; RESTRICT delete |
| `evidence` | file metadata (bytes in Storage) | telegram_file_id; size bounds enforced at RPC |
| `passengers`, `trips` | bot account linking, saved trips | chat-keyed; trip use counts |
| `telegram_conversations` | bot flow state | chat PK; `tg_conv_claim` atomic transition |
| `app_users` | unified identity (Clerk ↔ bot) | unique auth_user_id / telegram_chat_id / email / phone |
| `import_runs` | dataset import provenance | per-run log |
| `audit_log` (011) | who/what/when for consequential actions | actor_type CHECK; entity + request_id indexes; service_role INSERT/SELECT only |

## Reference IDs

`app_reference_id()` — `SAM-YYYY-NNNNNN` (canonical, migration 013): per-year
counter table read under a row lock, zero-padded 6 digits, sequential and
collision-free by construction. DB-enforced: `UNIQUE(reference_id)` +
`chk_complaint_ref` regex accepting both this and legacy `KSRTC-YYYY-XXXXXX`.
FastAPI's Python generator exists only for tests and mirrors the format.

## Ticket lifecycle (enforced in DB)

Trigger `enforce_status_transition` (003) rejects illegal moves:

```
submitted   → in_review | needs_triage | escalated
needs_triage→ in_review | escalated
in_review   → resolved | escalated | closed
escalated   → in_review | resolved | closed
resolved    → closed
closed      → (terminal)
```

Every transition is written to `status_history` by the writer path; `updated_at`
is trigger-maintained; `app_sla_sweep` (pg_cron) flags `sla_breached`.

## Filing RPC (`app_file_complaint`, v6 in 011)

One transaction: validate category/priority/description/route/evidence →
resolve route→depot (`app_resolve_route`; ambiguous corridors fall to
needs_triage, never a guess) → compute SLA → idempotency replay check →
insert complaint (+ `source_channel`, `idempotency_key`) → evidence rows →
initial status_history → return reference id, status, depot, SLA due.
Duplicate idempotency keys return the original complaint (`idempotent_replay:
true`) instead of creating a row; a race on the unique index is absorbed in
the retry handler.

## Identity model

`app_ensure_user` (Clerk sign-in) merges identities: by auth id, then email,
then phone — so a bot user who later signs in on the web with the same email
gains `telegram_chat_id` on their `app_users` row and sees bot complaints in
`/api/v1/me`. Chat-keyed reads (`app_my_complaints/trips`) accept an optional
`p_owner_chat_id` that must match, enforced server-side (011).

## Access control summary

- `anon`, `authenticated`: no table grants; no RPC execute (deny by default).
- `service_role`: all `app_*` / `tg_*` functions; `audit_log` insert+select.
- Staff/admin: shared `ADMIN_API_TOKEN` (constant-time compare) or Clerk JWT
  with `public_metadata.role = admin`.

## Operational notes

- Migrations are plain SQL, re-runnable where marked; 011 is additive and
  deploy-order-safe (deprecated default-arg call shapes keep working).
- Direct DB host is IPv6-only; use the pooler session-mode URL (see
  PROJECT_STATUS.md) for migrations and tests alike.
- Backups: Supabase daily PITR on the project (verify retention in the
  dashboard); `import_runs` + `audit_log` make re-derivation possible.
