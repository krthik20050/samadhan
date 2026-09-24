# User authentication & dashboards — setup

Clerk powers passenger accounts (Google / email code out of the box). Depot
staff keep the shared `ADMIN_API_TOKEN`. Both doors feed the same Postgres, so
web and Telegram filings land in one dashboard.

## Keys to paste (when ready)

**Frontend** — `app/frontend/.env.local`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx   # Clerk Dashboard → API Keys
```

**Edge Function** (user sessions + profiles):

```
CLERK_ISSUER=https://<your-slug>.clerk.accounts.dev   # exactly as Clerk shows it
CLERK_SECRET_KEY=sk_test_xxx
```

Set them with the CLI once `SUPABASE_ACCESS_TOKEN` is available:

```bash
cd app
npx supabase secrets set CLERK_ISSUER=... CLERK_SECRET_KEY=... --project-ref ikipstqlumypppfypdrx
npx supabase functions deploy api --project-ref ikipstqlumypppfypdrx
```

Frontend redeploy (Vercel) picks up `VITE_CLERK_PUBLISHABLE_KEY` from its env
settings, or locally put it in `app/frontend/.env.local`.

## Making yourself an admin

In Clerk Dashboard → Users → *(your user)* → Public metadata:

```json
{ "role": "admin" }
```

That user can then open `/api/v1/admin/analytics` (and any future staff
endpoint) with their Clerk session — no shared password. The depot login page
still accepts the `ADMIN_API_TOKEN` as the fallback door.

## How identity linking works

- `database/migrations/010_auth_analytics.sql` adds `app_users` (one row per
  person) and `complaints.user_id` (ownership).
- Telegram `/link` users were backfilled into `app_users`. When someone signs
  in on the web with the same phone or email, `app_ensure_user` claims that
  row — bot history and web history merge into one account.
- Filing with a Clerk session stamps `complaints.user_id`; anonymous filings
  (no session) behave exactly as before.
- `GET /api/v1/me` returns the whole "My Account" payload: profile, counts
  (filed / open / resolved / ticket receipts / trips), recent complaints with
  reference IDs, saved trips.
- `GET /api/v1/admin/analytics` returns received / pending / in-review /
  escalated / resolved / urgent-attention / SLA-breached / ticket-receipts,
  plus by-category, **by-district**, by-depot and recent items.

## "Tickets booked / sold"

KSRTC exposes no booking API. The panels count **ticket receipts** — filed
complaints whose ticket photo was machine-read (`ticket_extracted IS NOT
NULL`) — and label them as such. If organisers provide a real bookings feed,
`app_admin_analytics` / `app_me` are the seams to extend.

## Deploy order (already safe)

Migration 010 keeps a 12-arg overload of `app_file_complaint`, so the old
Edge Function build keeps working until the new one is deployed — Telegram
never breaks mid-upgrade.
