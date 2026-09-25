# Observability

What we can see when Samadhan misbehaves — designed now, provisioned as the
team grows (KNOWN_LIMITATIONS #9 tracks activation).

## Correlation

- Every Edge Function response carries `X-Request-Id` (honours inbound,
  else mints `crypto.randomUUID()`).
- The FastAPI harness mirrors it on `POST /api/v1/complaints` responses.
- Audit rows store `request_id`; error logs print it — one id joins a user
  report ↔ API logs ↔ `audit_log` ↔ Postgres state.

## Structured logs

Edge Function logs are JSON lines:

```json
{"event":"unhandled_error","request_id":"…","path":"/api/v1/complaints","error":"…"}
{"event":"telegram_file_failed","chat_id":123,"detail":"invalid category"}
{"event":"upload_failed","error":"…"}
{"event":"chat_access_denied","request_id":"…","chat":123,"owner":456}
```

Rules: no tokens, no phones, no raw descriptions in logs; DB validation
messages are short enough to surface; failures of advisory side-writes
(audit) are logged, never raised.

## Audit trail (in-DB, queryable)

`audit_log` (011): `actor_type (passenger|staff|system|channel)`, `actor_id`,
`action`, `entity_type/entity_id`, `detail jsonb`, `request_id`, timestamps.
Written today for: `complaint_filed` (web + telegram + whatsapp + fastapi),
`evidence_uploaded` (web). Query examples:

```sql
-- filings per channel, last 24h
SELECT detail->>'channel' AS channel, count(*) FROM audit_log
WHERE action='complaint_filed' AND created_at > now() - interval '24 hours'
GROUP BY 1;
-- everything that happened to one complaint
SELECT * FROM audit_log WHERE entity_type='complaint' AND entity_id='KSRTC-2026-XXXXXX'
ORDER BY created_at;
```

## What to monitor (when provisioned)

| Signal | Where | Alert when |
|---|---|---|
| Edge Function 5xx rate | Supabase logs / external uptime | > 2% over 5 min |
| `/health` availability | uptime probe on `<api>/health` | 2 consecutive misses |
| Filing failures | `telegram_file_failed` / mapDbError 500s | any spike vs baseline |
| SLA breaches | `complaints.sla_breached` / admin analytics | sustained growth |
| Auth failures | 401/403 counts by endpoint | brute-force pattern on `/auth/login` |
| DB latency | Supabase dashboard | p95 > 500 ms on RPCs |
| Webhook processing time | function duration metric | p95 > 3 s (Telegram retries at ~30 s) |

## Failure behavior contract

- ML slots (Groq/Sarvam) absent or failing → flows degrade with a notice;
  nothing 500s.
- Telegram sends are best-effort behind a completed webhook action.
- Outbound integration calls use explicit timeouts; a hung upstream cannot
  hang a passenger's submission.
- Idempotency means network retries are safe: the same key returns the same
  reference ID (verified in `test_e2e_journey.py`).

## Runbooks (pointers)

- Redeploy API: `npx supabase functions deploy api --project-ref
  ikipstqlumypppfypdrx` (secrets via `supabase secrets set`; set `SITE_URL`).
- Webhook re-registration: `backend/scripts/setup_telegram_webhook.py info`.
- Dataset refresh: `backend/scripts/import_dataset.py` (idempotent, logged
  in `import_runs`).
