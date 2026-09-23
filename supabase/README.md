# Supabase-only backend

The hosted backend is **one Edge Function** (`functions/api`) in front of
**Postgres RPCs** (`database/migrations/005_supabase_rpcs.sql`). No Render,
no second runtime: the database that already holds the KSRTC dataset and the
route-matching logic now also holds the API business logic.

```
Browser (Vercel) ─┐
Telegram ─────────┼──> Edge Function /functions/v1/api ──> RPCs ──> Postgres
                  └        (thin router: auth + shapes)     (all logic)
```

## Why this shape

- **Logic in RPCs** — filing (validation → route resolution → SLA → insert +
  history), tracking, lookups, dashboard aggregates and the SLA sweep are
  SQL functions. They run transactionally next to the data and are testable
  from any psql client (no deploy needed to test logic changes).
- **Router is dumb** — `functions/api` maps HTTP paths to RPCs, enforces the
  staff Bearer token and the Telegram secret header, and mirrors the FastAPI
  response shapes 1:1, so `frontend/src/lib/api/*` is unchanged apart from
  `VITE_API_URL`.
- **Route matching reuses the dataset chain** — the same
  fold → noise-strip → alias-resolve pipeline (migration 004, now callable as
  `app_route_text_od_key()`), so "Guruvayoor to Kozhikode" resolves to the
  dataset route and its VERIFIED depot exactly like the Python service did.

## Endpoint map (identical contract to FastAPI)

| Path | RPC | Auth |
|---|---|---|
| `GET /health` | — | public |
| `POST /api/v1/complaints` | `app_file_complaint` | public |
| `GET /api/v1/complaints/{ref}` | `app_track_complaint` | public |
| `GET /api/v1/routes?q&limit` | `app_list_routes` | public |
| `GET /api/v1/depots?q&limit` | `app_list_depots` | public |
| `GET /api/v1/dashboard/summary` | `app_dashboard_summary` | public |
| `GET /api/v1/dashboard/complaints` | `app_dashboard_complaints` | Bearer `ADMIN_API_TOKEN` |
| `POST /api/v1/auth/login` | — (token compare) | public |
| `POST /api/v1/telegram/webhook` | via `app_file_complaint` / `app_track_complaint` | `X-Telegram-Bot-Api-Secret-Token` |

Base URL: `https://<project-ref>.supabase.co/functions/v1/api`
CORS is `*` (no cookies are used); staff endpoints still require the token.

## One-time deploy

```bash
npm i -g supabase          # or: scoop install supabase
supabase login             # opens browser; paste the access token back
cd app
supabase functions deploy api --project-ref ikipstqlumypppfypdrx
```

Then set the function secrets (Dashboard → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set ADMIN_API_TOKEN=... TELEGRAM_BOT_TOKEN=... \
  TELEGRAM_SECRET_TOKEN=... --project-ref ikipstqlumypppfypdrx
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

## Slack/SLA sweep

`app_sla_sweep()` marks `sla_breached` for overdue open complaints. The
migration schedules it every 10 minutes **if `pg_cron` is enabled**.
Enable it once: Dashboard → Database → Extensions → `pg_cron`, then re-run
migration 005 (or just the `DO` block at the bottom).

## Telegram

```bash
backend/.venv/Scripts/python backend/scripts/setup_telegram_webhook.py \
  set https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api
```

The script appends `/api/v1/telegram/webhook` itself.

## What happens to FastAPI / Render

`backend/` stays the local-dev and test harness (37 pytest tests exercise the
same contract the function serves). The Render service is redundant now —
pause or delete it in the dashboard; nothing depends on it.
