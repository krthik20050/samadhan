# Seeds — real KSRTC data (NOT fabricated)

Source of truth lives in the sibling scrape (outside this repo):

- `../dataset/data/final/depots.csv` — official depots
  (`depot_id,depot_name,district,address,phone,...`)
- `../dataset/data/final/routes.csv` — routes
  (`route_id,route_name,origin,destination,service_type,...`)
- `../dataset/data/final/route_depot_mapping.csv` — route->depot
  (`route_id,depot_id,mapping_status,review_required,...`)
- `../dataset/data/final/route_aliases.csv` — route name variants
  (published spellings; powers alias-aware complaint routing)

Our tables keep the dataset IDs in `external_id`, so re-imports are idempotent.

## Import (scripted — use this)

```powershell
cd backend
.venv\Scripts\python -m scripts.import_dataset
```

- Stages each CSV via `COPY` and merges set-based (fast over the Supabase
  pooler; a full run is a handful of round-trips).
- Upserts on `external_id`; UNKNOWN/no-depot mapping rows are skipped by
  design (they surface as `needs_triage` at runtime).
- Every run appends a row to `import_runs` (provenance: when, from where,
  how many rows).
- Requires migration `004_lookup_hardening.sql` (route_aliases, od_match_key,
  depot contact columns, import_runs). After a first import on an existing
  DB, re-run the migration's backfill or execute
  `UPDATE routes SET origin = origin, destination = destination` once so the
  trigger populates `od_match_key`.

Only `VERIFIED` mappings auto-assign a depot; `PROBABLE` rows with
`review_required=true` fall back to `needs_triage` (enforced in app logic).

## Manual import (Supabase-safe, legacy fallback)

Run migrations over the **direct** connection (`db.<ref>.supabase.co:5432`,
session mode) — NOT the pooler (`:6543`, transaction mode) and NOT `\copy`
(it is psql-only and fails in the Dashboard SQL editor).

```sql
-- Permanent staging table (TEMP tables die under the pooler).
CREATE TABLE IF NOT EXISTS stg_depots (
  depot_id text, depot_name text, district text,
  address text, phone text
);
-- Load via psql \copy (direct connection) or Dashboard table-import, then:
INSERT INTO depots (name, district, phone, address, external_id)
SELECT depot_name, district, phone, address, depot_id FROM stg_depots
ON CONFLICT (external_id) DO UPDATE
SET name = EXCLUDED.name, district = EXCLUDED.district,
    phone = EXCLUDED.phone, address = EXCLUDED.address;
-- Same pattern for routes (external_id <- route_id), then resolve the
-- mapping through both external_ids. Drop staging tables when done.
```
