# Development

## Prerequisites

- Node 20+ (`node --version`), npm 10+
- Python 3.11+ (`py --version` on Windows)
- PostgreSQL connection string (local Postgres or Supabase). MVP runs
  without a live DB for `/health`, but complaint endpoints need it.
- Infisical CLI (`infisical --version`; `winget install infisical`) and access
  to the team project — values live there, not in a `.env` file. See
  `INFISICAL.md`.

## Backend setup

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
infisical run --env=dev -- py -m uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health — no DB or API keys needed.

## Frontend setup

```powershell
cd frontend
npm install
npm run dev          # wraps: infisical run --env=dev -- vite
npm run dev:local    # same, without the CLI on your PATH
```

Open http://localhost:3000.

## Database setup

1. Create DB (Supabase dashboard or `createdb grievance_mvp`).
2. Run migrations in order:
   ```powershell
   # psql example
   infisical run --env=dev -- psql $env:DATABASE_URL -f database/migrations/001_initial_schema.sql
   infisical run --env=dev -- psql $env:DATABASE_URL -f database/migrations/002_seed_sla_rules.sql
   ```
3. Import real KSRTC data (see `database/seeds/README.md`):
   depots/routes/mappings from `../dataset/data/final/*.csv`.

## Tests

```powershell
cd backend
infisical run --env=dev -- pytest -q
```

Most tests need no secrets; the ones that touch the live DB need
`DATABASE_URL`, which is why the wrapper is the default.

Frontend: `npm run typecheck` (tsc) and `npm run build` (also typechecks + lints).

## Troubleshooting

- `uvicorn not found` -> venv not activated or requirements not installed.
- `/health` works but complaint endpoints 500 -> `DATABASE_URL` missing/wrong.
- Frontend `fetch failed` -> backend not on `:8000` or `NEXT_PUBLIC_API_URL` wrong.
- DB connection refused on Supabase -> check connection string uses the
  `postgres` user + correct password, and IP allow-list if enabled.
- `infisical: command not found` -> CLI missing, or the shell predates the
  install; open a new terminal (`winget install infisical`).
- App starts but a secret is empty -> wrong `--env` slug, or the value sits in a
  folder: `infisical secrets --env=dev --path=/` shows what the CLI resolves;
  add `--path`/`--recursive` for folders.
- Works in the terminal but not from your editor's run button -> point the run
  configuration at `infisical run --env=dev -- <start command>`; injected values
  only exist inside that process tree.
