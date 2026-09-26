# Demo plan (judge run, ~5 min)

Core demo — must work with all AI services DOWN:

1. Open portal home (`/`).
2. Click "File complaint" (`/complain`).
3. Enter bus number, route (pick a real one, e.g. Adoor - Ernakulam),
   category, location, description.
4. Submit -> show reference ID (e.g. `SAM-2026-000123`).
5. Open tracking (`/track/SAM-2026-000123`) -> status `submitted`,
   responsible depot shown (e.g. ADOOR).
6. Open dashboard (`/dashboard`) -> complaint counted, anonymised
   (no phone/identity shown).
7. Change status (submitted -> in_review -> resolved) via API.
8. Simulate SLA breach (short test rule or backdated `sla_due_at`)
   -> `sla_breached=true`, escalation entry in history.
9. Dashboard shows breach/escalation counts.

Future additions (only if time, each is a separate stretch):

- Voice: record -> Sarvam transcript -> prefilled form -> same path.
- AI extraction: paste free text -> structured fields -> same path.
- WhatsApp: send message -> complaint appears in dashboard.
- Ticket QR: scan -> bus/route prefilled.

If any future feature fails live, fall back to the core demo above.
