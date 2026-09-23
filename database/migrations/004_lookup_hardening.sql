-- 004_lookup_hardening.sql — dataset integration for route/depot lookups.
-- Adds the route_aliases table (from dataset data/final/route_aliases.csv),
-- lookup indexes, and depot contact columns used by GET /api/v1/depots.
-- Run after 001-003: psql $DATABASE_URL -f 004_lookup_hardening.sql
-- Safe to re-run. Requires PostgreSQL 15+ (Supabase).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Canonical route matching — PL/pgSQL port of dataset/scraper/normalize.py
--    (fold -> noise strip -> alias resolve -> slug). Kept in sync manually:
--    the SQL mirror is how 'Guruvayoor to Kozhikode' resolves in the DB
--    itself, without a round-trip through Python for every lookup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_od_match_key(origin text, destination text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  o text;
  d text;
BEGIN
  o := normalize_place_token(COALESCE(origin, ''));
  d := normalize_place_token(COALESCE(destination, ''));
  IF COALESCE(o, '') = '' OR COALESCE(d, '') = '' THEN
    RETURN NULL;  -- needs both halves; unknown route falls to needs_triage
  END IF;
  RETURN o || '|' || d;
END $$;

CREATE OR REPLACE FUNCTION normalize_place_token(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t text;
  prev text;
  i int;
  tok text;
  noise text[] := ARRAY[
    'BUS STATION','BUS STAND','BUSSTATION','BUSSTAND',
    'KSRTC BUS STATION','KSRTC BUS STAND','CENTRAL OFFICE','DEPOT OFFICE',
    'KSRTC','STATION','STAND','DEPOT','UNIT','OFFICE','BS'];
  alias_variants text[] := ARRAY[
    'GURUVAYOOR','KOZHIKKODE','KOZHIKKODU','TRIVANDRUM','CALICUT','ALLEPPEY',
    'COCHIN','KOCHI','QUILON','TRICHUR','CANNANORE','PALGHAT'];
  alias_canonical text[] := ARRAY[
    'GURUVAYUR','KOZHIKODE','KOZHIKODE','THIRUVANANTHAPURAM','KOZHIKODE',
    'ALAPPUZHA','ERNAKULAM','ERNAKULAM','KOLLAM','THRISSUR','KANNUR','PALAKKAD'];
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  -- fold: upper-case, strip punctuation (keep word chars + Malayalam block),
  -- collapse spaces (Python mirror uppercases in fold()).
  raw := upper(raw);
  t := regexp_replace(raw, '[^\w\u0d00-\u0d7f ]+', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := btrim(t);
  IF t = '' THEN RETURN NULL; END IF;
  -- strip noise tokens from both ends (repeat until stable)
  LOOP
    prev := t;
    FOREACH tok IN ARRAY noise LOOP
      t := regexp_replace(t, '\m' || tok || '\M$', '');
      t := regexp_replace(t, '^' || tok || '\M', '');
    END LOOP;
    t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
    EXIT WHEN t = prev;
    IF t = '' THEN RETURN NULL; END IF;
  END LOOP;
  -- alias resolve (single-token canonical forms; see backend normalize.py)
  FOR i IN 1..coalesce(array_length(alias_variants, 1), 0) LOOP
    IF t = alias_variants[i] THEN
      RETURN alias_canonical[i];
    END IF;
  END LOOP;
  RETURN t;
END $$;

-- ---------------------------------------------------------------------------
-- 1. route_aliases — dataset alias rows (idempotent by external_id).
--    A passenger typing "Guruvayoor to Kozhikode" resolves to the canonical
--    "Guruvayur - Kozhikode" route through these rows. Imported rows are
--    VERIFIED (same evidence chain as the dataset); resolver-added convenience
--    aliases are PROBABLE and never overwritten by re-imports.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_aliases (
  alias_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  alias          text NOT NULL,
  match_key      text NOT NULL,          -- canonical slug (see backend/app/core/normalize.py)
  source         text NOT NULL DEFAULT 'DATASET_IMPORT',
  mapping_status text NOT NULL DEFAULT 'VERIFIED'
                 CHECK (mapping_status IN ('VERIFIED','PROBABLE')),
  external_id    text UNIQUE,            -- dataset alias_id (stable re-imports)
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_route_aliases_key ON route_aliases (match_key);
CREATE INDEX IF NOT EXISTS idx_route_aliases_route ON route_aliases (route_id);

-- ---------------------------------------------------------------------------
-- 2. Lookup keys and indexes.
--
--    od_match_key: canonical 'ORIGIN|DESTINATION' key resolved with the same
--    normalisation the dataset used (backend/app/core/normalize.py — alias
--    table included). Maintained by trigger so it can never drift from the
--    text columns; the importer never writes it directly.
--
--    NOT unique by design: the dataset publishes both spellings of some
--    corridors as distinct services (e.g. 'Kozhikode - Ernakulam' AND
--    'Kozhikode - Kochi' — 10 such pairs), which canonically collide.
--    Resolution disambiguates deterministically: prefer a route with a
--    VERIFIED depot, then alphabetical (see services/depot.py).
--
--    Search path note: pgcrypto is installed in `extensions` (see 001), and
--    the backend connection resolves unqualified `gen_random_uuid()` there.
-- ---------------------------------------------------------------------------
ALTER TABLE routes ADD COLUMN IF NOT EXISTS od_match_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_od_key
  ON routes (lower(origin), lower(destination));

DROP INDEX IF EXISTS idx_routes_od_match_key;  -- superseded unique variant
CREATE INDEX IF NOT EXISTS idx_routes_od_match_key
  ON routes (od_match_key) WHERE od_match_key IS NOT NULL;

CREATE OR REPLACE FUNCTION routes_od_match_key() RETURNS trigger AS $$
BEGIN
  NEW.od_match_key := normalize_od_match_key(NEW.origin, NEW.destination);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_routes_od_match_key ON routes;
CREATE TRIGGER trg_routes_od_match_key BEFORE INSERT OR UPDATE OF origin, destination
ON routes FOR EACH ROW EXECUTE FUNCTION routes_od_match_key();

-- ---------------------------------------------------------------------------
-- 3. Depot contact columns consumed by GET /api/v1/depots and the frontend.
--    Values come from dataset depots.csv (address already existed).
-- ---------------------------------------------------------------------------
ALTER TABLE depots ADD COLUMN IF NOT EXISTS email   text;
ALTER TABLE depots ADD COLUMN IF NOT EXISTS zone    text;
ALTER TABLE depots ADD COLUMN IF NOT EXISTS pincode text;

-- ---------------------------------------------------------------------------
-- 4. import_runs — provenance for every dataset import (auditability):
--    when, from where, how many rows of each kind. Like 003, no public
--    policies: the backend service-role connection is the only writer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_dir   text NOT NULL,
  started_at    timestamptz NOT NULL,
  finished_at   timestamptz NOT NULL,
  depots        integer NOT NULL DEFAULT 0,
  routes        integer NOT NULL DEFAULT 0,
  mappings      integer NOT NULL DEFAULT 0,
  mappings_skipped_unknown integer NOT NULL DEFAULT 0,
  aliases       integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;

COMMIT;
