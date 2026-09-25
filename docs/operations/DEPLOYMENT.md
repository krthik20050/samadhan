# Deployment Runbook

Current hosting: **Vercel (website) + Supabase (API, DB, Storage, cron)**.
Render (`render.yaml`, `grievance-api`) is redundant — safe to pause/delete.

## Environments

| Env | Website | API | Secrets |
|---|---|---|---|
| development | `npm run dev` (Infisical-wrapped) | FastAPI on :8000 | Infisical `dev` |
| hosted | Vercel project | Supabase Edge Function `api` | Vercel envs + `supabase secrets set` |

## 1. Database (migrations)

```powershell
# Pooler session-mode URL (direct host is IPv6-only) — see PROJECT_STATUS.md
infisical run --env=dev -- psql $env:DATABASE_URL -f database/migrations/011_production_hardening.sql
```

Apply migrations in numeric order on a fresh project (001→011), then import
the dataset (`backend/scripts/import_dataset.py`, see
`database/seeds/README.md`). All migrations are re-runnable where marked;
011 is additive and deploy-order-safe.

## 2. Edge Function (the API)

```powershell
# one-time: function secrets
npx supabase secrets set SITE_URL=https://<your-frontend-domain>
# already set previously: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# ADMIN_API_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN,
# CLERK_ISSUER, CLERK_SECRET_KEY, GROQ_API_KEY, SARVAM_API_KEY

# deploy (needs SUPABASE_ACCESS_TOKEN)
npx supabase functions deploy api --project-ref ikipstqlumypppfypdrx

# verify
curl -s https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api/health
```

**Deploy order safety:** migration 011 keeps the old RPC call shapes working
(defaulted parameters), so deploying function and migration in either order
is safe. Redeploy the function whenever `supabase/functions/api/**` changes.

## 3. Telegram webhook

```powershell
py backend/scripts/setup_telegram_webhook.py info   # inspect
# register/refresh: <api>/api/v1/telegram/webhook with TELEGRAM_SECRET_TOKEN
```

## 4. Website (Vercel)

- Root `vercel.json` builds `app/frontend` (`npm ci && npm run build`,
  output `app/frontend/dist`).
- Vercel envs: `VITE_API_URL` (Edge Function base) and
  `VITE_CLERK_PUBLISHABLE_KEY`.
- After deploy: run a hard refresh, file a test complaint end-to-end, verify
  the reference ID renders and /track shows it.

## 5. Post-deploy verification (do not skip)

```text
[ ] GET /health returns slots (groq/sarvam/telegram booleans)
[ ] Web: file a complaint → reference ID shown → /track finds it → refresh keeps it
[ ] Bot: /complain → ticket photo → submit → /track <ref> on the website
[ ] WhatsApp: piped filing + guided flow (scripts/test_whatsapp_bot.py --full)
[ ] CORS: browser call from the deployed domain succeeds; other origins rejected
[ ] X-Request-Id present on API responses
[ ] audit_log receives complaint_filed rows
```

## Rollback

- Function: redeploy the previous git tag of `supabase/functions/api`
  (migrations are additive; old code + new DB is a supported state by design).
- Website: Vercel instant rollback to the previous deployment.
- Database: do not "roll back" — write a forward fix; PITR is the last resort.

## Pause / delete Render

The FastAPI service on Render duplicates the Edge Function. If kept, it must
not be exposed publicly (it lacks the Edge-side hardening); recommended:
pause the service and keep the repo as the local-dev + pytest harness only.
