-- 013_sam_reference_ids.sql — canonical SAM-YYYY-NNNNNN reference IDs.
--
-- The mission mandates a unique, immutable, server-generated reference ID of
-- the form SAM-2026-000123. The old KSRTC-YYYY-XXXXXX format must keep
-- resolving everywhere (existing tickets, Telegram history, audit rows) — so
-- this migration switches the GENERATOR, never the stored IDs:
--
--   1. reference_id_counter: one row per (prefix, year), "next number" cursor.
--      New IDs are zero-padded 6-digit integers per year — SAM-2026-000123.
--   2. app_reference_id() rewritten: lock the counter row FOR UPDATE, take the
--      next number, bump the cursor, return. The row lock serialises two
--      concurrent filings (they queue, not collide) — no read-then-insert
--      race, no random-collision retry loop. Survives concurrent inserts.
--      CHECK + UNIQUE remain as defence in depth.
--   3. chk_complaint_ref widened to accept BOTH formats:
--        ^SAM-[0-9]{4}-[0-9]{6}$  |  ^KSRTC-[0-9]{4}-[A-Z0-9]{6}$
--   4. Immutability: reference_id is NOT NULL + UNIQUE (001) and no code path
--      issues UPDATE ... SET reference_id (grepped at change time; the UPDATE
--      in app_set_status touches status only). Kept that way by review — the
--      complaint lifecycle never rewrites its identity.
--   5. Telegram draft/prefill copy in the Edge Function is updated in the same
--      change set (code, not SQL).
--
-- Idempotent: guarded re-runs, CREATE OR REPLACE for the function. Run after
-- 012. Safe to run against a live DB with existing KSRTC- rows — they stay
-- untouched and resolvable (app_track_complaint / app_set_status /
-- app_status_history all look up by exact stored value and never assume a
-- prefix; the Edge Function and FastAPI already upper()+trim caller input,
-- which is valid for both formats).
--
-- NOTE (next pass): apply to live Supabase, then redeploy nothing else — the
-- Edge Function change (dual-format copy) is independent of this SQL.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Per-year counter table. One row per (prefix, year); the cursor is the
--    last number handed out. RLS on (service_role-only, like the RPCs).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reference_id_counter (
  prefix      text NOT NULL,
  year        int  NOT NULL,
  last_number int  NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prefix, year)
);

ALTER TABLE reference_id_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reference_id_counter FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The generator. Locks the counter row, takes next, bumps cursor —
--    concurrency-safe (row lock = serialised issuance), collision-free by
--    construction, zero-padded to 6 digits. Uniqueness is structural; the
--    UNIQUE(reference_id) constraint stays as a second line of defence.
--
--    Bootstrap: if the SAM row for the current year is missing, seed the
--    cursor at 1 (first filing mints SAM-<year>-000001) — no manual setup.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_reference_id() RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_year int := date_part('year', now())::int;
  v_next int;
BEGIN
  -- INSERT .. ON CONFLICT DO UPDATE locks the row (or the just-inserted one),
  -- so two concurrent transactions issue strictly sequential numbers.
  INSERT INTO reference_id_counter (prefix, year, last_number)
  VALUES ('SAM', v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET last_number = reference_id_counter.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN 'SAM-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
END $$;

COMMENT ON FUNCTION app_reference_id() IS
  'Server-generated reference ID: SAM-YYYY-NNNNNN (zero-padded, concurrency-safe counter). KSRTC-YYYY-XXXXXX rows remain valid back-compat.';

-- ---------------------------------------------------------------------------
-- 3. Widen the CHECK to both formats. KSRTC- rows (existing tickets) stay
--    valid; new filings get SAM-.
-- ---------------------------------------------------------------------------
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS chk_complaint_ref;
ALTER TABLE complaints ADD CONSTRAINT chk_complaint_ref CHECK (
  reference_id ~ '^SAM-[0-9]{4}-[0-9]{6}$'
  OR reference_id ~ '^KSRTC-[0-9]{4}-[A-Z0-9]{6}$'
);

-- ---------------------------------------------------------------------------
-- 4. Lock down the counter to the Edge Function's role.
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON reference_id_counter TO service_role;
GRANT INSERT ON reference_id_counter TO service_role;

COMMIT;
