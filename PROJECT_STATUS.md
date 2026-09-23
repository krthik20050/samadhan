# Project status

- **Current phase:** CORE MVP IMPLEMENTATION
- **Status:** DATASET CONNECTED — full loop live (submit → resolve → track → dashboard)
- **Frontend prod:** https://frontend-ruddy-seven-46.vercel.app (Vercel, auto-linked to GitHub krthik20050/samadhan; API calls need public backend URL — pending backend deploy)

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
