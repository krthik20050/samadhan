# Secrets in Infisical (replacing `.env`)

One project holds every value this repo used to keep in a `.env` file. The app
reads the same names from the same places — `os.environ` in FastAPI,
`Deno.env.get` in the Edge Function, `import.meta.env` in the browser — so no
application code changes. Only *where the values come from* changes.

`.infisical.json` in the repo root links the checkout to that project. It holds
settings, not secrets, and is safe to commit.

## What reads what

| Runtime | Entry point | How it gets secrets |
|---|---|---|
| FastAPI (local dev + pytest) | `backend/app/main.py` | `infisical run --env=dev -- <command>` |
| Frontend (Vite dev) | `frontend/` `npm run dev` | `infisical run` (already wired into the script) |
| Edge Function (hosted API) | `supabase/functions/api` | Supabase function secrets, kept in sync from Infisical |
| Frontend build (Vercel) | `vercel.json` | Vercel env settings, kept in sync from Infisical |
| CI (GitHub Actions) | `.github/workflows/ci.yml` | Nothing today — tests need no secrets |

### Names in play (values are never written down here)

| Name | Read by | Environment |
|---|---|---|
| `DATABASE_URL` | FastAPI | dev / staging / prod |
| `ADMIN_API_TOKEN` | FastAPI + Edge Function | all |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | FastAPI (Edge gets them injected) | all |
| `SUPABASE_ANON_KEY` | FastAPI | all |
| `CLERK_ISSUER`, `CLERK_SECRET_KEY` | Edge Function | staging / prod |
| `FRONTEND_URL`, `BACKEND_PORT` | FastAPI | dev |
| `SARVAM_API_KEY` | FastAPI + Edge Function | prod |
| `GROQ_API_KEY`, `GROQ_MODEL` | Edge Function (ticket photos) | prod |
| `LLM_API_KEY`, `LLM_MODEL` | FastAPI placeholder | prod |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN` | FastAPI + Edge Function | prod |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | FastAPI webhook only | prod |
| `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY` | browser bundle (**public**) | dev / prod |

`WHATSAPP_*` are read by `backend/app/api/v1/whatsapp.py`; the hosted Edge
Function does not use them today, so a hosted WhatsApp webhook needs those slots
added to the function's secrets as well. Keep the app ID/secret from Meta's
dashboard in Infisical too — they are what you use to mint a new access token.

## One-time setup

1. **Sign up and create the project.** https://app.infisical.com → Secrets
   Management → **+ Add New Project** → name it after the service
   (`samadhan`). New projects come with Development, Staging and Production.
2. **Import what you already have.** On the Secrets Overview page, drag this
   repo's `.env` file onto the page (or use **Paste Secrets**), review the
   parsed keys, tick the target environments, then Upload. Repeat with
   `frontend/.env.local` and any values you previously typed into the
   dashboard-only stores (Supabase, Vercel, Clerk).
3. **Install the CLI** — https://infisical.com/docs/cli/overview:

   ```powershell
   winget install infisical        # Windows; or: scoop install infisical
   npm install -g @infisical/cli   # any OS
   brew install infisical/get-cli/infisical   # macOS
   ```

4. **Log in.** `infisical login` opens a browser. On WSL 2, Codespaces, or a
   remote SSH session run `infisical login -i` and authenticate from the
   terminal instead.
5. **Link the checkout.** From `app/`, run `infisical init` and pick the
   organisation + project; it writes `.infisical.json` with the project ID
   (commit it). If you would rather do it by hand, copy the ID from Project →
   Settings → General into `workspaceId` — the placeholder currently in the file
   will not resolve until you do.

## Daily commands

Backend:

```powershell
cd backend
infisical run --env=dev -- py -m uvicorn app.main:app --reload --port 8000
```

Frontend (the wrapper is already the default script):

```powershell
cd frontend
npm run dev          # = infisical run --env=dev -- vite
npm run dev:local    # escape hatch: start Vite with no CLI on PATH
```

Tests and migrations take the same wrapper:

```powershell
cd backend
infisical run --env=dev -- pytest -q
infisical run --env=dev -- psql $env:DATABASE_URL -f ../database/migrations/001_initial_schema.sql
```

`npm run build` stays unwrapped on purpose: Vercel runs it on a clean runner
with no Infisical CLI, and gets the two public `VITE_*` values from Vercel's own
env settings (synced from Infisical). Same for Edge Function deploys — the
runtime reads function secrets, not a `.env`.

Useful flags: `--watch` restarts the process when a secret changes,
`--path=/backend --recursive` reads secrets filed under a folder, and
`--command="npm run migrate && npm run dev"` chains commands that are not a
single binary. Need a different value on your machine only? Use a personal
override (`infisical secrets set KEY=value --type=personal`) rather than editing
the shared secret, and `.env.local` stops being the escape hatch.

## Hosted environments (CI/CD, Supabase, Vercel)

Interactive login is for laptops only. Everything hosted authenticates as a
**machine identity** with Universal Auth or OIDC — see
https://infisical.com/docs/documentation/platform/identities/machine-identities
and https://infisical.com/docs/documentation/platform/identities/universal-auth.
Store the client ID and secret in the platform's own secret store and scope the
identity to the single project + environment it needs.

GitHub Actions (OIDC needs no stored credential; `Infisical/secrets-action`
injects the values as env vars for later steps):

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: actions/checkout@v4
  - uses: Infisical/secrets-action@v1.0.16
    with:
      method: "oidc"
      identity-id: "<machine-identity-id>"   # public identifier, safe to commit
      project-slug: "<project-slug>"
      env-slug: "dev"
  - run: pytest -q
```

