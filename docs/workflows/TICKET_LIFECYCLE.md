# Ticket Lifecycle

One lifecycle for every channel. Transitions are enforced by the
`enforce_status_transition` trigger (migration 003) — illegal moves are
rejected by the database, not by convention.

## States

| State | Meaning | Set by |
|---|---|---|
| `submitted` | Filed and routed to a depot | filing RPC |
| `needs_triage` | Filed but no unambiguous depot (honest fallback, never a guess) | filing RPC |
| `in_review` | Depot/ops actively working it | staff |
| `escalated` | SLA breach or manual escalation | `app_sla_sweep` (cron) / staff |
| `resolved` | Fix applied, awaiting confirmation window | staff |
| `closed` | Terminal | staff |

## Allowed transitions

```
submitted    ──► in_review | needs_triage | escalated
needs_triage ──► in_review | escalated
in_review    ──► resolved | escalated | closed
escalated    ──► in_review | resolved | closed
resolved     ──► closed
closed       ──► (terminal — no exits)
```

## SLA

`sla_rules` holds the full category × priority matrix (36 combos seeded in
002). The filing RPC stamps `sla_due_at`; `app_sla_sweep` (pg_cron) flags
breaches; escalations surface in the admin console banner and analytics.

## Provenance & audit

- Every filing writes `status_history(from=NULL, to=<initial>)` and stamps
  `source_channel` (web/telegram/whatsapp/voice/api) — migration 011.
- Every consequential action writes `audit_log` (actor, action, entity,
  request id) from the service layer.
- Every transition is visible to the passenger: /track timeline, bot /track,
  admin console timeline all render `status_history`.

## Where the reference ID lives

Issued once by `app_reference_id()` inside the filing transaction, returned
to the channel, rendered by web success/track pages, bot confirmations and
`/my`, dashboard lists, and audit rows. Format `KSRTC-YYYY-XXXXXX`;
unguessable (36^6), unique + regex-checked in the DB; the passenger-facing
capability for public tracking.
