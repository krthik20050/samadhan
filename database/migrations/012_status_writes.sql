-- 012_status_writes.sql — staff status writes with transition + audit safety.
--
-- Closes KNOWN_LIMITATIONS #4 / API_GAPS "status writes": the admin console
-- could read everything but could not advance a complaint's lifecycle.
--
-- Adds, in order:
--   1. app_set_status(p_ref, p_new_status, p_note, p_actor, p_request_id):
--      the ONLY sanctioned way to change a complaint's status. Re-checks the
--      transition against the SAME map the enforce_status_transition trigger
--      enforces (003), so callers get a clean 422-style SQLSTATE instead of a
--      raw trigger exception; writes status_history with actor + note; writes
--      an audit_log row. Idempotent when already in the target state
--      (no-op re-write of history is skipped; same-state request = 200 OK).
--   2. app_status_history(p_ref): safe history read for the status endpoint
--      (keeps caller SQL surface minimal; service_role-only).
--   3. app_track_complaint: include status_history.note in the public track
--      payload — otherwise an operator's note ("depot picked it up") is
--      invisible to the passenger whose complaint it concerns.
--
-- Why re-check transitions in the function when a trigger also enforces them?
-- The trigger raises a generic exception with no clean machine-readable
-- contract; pre-checking lets the API return precise, user-safe errors, and
-- keeps the authoritative rule in one place (this map) — the trigger remains
-- as the last line of defence against any path that bypasses this function.
--
-- Run after 011. Safe to re-run.

BEGIN;

CREATE OR REPLACE FUNCTION app_set_status(
  p_ref text,
  p_new_status text,
  p_note text DEFAULT NULL,
  p_actor text DEFAULT NULL,
  p_request_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_allowed text[] := ARRAY['submitted','needs_triage','in_review','escalated','resolved','closed'];
  v_ref text := upper(btrim(COALESCE(p_ref, '')));
  v_note text;
  v_current text;
  v_complaint record;
  v_updated_at timestamptz;
BEGIN
  IF NOT (p_new_status = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'unknown status %', p_new_status USING ERRCODE = '22023';
  END IF;
  IF p_note IS NOT NULL THEN
    v_note := btrim(p_note);
    IF length(v_note) > 1000 THEN
      RAISE EXCEPTION 'note too long (max 1000)' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_complaint FROM complaints WHERE reference_id = v_ref;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown reference ID' USING ERRCODE = 'P0002';
  END IF;

  v_current := v_complaint.status;

  -- Same-state request: idempotent success, no duplicate history row.
  IF v_current = p_new_status THEN
    RETURN jsonb_build_object(
      'reference_id', v_ref, 'status', v_current,
      'previous_status', v_current, 'changed', false,
      'updated_at', v_complaint.updated_at);
  END IF;

  -- Transition check. Mirrors the enforce_status_transition trigger (003)
  -- exactly; written as explicit conditions (a 2-D unnest would flatten to
  -- single elements and silently never match — reviewed and avoided).
  IF NOT (
    (v_current = 'submitted'    AND p_new_status IN ('in_review','needs_triage','escalated')) OR
    (v_current = 'needs_triage' AND p_new_status IN ('in_review','escalated')) OR
    (v_current = 'in_review'    AND p_new_status IN ('resolved','escalated','closed')) OR
    (v_current = 'escalated'    AND p_new_status IN ('in_review','resolved','closed')) OR
    (v_current = 'resolved'     AND p_new_status = 'closed')
  ) THEN
    RAISE EXCEPTION 'illegal transition %->%', v_current, p_new_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE complaints SET status = p_new_status
  WHERE reference_id = v_ref
  RETURNING updated_at INTO v_updated_at;

  INSERT INTO status_history (complaint_id, from_status, to_status, changed_by, note)
  SELECT id, v_current, p_new_status, LEFT(COALESCE(p_actor, 'staff'), 100), v_note
  FROM complaints WHERE reference_id = v_ref;

  -- Audit trail (same transaction: a status change without its audit row is
  -- an integrity failure, not an advisory event — unlike filing, this write
  -- IS the consequential action).
  INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id, detail, request_id)
  VALUES (
    'staff',
    NULLIF(btrim(COALESCE(p_actor, '')), ''),
    'status_changed',
    'complaint',
    v_ref,
    jsonb_build_object(
      'from', v_current, 'to', p_new_status,
      'note', v_note,
      -- Is this a legal move per the lifecycle map? (Always true here; kept
      -- explicit for audit readability.)
      'legal', true),
    NULLIF(btrim(COALESCE(p_request_id, '')), ''));

  RETURN jsonb_build_object(
    'reference_id', v_ref, 'status', p_new_status,
    'previous_status', v_current, 'changed', true,
    'updated_at', v_updated_at);
END $$;

-- History read for the status endpoint (avoid ad-hoc SQL in callers).
CREATE OR REPLACE FUNCTION app_status_history(p_ref text)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ref text := upper(btrim(COALESCE(p_ref, '')));
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM complaints WHERE reference_id = v_ref) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'unknown reference ID' USING ERRCODE = 'P0002';
  END IF;
  RETURN COALESCE(jsonb_agg(jsonb_build_object(
           'from_status', h.from_status, 'to_status', h.to_status,
           'changed_by', h.changed_by, 'note', h.note,
           'created_at', h.created_at) ORDER BY h.created_at), '[]'::jsonb)
  FROM (
    SELECT h.* FROM status_history h
    JOIN complaints c ON c.id = h.complaint_id
    WHERE c.reference_id = v_ref
    ORDER BY h.created_at
    LIMIT 200
  ) h;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Public track payload: surface operator notes in the timeline (they are
--    already non-PII; the FastAPI/Edge track paths render them).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_track_complaint(p_ref text) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_ref text := upper(btrim(COALESCE(p_ref, '')));
  c jsonb;
  h jsonb;
BEGIN
  SELECT jsonb_build_object(
    'reference_id', c1.reference_id, 'bus_number', c1.bus_number,
    'route_text', c1.route_text, 'category', c1.category,
    'priority', c1.priority, 'status', c1.status,
    'depot', d.name, 'sla_due_at', c1.sla_due_at,
    'sla_breached', c1.sla_breached, 'created_at', c1.created_at)
  INTO c
  FROM complaints c1 LEFT JOIN depots d ON d.id = c1.depot_id
  WHERE c1.reference_id = v_ref;
  IF c IS NULL THEN
    RETURN NULL;  -- 404 at the router
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'from_status', x.from_status, 'to_status', x.to_status,
           'changed_by', x.changed_by, 'note', x.note,
           'created_at', x.created_at)
           ORDER BY x.created_at), '[]'::jsonb)
  INTO h
  FROM status_history x
  WHERE x.complaint_id = (SELECT id FROM complaints WHERE reference_id = v_ref);
  RETURN c || jsonb_build_object('history', h);
END $$;

-- Grants: service_role only, like every other app_* function.
REVOKE EXECUTE ON FUNCTION
  app_set_status(text, text, text, text, text),
  app_status_history(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  app_set_status(text, text, text, text, text),
  app_status_history(text)
  TO service_role;

COMMIT;
