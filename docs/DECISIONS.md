# Decisions (ADRs — short)

## ADR-001: Next.js + TypeScript + Tailwind for frontend
Reason: one framework covers form, tracking, dashboard; Vercel deploy later is trivial.
Alternatives: plain React/Vite (less convention, more setup), Flutter (overkill for a web demo).

## ADR-002: FastAPI + Pydantic for backend
Reason: fastest validated JSON API in Python, auto-docs at `/docs` for judges.
Alternatives: Django (heavier than needed), Flask (no built-in validation).

## ADR-003: PostgreSQL via Supabase
Reason: real relational constraints + hosted DB with zero ops + Storage for evidence later.
Alternatives: SQLite (diverges from hosted), Firebase (NoSQL fits this relational model poorly).

## ADR-004: Modular monolith, no microservices/infra
Reason: hackathon window; single deployable each side; see ARCHITECTURE.md.
Alternatives: microservices/Kafka/Redis/Celery — rejected, no MVP need justifies the cost.

## ADR-005: AI is an optional adapter, never core
Reason: core form must work with every AI service down.
Alternatives: AI-first pipeline — rejected, single outage would kill the demo.

## ADR-006: Real KSRTC dataset as depot/route seed sourceReason: sibling `../dataset/data/final/` has scraped official depots, routes,
and route->depot mappings; seeds import from it instead of fabrication.
Alternatives: hand-written fake depots — rejected, contradicts brief.

## ADR-007: Direct psycopg2, no ORM for the MVP
Reason: 4 queries total (depot lookup, SLA lookup, 2 inserts); SQLAlchemy
adds a dependency and a model layer for zero benefit at this size.
Alternatives: SQLAlchemy 2 (revisit only if query count/complexity grows).
