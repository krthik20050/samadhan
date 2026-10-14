# Website ticket-first flow

The website and Telegram use the same Supabase `api` function and Groq ticket
extractor. The website's `VITE_API_URL` must point to that function. Vercel's
project root is `frontend`, so the root `vercel.json` runs `npm run build` there.

## Website sequence

1. Upload a ticket or explicitly continue without one.
2. Read the image and fill editable journey fields. Each printed field appears
   with a short highlight. Reduced-motion users receive the values immediately.
3. Confirm or correct the journey, then type or speak the problem.
4. Edit the transcript, select the category, and review before submitting.

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

`useText` localizes site-owned copy through a Malayalam dictionary. The language
choice persists across navigation, including login and admin pages. User text,
ticket values, registration numbers, references, and filenames remain verbatim.
The Clerk sign-in/sign-up interface has Malayalam localization overrides.

## Verification on 2026-10-14

- Six React regression tests passed: complete ticket mapping, editable values
  surviving review, Malayalam switching without losing edits, speech handoff
  without journey replacement, attachment failure, and unreadable-ticket recovery.
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
