# Project checklist

Legend: `[ ]` not started, `[x]` completed.

## PHASE 0 — Initialization (MUST HAVE)
- [x] Repo structure created
- [x] Docs skeleton (ARCHITECTURE/DATABASE/API/DEVELOPMENT/DEMO/DECISIONS)
- [x] Backend foundation (`/health`, config, tests)
- [x] Frontend foundation (routes, API client)
- [x] Migrations + seeds scaffold
- [x] `.env.example`, `.gitignore`, CI

## PHASE 1 — Database (MUST HAVE)
- [x] Ran `001_initial_schema.sql` against Supabase (pooler session mode, :5432)
- [x] Ran `002_seed_sla_rules.sql` (full 36-combo matrix)
- [x] Ran `003_hardening.sql` (RLS, triggers, guards, indexes)
- [x] Verified RLS: enabled on all 7 tables, 0 public policies
- [x] Imported real data: 112 depots, 2884 routes, 339 mappings (2663 source rows genuinely unmapped/UNKNOWN — skipped by design)
- [x] Scripted, idempotent dataset import (`backend/scripts/import_dataset.py`) + `004_lookup_hardening.sql` (route_aliases, od_match_key, depot contacts, import_runs)
- [x] Alias-aware route resolution (passenger spellings → dataset routes → VERIFIED depot)
- [ ] Verify anonymised dashboard viewShape

## PHASE 2 — Backend foundation (MUST HAVE)
- [x] `GET /health`
- [x] DB session wiring (live Supabase DATABASE_URL)
- [ ] Error handler + request logging

## PHASE 3 — Complaint submission (MUST HAVE)
- [x] `POST /api/v1/complaints` (validate -> persist -> reference ID)
- [x] Reference-ID generator (with collision retry)

## PHASE 4 — Depot routing (MUST HAVE)
- [x] Route->depot lookup service (+ `needs_triage` fallback)

## PHASE 5 — Tracking (MUST HAVE)
- [x] `GET /api/v1/complaints/{reference_id}` + history (allowlisted, no PII)

## PHASE 6 — SLA + escalation (MUST HAVE)
- [x] SLA computation on create
- [ ] Breach checker + `POST .../escalate`

## PHASE 7 — Dashboard (MUST HAVE)
- [x] `GET /api/v1/dashboard/summary` + `/complaints` (anonymised)
- [x] Dashboard page

## PHASE 8 — Evidence upload (NICE TO HAVE)
- [ ] Supabase Storage + `POST .../evidence`

## PHASE 9 — Voice/STT (STRETCH)
- [ ] Audio capture + Sarvam STT adapter

## PHASE 10 — AI extraction (STRETCH)
- [ ] Free-text -> schema adapter (pluggable, optional)

## PHASE 11 — WhatsApp (STRETCH)
- [ ] Webhook + adapter into `POST /complaints`

## PHASE 12 — Ticket OCR/QR (STRETCH)
- [ ] Prefill bus/route from scan

## PHASE 13 — Polish/demo (MUST HAVE before judging)
- [ ] End-to-end demo rehearsal per `docs/DEMO.md`
- [ ] Seed demo data, back up a working DB
