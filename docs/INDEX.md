# Documentation Index

Start here. Everything else is organized by concern.

## Understand the product

| Doc | What it tells you |
|---|---|
| [product/WHY_THIS_MATTERS.md](product/WHY_THIS_MATTERS.md) | The case for the system and its hardening — passengers, depot, team |
| [product/WHAT_WE_ARE_DOING.md](product/WHAT_WE_ARE_DOING.md) | Inventory of the transformation, per change, with verification |
| [product/WHY_WE_DID_IT.md](product/WHY_WE_DID_IT.md) | Decision reasoning: problem → alternatives → chosen approach |
| [product/FUTURE_SCOPE.md](product/FUTURE_SCOPE.md) | Roadmap in NOW / NEXT / FUTURE / EXPERIMENTAL tiers |
| [product/UX_RESEARCH.md](product/UX_RESEARCH.md) | Public-portal UX findings mapped to Samadhan improvements |

## Understand the architecture

| Doc | What it tells you |
|---|---|
| [architecture/AUDIT.md](architecture/AUDIT.md) | What was found (with severities), pre-transformation |
| [architecture/TARGET_ARCHITECTURE.md](architecture/TARGET_ARCHITECTURE.md) | The modular-monolith stance, domain map, deferrals |
| [architecture/API_GAPS.md](architecture/API_GAPS.md) | Endpoint-by-endpoint register: fixed / open / healthy |
| [architecture/KNOWN_LIMITATIONS.md](architecture/KNOWN_LIMITATIONS.md) | What cannot be fixed yet, and the mitigations |
| [database/DATABASE_ARCHITECTURE.md](database/DATABASE_ARCHITECTURE.md) | Tables, constraints, reference IDs, lifecycle, identity, grants |

## Operate the system

| Doc | What it tells you |
|---|---|
| [operations/DEPLOYMENT.md](operations/DEPLOYMENT.md) | Environments, migration + function deploy, verification checklist, rollback |
| [operations/OBSERVABILITY.md](operations/OBSERVABILITY.md) | Request IDs, structured logs, audit queries, monitoring plan |
| [workflows/COMPLAINT_WORKFLOW.md](workflows/COMPLAINT_WORKFLOW.md) | The one pipeline, per channel, end to end |
| [workflows/TELEGRAM_WORKFLOW.md](workflows/TELEGRAM_WORKFLOW.md) | Bot state machine, commands, linking, ML slots |
| [workflows/TICKET_LIFECYCLE.md](workflows/TICKET_LIFECYCLE.md) | States, allowed transitions, SLA, provenance |

## Set up / contribute

| Doc | What it tells you |
|---|---|
| [INFISICAL.md](INFISICAL.md) | Secrets workflow (values never in `.env`) |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Local setup for backend, frontend, DB, tests |
| [AUTH_SETUP.md](AUTH_SETUP.md) | Clerk configuration for web sessions |
| [WHATSAPP_TESTING.md](WHATSAPP_TESTING.md) | WhatsApp smoke test + guided flow runbook |
| [API.md](API.md) | Endpoint reference (legacy sections may lag — API_GAPS is truth) |

## Migrations (source of truth: `database/migrations/`)

| # | Content |
|---|---|
| 001–004 | Core schema, SLA matrix, hardening, dataset lookups |
| 005–010 | RPCs, Telegram flow, ticket flow, passengers/trips, robust filing, auth/analytics |
| 011 | source_channel, idempotency keys, audit_log, chat-binding guards |
| 012 | Staff status writes (`app_set_status`), history reader, track-note visibility |