Prefer the Universal Auth tab in
https://infisical.com/docs/integrations/cicd/githubactions if the runner cannot
request an OIDC token; then the action takes `client-id`/`client-secret` from
GitHub Secrets instead.

- **Edge Function (hosted API):** keep Infisical as the source of truth with a
  [Supabase Secret Sync](https://infisical.com/docs/integrations/secret-syncs/supabase)
  (set a Key Schema and enable *Disable Secret Deletion* so the sync only owns
  the keys you intend). A one-off `npx supabase secrets set KEY=...` still works
  — see `supabase/README.md`.
- **Vercel (frontend build):** use a
  [Vercel Secret Sync](https://infisical.com/docs/integrations/secret-syncs/vercel)
  for the two `VITE_*` values, or paste them once in Project → Settings →
  Environment Variables.
- **Render (`grievance-api`):** redundant per `PROJECT_STATUS.md` — delete it, or
  keep secrets flowing with a
  [Render Secret Sync](https://infisical.com/docs/integrations/secret-syncs/render)
  instead of hand-wrapping its start command.

## Verify it actually works

```powershell
# 1. The CLI sees the keys it should (names only, no values printed).
infisical secrets --env=dev --path=/

# 2. One known value resolves inside the wrapped process.
cd backend
infisical run --env=dev -- py -c "import os;print('DATABASE_URL chars:', len(os.environ.get('DATABASE_URL','')))"
```

Then prove the secrets are not coming from disk. From the repo root (`app/`):

```powershell
Rename-Item .env .env.backup
cd backend
infisical run --env=dev -- py -m uvicorn app.main:app --reload --port 8000
cd ..\frontend
Rename-Item .env.local .env.local.backup
npm run dev
```

Health check http://localhost:8000/health still answers, a complaint lookup
still resolves a route, and the site renders. Renaming is enough to prove the
point because both pydantic-settings and Vite give real environment variables
priority over a `.env` file — keep the backups until you trust the setup.

If a value looks missing, check the environment slug and folder before touching
code: `infisical run` injects root-level secrets only unless you pass `--path`.

## Clean up

- `.env` and `.env.*` are already in `.gitignore` (with `!.env.example`), so
  the renamed backups stay out of git; delete them once you trust the setup.
- If a secret ever reached a commit, **rotate it** — rewriting history does not
  un-leak a value that has been pushed. Revoke/regenerate in the provider
  (Supabase keys, Clerk secret, Telegram/WhatsApp tokens, `ADMIN_API_TOKEN`),
  update Infisical, and let the syncs propagate.
- Scan for leaks before and after the switch:
  https://infisical.com/docs/cli/scanning-overview — `infisical scan install
  --pre-commit-hook` blocks a commit that contains something secret-looking.
- Never print, paste, or commit a real value: this doc, issue threads, and
  screenshots all count as leaking.

## Roll back

Delete `.infisical.json`, restore `.env` from `.env.backup`, and revert the
`dev` script in `frontend/package.json`. The app reads environment variables
either way, so nothing else has to change.
