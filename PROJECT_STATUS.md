# Project status

- **Current phase:** CORE MVP IMPLEMENTATION
- **Status:** BACKEND LIVE ON SUPABASE — Edge Function + RPCs; Telegram bot wired (@esamadhanbot)
- **API base (hosted):** https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api
- **Frontend prod:** https://frontend-ruddy-seven-46.vercel.app (set VITE_API_URL to the API base above in Vercel)

## Hosting model (Supabase-only)

- Logic lives in Postgres RPCs: `database/migrations/005_supabase_rpcs.sql`
  (file/track/lookups/summary/staff list, `app_route_text_od_key` reuses the
  migration-004 normalizer chain, `app_sla_sweep` scheduled via pg_cron when enabled).
- One Edge Function routes HTTP: `supabase/functions/api` (Deno/supabase-js,
  service-role only, staff Bearer + Telegram secret enforced, CORS *, FastAPI-compatible shapes).
- Deploy: `npx supabase functions deploy api --project-ref ikipstqlumypppfypdrx`
  (needs SUPABASE_ACCESS_TOKEN); secrets via `supabase secrets set`.
- Telegram webhook: registered to `<api>/api/v1/telegram/webhook` with secret header
  (`backend/scripts/setup_telegram_webhook.py info` to inspect).
- Render (`grievance-api`) is redundant — safe to pause/delete.
- FastAPI (`backend/`) remains the local-dev + pytest harness (37 tests, same contract).

## Dataset integration (this change)

- `database/migrations/004_lookup_hardening.sql`: `route_aliases` table,
  `routes.od_match_key` (trigger-maintained canonical OD key, SQL port of the
  dataset normaliser incl. alias table), depot email/zone/pincode,
  `import_runs` provenance table.
- `backend/scripts/import_dataset.py`: idempotent COPY-based import of
  `../dataset/data/final/*.csv` (depots, routes, VERIFIED+PROBABLE mappings,
  5,881 aliases); run log recorded per import.
- Route resolution now matches passenger spellings: `'Guruvayoor to
  Kozhikode'` → dataset route `'Guruvayur - Kozhikode'` → VERIFIED depot.
  Colliding canonical corridors (e.g. published as both 'X - Ernakulam' and
  'X - Kochi') resolve only when exactly one candidate has a VERIFIED depot,
  else fall to needs_triage (never a guess).
- `GET /api/v1/routes` + `GET /api/v1/depots` are live (search + bounded
  limits) and power the complaint-form stop suggestions; frontend gained
  `lookupService` with offline fallback to the static stop list.

## Completed

- **Accounts + analytics (this change):** Clerk user auth (Google/email) on the
  website, `app_users` + `complaints.user_id` ownership (migration 010),
  `GET /api/v1/me` account panel, `GET /api/v1/admin/analytics`
  (received/pending/in-review/escalated/urgent/district/depot), admin
  dashboard + My Account rebuilt on them. Setup: `docs/AUTH_SETUP.md`.
- Repo structure, `.gitignore`, `.env.example`
- Docs: ARCHITECTURE, DATABASE, API, DEVELOPMENT, PROJECT_CHECKLIST, DEMO, DECISIONS
- FastAPI foundation (`GET /health`, config, schemas, reference-ID service, tests)
- Next.js foundation (/, /complain, /track, /dashboard shells, typed API client)
- Migrations `001` (schema) + `002` (full 36-combo SLA matrix) + `003` (hardening)
- Expert DB review (security auditor + schema architect): RLS deny-by-default,
  status-transition trigger, audit-survival FKs, data guards, composite indexes
- CI workflow (backend pytest, frontend typecheck/build)

## Current / next task

1. Point `DATABASE_URL` at Supabase, run migrations 001+002.
2. Import real depots/routes/mappings (`database/seeds/README.md`).
3. Implement `POST /api/v1/complaints` (Phase 3).

## Blockers / needs input

- Supabase project + `DATABASE_URL` (who creates it?)
- Confirm demo SLA hours in `002_seed_sla_rules.sql` are acceptable placeholders.

## Known issues / debt

- Direct DB host is IPv6-only and unreachable from this machine; using the
  pooler session-mode connection (`:5432`) for migrations and app alike.
- v1 endpoints return 501 TODOs by design (see `docs/API.md`).
- No SQLAlchemy models yet; raw SQL migrations are the source of truth.
- Test complaint rows were inserted during verification but rolled back —
  production tables are clean (dashboard view: 0 rows).

## Stretch (explicitly deferred)

Voice/STT, AI extraction, WhatsApp/Telegram, OCR/QR, duplicates/trends, i18n.
