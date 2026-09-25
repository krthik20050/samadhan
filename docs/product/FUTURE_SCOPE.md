# Future Scope

What to build next, in deliberate tiers. Now-tier items are sequenced and
sized; later tiers are direction, not commitment. Foundation: see
[TARGET_ARCHITECTURE.md](../architecture/TARGET_ARCHITECTURE.md).

## NOW (next 1–2 sprints)

1. **Redeploy the Edge Function** with `SITE_URL` set. All repo-side security
   hardening (chat binding, CORS pin, size caps, request IDs) is inert until
   this runs. Half a day, unblocks everything below.
2. **Playwright E2E** — browser-level register → file → upload → review →
   submit → refresh → track. Gates KNOWN_LIMITATIONS #2. ~2 days; run against
   `supabase start` in CI.
3. **Rate limiting** on public endpoints (Deno KV token bucket: complaints,
   uploads, login, voice). ~1 day. Closes API_GAPS M-4.
4. **Status notifications** — the admin modal still says "Notify Passenger"
   but nothing sends. Start with Telegram DM on status change (bot already has
   the chat id), email/SMS later via providers. ~2–3 days.
5. **Resolution feedback** — a one-tap 👍/👎 on /track when status = resolved;
   feeds the analytics RPCs. ~1 day. Directly answers UX research #4.

## NEXT (1–2 months)

6. **WhatsApp evidence uploads** — media messages → evidence bucket; the
   guided flow already has the proof stage wired for them.
7. **WhatsApp persistent conversations** — mirror `telegram_conversations`
   (migration 006) as `whatsapp_conversations`; the flow's four store helpers
   make the swap mechanical. Removes KNOWN_LIMITATIONS #3.
8. **Duplicate detection** — fuzzy match on (category, route, bus, date,
   description embedding); surface "is this the same issue?" before filing.
   Needs an embedding slot; keep it advisory, never blocking.
9. **Admin console depth** — assignment to individual officers, internal
   comments vs passenger-visible notes, saved filters, CSV export.
10. **Observability activation** — uptime probe, error tracking (Sentry or
    Supabase logs' own alerts), the dashboard described in
    `docs/operations/OBSERVABILITY.md`.

## FUTURE (a quarter+)

11. **Authority portal roles** — `MODERATOR`, `AUTHORITY`, `SUPPORT` on
    `app_users.role`; the RBAC groundwork (roles column, admin checks) exists;
    UI per role is the real cost.
12. **Multilingual filing** — Malayalam-first UI parity (translations exist
    partially) and Sarvam's translate endpoint for descriptions; store the
    original language on the complaint.
13. **Voice-first complaint creation** — the STT path exists; add clarification
    dialogue ("you said the bus was crowded — which route?") as a bot flow.
14. **Automated follow-ups** — SLA reminders to depots before breach, closure
    confirmation to passengers, reopen window (the lifecycle map would gain
    `closed → in_review` for reopen — a deliberate, audited change).
15. **Public transparency dashboard** — anonymised aggregate trends
    (already computed) published for citizens; civic-pressure loop.

## EXPERIMENTAL (spikes, no roadmap commitment)

- Ticket QR/OCR fallback when the vision slot misreads (dataset already flags
  `has_qr`).
- Route-level heatmaps from complaint clusters for depot planning.
- "Report once, track anywhere" — track by phone OTP instead of reference ID
  (trades the capability model for convenience; needs a privacy review).

## Explicitly not planned

- Native mobile apps (mobile web + bots cover the audience; a PWA is cheaper).
- Microservice decomposition (the modular monolith has no scaling pressure).
- Public depot ratings (abuse surface; see UX_RESEARCH "not adopted").
