# Public Transport Grievance Management — Hackathon MVP

Passengers report issues (cleanliness, unsafe driving, overcrowding, missed
stops, concession denial). Today those reports are informal and untrackable.
This system gives them a <60s complaint form with a reference number,
automatic depot routing, SLA tracking, escalation, and an anonymised dashboard.

## MVP scope (must have)

- Web complaint form -> validate -> route->depot -> SLA -> Postgres
- Reference ID + status tracking
- SLA breach + escalation
- Anonymised management dashboard (no phone/identity/exact home location)

## Future (stretch, pluggable adapters — never core)

Voice + Sarvam STT, LLM extraction, WhatsApp/Telegram, ticket OCR/QR,
duplicate/trend detection, multilingual, notifications.

## Architecture

```
Web form ──┐
WhatsApp ──┼──> Complaint API (FastAPI) ──> validate ──> route→depot ──> SLA ──> Postgres
Voice ─────┘                                  (AI/voice/chat are adapters, never core)
```
Details: `docs/ARCHITECTURE.md`. Decisions: `docs/DECISIONS.md`.

## Tech stack

Next.js 14 + TypeScript + Tailwind · FastAPI + Pydantic · PostgreSQL (Supabase)

## Repo structure

```
├── frontend/            # Next.js app (/, /complain, /track, /dashboard)
├── backend/app/         # FastAPI: main, api/v1, core, schemas, services (+models in Phase 1)
├── backend/tests/       # pytest
├── database/migrations/ # 001 schema, 002 SLA seeds
├── database/seeds/      # KSRTC import guide (real data in ../dataset/data/final/)
└── docs/                # ARCHITECTURE DATABASE API DEVELOPMENT PROJECT_CHECKLIST DEMO DECISIONS
```

## Local setup

```powershell
copy .env.example .env            # fill DATABASE_URL (and Supabase when ready)
```

Backend:
```powershell
cd backend
py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
# health: http://localhost:8000/health (needs no DB/keys)
```

Frontend:
```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev                        # http://localhost:3000
```

Database:
```powershell
psql $env:DATABASE_URL -f database/migrations/001_initial_schema.sql
psql $env:DATABASE_URL -f database/migrations/002_seed_sla_rules.sql
# then import real KSRTC depots/routes — see database/seeds/README.md
```

Tests: `cd backend; pytest -q`. Frontend checks: `npm run typecheck`, `npm run build`.

## Status

Foundation created (see `PROJECT_STATUS.md`). Next: Phase 1 DB import + Phase 3
`POST /api/v1/complaints`. Full task list: `docs/PROJECT_CHECKLIST.md`.
