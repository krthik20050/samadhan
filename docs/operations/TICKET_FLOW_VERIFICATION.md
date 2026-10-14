# Website ticket-first flow

The website and Telegram use the same Supabase `api` function and Groq ticket
extractor. The website's `VITE_API_URL` must point to that function. Vercel's
project root is `frontend`, so the root `vercel.json` runs `npm run build` there.

## Website sequence

1. Upload a ticket, or enter the journey manually on the same page.
2. Read the image and fill editable journey fields. Each printed field appears
   with a short highlight. Reduced-motion users receive the values immediately.
3. Correct any journey box. Type or speak the incident location and problem;
   each field has its own mic and appends editable speech to existing text.
4. Select the category and submit directly. The reference page appears only
   after a successful server response. Retries reuse the same idempotency key.

Absent ticket values stay empty. The boarding landmark and seat are printed
travel facts; the location of the incident is a separate optional field. Speech
does not overwrite the confirmed journey. Edited values are saved in the
complaint draft and ticket metadata. Attachment failures are shown independently
of extraction failures.

## Authentication and language

Passengers use Clerk and `/account`. Staff use server-verified credentials and
`/admin/depot`. Staff API tokens take precedence while a staff session is active;
saved staff sessions are revalidated. Vercel contains the existing Clerk
publishable key. No backend keys belong in the browser build.

Clerk's string `user_...` identity is stored separately from legacy UUID identity
links by migration 014. Only verified primary email/phone claims can link an
existing account. The passenger dashboard sends the current Clerk bearer token
directly and never falls back to a saved staff token or a client-provided user ID.
It uses real status counts, paginated server filters and recorded status history.
Resolved and closed counts are distinct. API failures show unknown counts rather
than invented zeroes. Google profile photos come from Clerk's current user.
Staff sign-in is `/login?mode=staff`, including while a passenger is signed in.

`useText` localizes site-owned copy through a Malayalam dictionary. The language
choice persists across navigation, including login and admin pages. User text,
ticket values, registration numbers, references, and filenames remain verbatim.
The Clerk sign-in/sign-up interface has Malayalam localization overrides.

## Verification on 2026-10-14

- Eleven React regression tests passed, including direct single-form submission,
  preserved corrections, voice append, retry idempotency, Malayalam switching,
  attachment failure, unreadable tickets, dashboard profile and current token,
  server filters, unavailable counts, and account-switch isolation.
- Transactional database tests passed identity idempotency, own-account data
  isolation, outcome counts, monthly activity, pagination, server filters and
  anonymous RPC denial. All synthetic records were rolled back. Migration 014
  and the API function were deployed.
- TypeScript and production build passed; static localization audit passed.
- Browser upload of a synthetic Guruvayur → Ernakulam ticket filled route, bus,
  date, time, via, landmark, seat, ticket, PNR, depot and service type. Editing
  destination and switching Malayalam preserved the edit.
- Repeated the upload, edit and Malayalam checks on the production website.
  The production Google/email sign-in modal opened with Malayalam labels.
- Live extraction returned all printed synthetic values, including via and seat.
- Generated English speech was transcribed by the live Sarvam endpoint.
- Staff login succeeded with the configured credential and failed with an invalid
  credential. Anonymous customer/admin requests returned 401; staff dashboard
  requests succeeded. No private record bodies were logged.
- Physical microphone recording, passenger Google/email verification completion,
  and a real passenger's ticket remain device/user checks.

Run `npm test`, `npm run check:localization`, and `npm run build` in `frontend`.
`scripts/check-live.mjs` checks the existing API using ignored local configuration
and never prints credential values or private records.
