# Development

## Prerequisites

- Node 20+ (`node --version`), npm 10+
- Python 3.11+ (`py --version` on Windows)
- PostgreSQL connection string (local Postgres or Supabase). MVP runs
  without a live DB for `/health`, but complaint endpoints need it.

## Backend setup

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example ..\.env   # then fill DATABASE_URL / SUPABASE_URL
py -m uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health — no DB or API keys needed.

## Frontend setup

```powershell
cd frontend
npm install
copy .env.example .env.local   # or create with NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000.

## Database setup

1. Create DB (Supabase dashboard or `createdb grievance_mvp`).
2. Run migrations in order:
   ```powershell
   # psql example
   psql $env:DATABASE_URL -f database/migrations/001_initial_schema.sql
   psql $env:DATABASE_URL -f database/migrations/002_seed_sla_rules.sql
   ```
3. Import real KSRTC data (see `database/seeds/README.md`):
   depots/routes/mappings from `../dataset/data/final/*.csv`.

## Tests

```powershell
cd backend
pytest -q
```

Frontend: `npm run typecheck` (tsc) and `npm run build` (also typechecks + lints).

## Troubleshooting

- `uvicorn not found` -> venv not activated or requirements not installed.
- `/health` works but complaint endpoints 500 -> `DATABASE_URL` missing/wrong.
- Frontend `fetch failed` -> backend not on `:8000` or `NEXT_PUBLIC_API_URL` wrong.
- DB connection refused on Supabase -> check connection string uses the
  `postgres` user + correct password, and IP allow-list if enabled.
