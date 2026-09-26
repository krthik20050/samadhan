# Architecture

## System overview

```
                  +------------------+
                  |  Next.js portal  |  submit (<60s) / track / dashboard
                  +--------+---------+
                           |  REST JSON
                           v
+----------------+  +------+------------------+  +----------------+
| WhatsApp (FUT) |->|  Complaint API (FastAPI) |->| Voice STT (FUT)|
+----------------+  +------------+------------+  +----------------+
                                 v
                           Validation (Pydantic)
                                 v
                       Route -> Depot resolution
                                 v
                          SLA calculation
                                 v
                       PostgreSQL (Supabase)
                                 +---> customer tracking (by reference ID)
                                 +---> anonymised management dashboard
```

Core rule: the path **form -> validate -> route/depot -> SLA -> DB**
has zero dependency on AI, WhatsApp, or voice. Those are adapters
around the core, never inside it.

## Responsibilities

- **Frontend (Next.js + TS + Tailwind):** complaint form, tracking page,
  dashboard page. No business logic beyond validation-for-UX; depot/SLA
  decisions come from the API.
- **Backend (FastAPI + Pydantic):** validation, depot resolution,
  SLA/escalation computation, reference-ID generation, CRUD. Route
  modules (`api/`) are thin; logic lives in `services/`.
- **Database (PostgreSQL via Supabase):** source of truth. Migrations in
  `database/migrations/` make it reproducible. Evidence files go to
  Supabase Storage later (only URLs in `evidence` table).

## Data flow (MVP)

1. Client POSTs complaint JSON.
2. Pydantic schema validates (bus no, route, category, description).
3. Service looks up `route_depot_mapping` -> `depots`.
   Unknown route => `depot_id = NULL`, status `needs_triage` (never reject).
4. Service loads `sla_rules` for category (+priority override) -> sets `sla_due_at`.
5. Row inserted in `complaints` + row in `status_history`.
6. Reference ID (e.g. `SAM-2026-000123`; legacy `KSRTC-…` IDs still resolve) returned.
7. Tracking and dashboard read the same rows; dashboard queries use an
   anonymised view (no phone/identity/exact location).

## SLA / escalation (MVP logic)

- `sla_rules(category, priority)` -> `response_hours`, `resolution_hours`.
- A background check (simple cron/endpoint in MVP, not Celery) marks
  `sla_breached=true` when `now > sla_due_at` and status not closed.
- Escalation appends to `status_history` and reassigns owning depot
  level (depot -> district -> HQ). No message queues.

## Future adapters (NOT in MVP)

- **Voice:** audio -> Sarvam STT -> same `POST /complaints` payload.
- **AI extraction:** LLM fills the same Pydantic schema, then the normal path.
- **WhatsApp/Telegram:** webhook -> parse -> same schema -> normal path.
- **Ticket OCR/QR:** extract bus/route -> prefill form, then normal path.

## Why a modular monolith

Single FastAPI app + single Next.js app + single Postgres. No
microservices/Kafka/Redis/Celery/K8s: nothing in the MVP needs
independent scaling, async fan-out, or separate deployables, and each
addition costs demo time and debugging surface. If load ever justifies
it, the `services/` boundary is where a split would happen.
