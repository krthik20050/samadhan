-- 003_hardening.sql — expert-review fixes on top of 001 + 002.
-- Run after 001 and 002: psql $DATABASE_URL -f 003_hardening.sql
-- Requires PostgreSQL 15+ (Supabase). Safe to re-run. Wrapped in a transaction.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Row Level Security: deny PostgREST anon/authenticated roles entirely.
--    Backend connects with service_role / owner connection (bypasses RLS),
--    so no policies = deny-by-default for every public role.
-- ---------------------------------------------------------------------------
ALTER TABLE depots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_depot_mapping  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence             ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Dashboard view must respect base-table RLS, not bypass it as definer.
CREATE OR REPLACE VIEW dashboard_complaints WITH (security_invoker = true) AS
SELECT c.reference_id, c.category, c.status, c.priority,
       d.name AS depot, c.sla_breached, c.created_at
FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id;

-- ---------------------------------------------------------------------------
-- 2. updated_at auto-maintenance (001 defaulted it on INSERT only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_complaints_updated_at ON complaints;
CREATE TRIGGER trg_complaints_updated_at BEFORE UPDATE ON complaints
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Status lifecycle: constrain history + enforce legal transitions.
-- ---------------------------------------------------------------------------
ALTER TABLE status_history
  ADD CONSTRAINT chk_history_to CHECK (to_status IN
    ('submitted','in_review','resolved','closed','escalated','needs_triage'));
ALTER TABLE status_history
  ADD CONSTRAINT chk_history_from CHECK (from_status IS NULL OR from_status IN
    ('submitted','in_review','resolved','closed','escalated','needs_triage'));
ALTER TABLE status_history
  ADD CONSTRAINT chk_history_note CHECK (note IS NULL OR char_length(note) <= 1000);

CREATE OR REPLACE FUNCTION enforce_status_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'submitted' AND NEW.status NOT IN ('in_review','needs_triage','escalated')
    THEN RAISE EXCEPTION 'illegal transition %->%', OLD.status, NEW.status;
  ELSIF OLD.status = 'needs_triage' AND NEW.status NOT IN ('in_review','escalated')
    THEN RAISE EXCEPTION 'illegal transition %->%', OLD.status, NEW.status;
  ELSIF OLD.status = 'in_review' AND NEW.status NOT IN ('resolved','escalated','closed')
    THEN RAISE EXCEPTION 'illegal transition %->%', OLD.status, NEW.status;
  ELSIF OLD.status = 'escalated' AND NEW.status NOT IN ('in_review','resolved','closed')
    THEN RAISE EXCEPTION 'illegal transition %->%', OLD.status, NEW.status;
  ELSIF OLD.status = 'resolved' AND NEW.status <> 'closed'
    THEN RAISE EXCEPTION 'illegal transition %->%', OLD.status, NEW.status;
  ELSIF OLD.status = 'closed' AND NEW.status <> 'closed'
    THEN RAISE EXCEPTION 'illegal transition %->%', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_transition ON complaints;
CREATE TRIGGER trg_status_transition BEFORE UPDATE OF status ON complaints
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION enforce_status_transition();

-- ---------------------------------------------------------------------------
-- 4. sla_rules domain guards (category/priority linked to app enums; sane order).
-- ---------------------------------------------------------------------------
ALTER TABLE sla_rules ADD CONSTRAINT chk_sla_cat CHECK (category IN
  ('cleanliness','unsafe_driving','overcrowding','missed_stop',
   'concession_denied','ticketing','staff_behaviour','bus_condition','other'));
ALTER TABLE sla_rules ADD CONSTRAINT chk_sla_prio CHECK (priority IN
  ('low','normal','high','critical'));
ALTER TABLE sla_rules ADD CONSTRAINT chk_sla_order CHECK (resolution_hours >= response_hours);

-- ---------------------------------------------------------------------------
-- 5. complaints data-quality guards (blank-string and PII-smuggling resistant).
-- ---------------------------------------------------------------------------
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_check;
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_description_check;
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_route CHECK
    (route_id IS NOT NULL OR NULLIF(btrim(route_text), '') IS NOT NULL);
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_desc CHECK (char_length(btrim(description)) BETWEEN 10 AND 5000);
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_loc CHECK (location_text IS NULL OR char_length(location_text) <= 300);
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_routetext CHECK (route_text IS NULL OR char_length(route_text) <= 200);
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_phone CHECK (contact_phone IS NULL OR contact_phone ~ '^\+?[0-9]{7,15}$');
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_ref CHECK (reference_id ~ '^KSRTC-[0-9]{4}-[A-Z0-9]{6}$');
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_bus CHECK (bus_number IS NULL OR char_length(bus_number) <= 20);
-- needs_triage always means "no depot assigned yet".
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_triage CHECK (status <> 'needs_triage' OR depot_id IS NULL);

-- ---------------------------------------------------------------------------
-- 6. evidence guards (backend generates the path in Phase 8; DB rejects
--    traversal, junk sizes, and non-allowlisted types).
-- ---------------------------------------------------------------------------
ALTER TABLE evidence
  ADD CONSTRAINT chk_evidence_path CHECK
    (storage_path NOT LIKE '%..%' AND char_length(btrim(storage_path)) BETWEEN 1 AND 500);
ALTER TABLE evidence
  ADD CONSTRAINT chk_evidence_mime CHECK
    (mime_type IS NULL OR mime_type IN ('image/jpeg','image/png','image/webp','application/pdf'));
ALTER TABLE evidence
  ADD CONSTRAINT chk_evidence_size CHECK
    (size_bytes IS NULL OR (size_bytes > 0 AND size_bytes <= 10485760));

-- ---------------------------------------------------------------------------
-- 7. Audit survival: deleting a complaint must not silently wipe its history.
--    Deletes are blocked; close complaints via status instead (soft-delete
--    column can be added later if hard deletes are ever needed).
-- ---------------------------------------------------------------------------
ALTER TABLE status_history DROP CONSTRAINT IF EXISTS status_history_complaint_id_fkey;
ALTER TABLE status_history ADD CONSTRAINT status_history_complaint_fk
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS evidence_complaint_id_fkey;
ALTER TABLE evidence ADD CONSTRAINT evidence_complaint_fk
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 8. Indexes: drop redundant (UNIQUE already indexes) + add composites for
--    the real query patterns (dashboard filters, route join, SLA sweep).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_depots_name;      -- covered by UNIQUE(name)
DROP INDEX IF EXISTS idx_routes_external;  -- covered by UNIQUE(external_id)
DROP INDEX IF EXISTS idx_complaints_ref;   -- covered by UNIQUE(reference_id)

CREATE INDEX IF NOT EXISTS idx_complaints_route ON complaints (route_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status_created ON complaints (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_depot_status_created ON complaints (depot_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_cat_status ON complaints (category, status);
CREATE INDEX IF NOT EXISTS idx_complaints_sla_sweep ON complaints (sla_due_at)
  WHERE sla_breached = false AND status NOT IN ('resolved', 'closed');

COMMIT;
