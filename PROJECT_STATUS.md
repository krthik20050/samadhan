# Project status

- **Current phase:** CORE MVP IMPLEMENTATION
- **Status:** FULL LOOP LIVE (submit → track → dashboard) — next: SLA breach checker + escalate (Phase 6)

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
