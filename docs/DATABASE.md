# Database design (PostgreSQL)

Real depot/route/mapping facts come from the sibling scrape:
`../dataset/data/final/{depots,routes,route_depot_mapping,services}.csv`.
Migration `001` creates grievance tables; `002` seeds SLA/category
placeholders; `database/seeds/README.md` maps real CSV columns into ours.
Nothing below fabricates depots or routes.

## Tables

### depots
Purpose: KSRTC operating unit that owns a complaint.
- `id` uuid PK default gen_random_uuid()
- `name` text NOT NULL UNIQUE (official name, e.g. `ADOOR`)
- `district` text NULL
- `phone` text NULL, `address` text NULL
- `external_id` text NULL UNIQUE (dataset `depot_id`, e.g. `D1950F8DA2C1F`)
- indexes: `name`, `external_id`

### routes
Purpose: bus route a complaint refers to.
- `id` uuid PK
- `name` text NOT NULL (e.g. `Adoor - Ernakulam`)
- `origin` text NOT NULL, `destination` text NOT NULL
- `service_type` text NULL
- `external_id` text NULL UNIQUE (dataset `route_id`)
- indexes: `external_id`, `(origin, destination)`

### route_depot_mapping
Purpose: which depot owns which route (many-to-many with status).
- `route_id` uuid FK routes NOT NULL, `depot_id` uuid FK depots NOT NULL
- `mapping_status` text NOT NULL DEFAULT 'VERIFIED' (`VERIFIED|PROBABLE`)
- `review_required` bool NOT NULL DEFAULT false
- PK `(route_id, depot_id)`; index on `depot_id`

### complaints
Purpose: one grievance. Operational table (contains contact info).
- `id` uuid PK
- `reference_id` text NOT NULL UNIQUE (e.g. `KSRTC-2026-A1B2C3`)
- `bus_number` text NULL, `route_id` uuid FK routes NULL (free-text
  `route_text` text NULL kept when route unknown)
- `route_text` text NULL
- `category` text NOT NULL (see categories, CHECK constraint)
- `location_text` text NULL (stop/landmark; never exact home address)
- `description` text NOT NULL
- `contact_phone` text NULL (operational only, never in analytics)
- `depot_id` uuid FK depots NULL (NULL = needs_triage)
- `status` text NOT NULL DEFAULT 'submitted'
  (`submitted|in_review|resolved|closed|escalated|needs_triage`)
- `priority` text NOT NULL DEFAULT 'normal' (`low|normal|high|critical`)
- `sla_due_at` timestamptz NULL, `sla_breached` bool NOT NULL DEFAULT false
- `created_at/updated_at` timestamptz NOT NULL DEFAULT now()
- indexes: `reference_id`, `status`, `depot_id`, `category`, `created_at`

### status_history
Purpose: append-only audit of every status change/escalation.
- `id` uuid PK, `complaint_id` uuid FK complaints NOT NULL ON DELETE CASCADE
- `from_status` text NULL, `to_status` text NOT NULL
- `changed_by` text NULL, `note` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- index `(complaint_id, created_at)`

### sla_rules
Purpose: category+priority -> hours. Seeded in migration 002 (tune later).
- `id` uuid PK, `category` text NOT NULL, `priority` text NOT NULL DEFAULT 'normal'
- `response_hours` int NOT NULL, `resolution_hours` int NOT NULL
- UNIQUE `(category, priority)`

### evidence
Purpose: metadata for uploaded files (bytes live in Supabase Storage).
- `id` uuid PK, `complaint_id` uuid FK complaints NOT NULL ON DELETE CASCADE
- `storage_path` text NOT NULL, `mime_type` text NULL, `size_bytes` int NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- index `complaint_id`

## Categories (CHECK on complaints.category)

`cleanliness | unsafe_driving | overcrowding | missed_stop |
concession_denied | ticketing | staff_behaviour | bus_condition | other`

No `ticket_links` table: nothing in the problem statement requires ticket
linking for MVP; add it only if the brief demands it.

## Lifecycle / SLA / escalation

`submitted -> in_review -> resolved -> closed`; overdue or manually
escalated rows go to `escalated` (with a `status_history` note); unknown
route starts at `needs_triage`. `sla_due_at = created_at +
sla_rules.resolution_hours`; a periodic check sets `sla_breached=true`
when `now() > sla_due_at` and status not in (`resolved`,`closed`).

## Security hardening (migration 003, expert-reviewed)

- **RLS deny-by-default:** every table has `ENABLE ROW LEVEL SECURITY` with
  no public policies, plus `REVOKE ALL ... FROM anon, authenticated`.
  The backend connects as owner/service_role (bypasses RLS); the
  `dashboard_complaints` view uses `security_invoker=true` so it can never
  bypass RLS. Keep the Supabase `evidence` storage bucket PRIVATE.
- **Audit survival:** `status_history`/`evidence` are `ON DELETE RESTRICT` —
  deleting a complaint is blocked; close via status instead.
- **Lifecycle enforced in DB:** legal status transitions via trigger, so a
  buggy endpoint cannot jump `submitted -> closed`.
- **Data guards:** reference-ID/phone/bus formats, non-blank route and
  trimmed description, length caps (description 5000, location 300),
  `needs_triage` implies `depot_id IS NULL`, evidence allowlist
  (jpeg/png/webp/pdf, <=10MB, no `..` paths).
- **SLA completeness:** `002` seeds the full 9x4 matrix, so `sla_due_at`
  always resolves. Re-runnable via `ON CONFLICT DO UPDATE`.
- **App-side rules:** track endpoint returns status/history only (never
  phone, location verbatim, or description); `reference_id` inserts retry
  on unique-violation; service_role key is server-only
  (`SecretStr`, never `NEXT_PUBLIC_`).

## Privacy

- No complainant name/identity column at all; phone is optional and
  operational-only. Dashboard reads an anonymised view exposing
  `reference_id, category, status, priority, depot, sla_breached, created_at` —
  never `contact_phone`, `location_text` verbatim, or anything framed
  as verified fact (complaints are allegations until reviewed).
