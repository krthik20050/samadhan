# API contract (MVP, v1)

Base: `http://localhost:8000/api/v1`. Only `GET /health` (root level) is
implemented in the foundation; everything below is the contract to build
against. Unimplemented routes currently return `501 Not Implemented`.

## POST /api/v1/complaints — file a complaint
Purpose: validate, resolve depot, compute SLA, persist, return reference.
```json
// request
{"bus_number":"KL-15-1234","route_text":"Adoor - Ernakulam","route_id":null,
 "category":"overcrowding","location_text":"Kottarakkara stop",
 "description":"Bus was severely overcrowded, ...","contact_phone":"+91..."}
```
Validation: `category` in enum; `description` >= 10 chars; either
`route_id` or `route_text` required; unknown route => accepted with
`depot_id=null`, status `needs_triage`.
```json
// 201 response
{"reference_id":"SAM-2026-000123","status":"submitted","depot":"ADOOR",
 "sla_due_at":"2026-09-25T12:00:00Z"}
```
Errors: `422` validation, `500` DB failure.

## GET /api/v1/complaints/{reference_id} — track
Purpose: public tracking by reference ID (no auth in MVP).
Response `200`: complaint + `status_history` (no phone).
Errors: `404` unknown reference.

## GET /api/v1/dashboard/summary — anonymised counts
Purpose: cards for the dashboard. Query params: `from,to,depot,category`.
Response `200`: `{totals:{...}, by_category:{...}, by_status:{...},
sla_breaches:n, escalations:n}`. Never includes phone/identity.

## GET /api/v1/dashboard/complaints — anonymised list
Purpose: dashboard table. Paginated (`?limit&offset`), same filters.
Items expose reference/category/status/depot/created/sla only.

## POST /api/v1/complaints/{id}/evidence — attach file (TODO)
Purpose: register a Supabase Storage upload. Body:
`{"storage_path":"...","mime_type":"...","size_bytes":123}`.

## POST /api/v1/complaints/{id}/status — change status (TODO)
Purpose: ops update. Body: `{"to_status":"in_review","note":"...","changed_by":"depot-officer"}`.
Appends to `status_history`. Errors: `404`, `422` illegal transition.

## POST /api/v1/complaints/{id}/escalate — escalate (TODO)
Purpose: manual escalation. Appends history, sets `escalated`.

## GET /api/v1/routes, GET /api/v1/depots — lookups (LIVE)
Purpose: populate form dropdowns from the imported KSRTC dataset
(`scripts/import_dataset.py` ← `../dataset/data/final/*.csv`).

- `GET /api/v1/routes?q=&limit=` → `{items:[{id,name,origin,destination,
  service_type,depot_name,auto_routable}]}` — `auto_routable` = has a
  VERIFIED depot mapping; ordered auto-routable first.
- `GET /api/v1/depots?q=&limit=` → `{items:[{id,name,district,phone,email,
  zone,verified_routes}]}` — ordered by verified route count.
- Both search name/origin/destination (+ district for depots, aliases for
  routes), case-insensitive; limits are bounded (routes ≤ 200, depots ≤ 300).

Complaint `route_text` matching now resolves passenger spellings through the
dataset alias chain (same normalisation as the pipeline):
`'Guruvayoor to Kozhikode'`, `'Trivandrum-Kochi'` and the web form's
`'Origin → Destination via …'` all resolve to the canonical route; unknown
text still becomes `needs_triage`, never a rejection.
