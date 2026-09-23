-- 005_supabase_rpcs.sql — move the API business logic into Postgres.
--
-- Part of the Supabase-only hosting shift: the Edge Function (functions/api)
-- becomes a thin router that calls these RPCs, so the logic that lived in
-- FastAPI services runs inside the database instead. Shapes mirror the
-- FastAPI responses 1:1 so the frontend keeps the same contract.
--
-- Run after 001-004. Safe to re-run (CREATE OR REPLACE).
-- Only service_role (the Edge Function) and the DB owner may execute.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Reference IDs: 'KSRTC-YYYY-XXXXXX' (same pattern the DB check enforces;
--    unambiguous alphabet, collision-retried, unique index is the guard).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_reference_id() RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ref text;
  i int;
BEGIN
  FOR attempt IN 1..5 LOOP
    ref := 'KSRTC-' || to_char(now(), 'YYYY') || '-';
    FOR i IN 1..6 LOOP
      ref := ref || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM complaints WHERE reference_id = ref) THEN
      RETURN ref;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'reference id exhausted';
END $$;

-- ---------------------------------------------------------------------------
-- 2. Free-text route parsing — Python mirror of
--    app/core/normalize.py:route_text_match_key (via-clause dropped first,
--    then arrow / TO / dash separators, then single-token fallback).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_route_text_od_key(p_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t text;
  m text[];
  sep text;
  pat text;
  o text;
  d text;
BEGIN
  t := upper(COALESCE(p_text, ''));
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  IF t = '' THEN RETURN NULL; END IF;
  -- drop the 'via ...' clause (dataset route names never carry one)
  t := btrim((regexp_split_to_array(t, '\s+VIA\s+'))[1]);

  -- arrow (spaced or not), spaced TO, spaced dash, bare dash — first hit wins
  FOREACH sep IN ARRAY ARRAY['→', '->', '—', '–'] LOOP
    pat := '^(.*?)\s*' || sep || '\s*(.*)$';
    m := (regexp_match(t, pat));
    IF m IS NOT NULL AND btrim(m[1]) <> '' AND btrim(m[2]) <> '' THEN
      RETURN normalize_place_token(m[1]) || '|' || normalize_place_token(m[2]);
    END IF;
  END LOOP;
  m := (regexp_match(t, '^(.*?)\s+TO\s+(.*)$'));
  IF m IS NOT NULL AND btrim(m[1]) <> '' AND btrim(m[2]) <> '' THEN
    RETURN normalize_place_token(m[1]) || '|' || normalize_place_token(m[2]);
  END IF;
  m := (regexp_match(t, '^(.*?)-(.*)$'));
  IF m IS NOT NULL AND btrim(m[1]) <> '' AND btrim(m[2]) <> '' THEN
    RETURN normalize_place_token(m[1]) || '|' || normalize_place_token(m[2]);
  END IF;

  -- single token: an alias row may still hit (e.g. a bare place name)
  RETURN normalize_place_token(t);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Route resolution (mirror of services/depot.py): exact name → dataset
--    alias → canonical OD key. Deterministic pick among candidates; only a
--    VERIFIED mapping may auto-route; unknown text means needs_triage, never
--    a rejection.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_resolve_route(
  p_route_id uuid, p_route_text text,
  OUT o_route_id uuid, OUT o_depot_id uuid, OUT o_depot_name text, OUT o_status text
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  candidates uuid[];
  best uuid;
  best_id uuid;
  best_name text;
BEGIN
  o_route_id := NULL; o_depot_id := NULL; o_depot_name := NULL; o_status := 'needs_triage';

  IF p_route_id IS NOT NULL THEN
    SELECT id INTO best_id FROM routes WHERE id = p_route_id;
    IF best_id IS NULL THEN
      RAISE EXCEPTION 'unknown route_id' USING ERRCODE = 'P0001';
    END IF;
  ELSIF COALESCE(btrim(COALESCE(p_route_text, '')), '') <> '' THEN
    -- 1. exact display name
    SELECT id INTO best_id FROM routes
    WHERE name ILIKE btrim(p_route_text) LIMIT 1;
    -- 2. dataset alias (lowercase key, stored verbatim at import)
    IF best_id IS NULL THEN
      SELECT r.id INTO best_id
      FROM route_aliases a JOIN routes r ON r.id = a.route_id
      WHERE a.match_key = lower(btrim(p_route_text))
      ORDER BY (EXISTS (SELECT 1 FROM route_depot_mapping m
                        WHERE m.route_id = r.id AND m.mapping_status = 'VERIFIED')) DESC,
               r.name
      LIMIT 1;
    END IF;
    -- 3. canonical OD key
    IF best_id IS NULL THEN
      SELECT r.id INTO best_id
      FROM routes r
      WHERE r.od_match_key = app_route_text_od_key(p_route_text)
      ORDER BY (EXISTS (SELECT 1 FROM route_depot_mapping m
                        WHERE m.route_id = r.id AND m.mapping_status = 'VERIFIED')) DESC,
               r.name
      LIMIT 1;
    END IF;
  ELSE
    RETURN;  -- nothing to resolve on
  END IF;

  IF best_id IS NULL THEN
    RETURN;  -- needs_triage, no route attached
  END IF;

  o_route_id := best_id;
  SELECT d.id, d.name INTO o_depot_id, o_depot_name
  FROM route_depot_mapping m JOIN depots d ON d.id = m.depot_id
  WHERE m.route_id = best_id AND m.mapping_status = 'VERIFIED'
  ORDER BY d.name LIMIT 1;
  o_status := CASE WHEN o_depot_id IS NULL THEN 'needs_triage' ELSE 'submitted' END;
END $$;

-- ---------------------------------------------------------------------------
-- 4. File a complaint — one atomic RPC (validate -> resolve -> SLA -> insert
--    + history). Mirrors POST /api/v1/complaints.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal'
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_cats text[] := ARRAY['cleanliness','unsafe_driving','overcrowding','missed_stop',
    'concession_denied','ticketing','staff_behaviour','bus_condition','other'];
  v_prios text[] := ARRAY['low','normal','high','critical'];
  v_route uuid; v_depot uuid; v_depot_name text; v_status text;
  v_hours int;
  v_ref text;
  v_due timestamptz;
  v_desc text := btrim(COALESCE(p_description, ''));
  v_rtext text := btrim(COALESCE(p_route_text, ''));
BEGIN
  IF NOT (p_category = ANY(v_cats)) THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023';
  END IF;
  IF NOT (COALESCE(p_priority, 'normal') = ANY(v_prios)) THEN
    RAISE EXCEPTION 'invalid priority' USING ERRCODE = '22023';
  END IF;
  IF length(v_desc) < 10 OR length(v_desc) > 5000 THEN
    RAISE EXCEPTION 'description must be 10-5000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_route_id IS NULL AND v_rtext = '' THEN
    RAISE EXCEPTION 'either route_id or route_text is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_route, v_depot, v_depot_name, v_status
  FROM app_resolve_route(p_route_id, v_rtext);

  SELECT resolution_hours INTO v_hours
  FROM sla_rules
  WHERE category = p_category AND priority = COALESCE(p_priority, 'normal')
  UNION ALL
  SELECT resolution_hours FROM sla_rules WHERE category = p_category AND priority = 'normal'
  UNION ALL
  SELECT resolution_hours FROM sla_rules WHERE category = 'other' AND priority = 'normal'
  LIMIT 1;
  v_hours := COALESCE(v_hours, 96);
  v_due := now() + make_interval(hours => v_hours);

  FOR attempt IN 1..5 LOOP
    BEGIN
      v_ref := app_reference_id();
      INSERT INTO complaints (reference_id, bus_number, route_id, route_text,
                              category, location_text, description, contact_phone,
                              depot_id, status, priority, sla_due_at)
      VALUES (v_ref, NULLIF(btrim(COALESCE(p_bus_number, '')), ''), v_route,
              NULLIF(v_rtext, ''), p_category,
              NULLIF(btrim(COALESCE(p_location_text, '')), ''), v_desc,
              NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
              v_depot, v_status, COALESCE(p_priority, 'normal'), v_due);
      INSERT INTO status_history (complaint_id, from_status, to_status)
      SELECT id, NULL, v_status FROM complaints WHERE reference_id = v_ref;
      RETURN jsonb_build_object(
        'reference_id', v_ref, 'status', v_status,
        'depot', v_depot_name, 'sla_due_at', v_due);
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Track by reference (public allowlist — never phone/verbatim location).
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
           'changed_by', x.changed_by, 'created_at', x.created_at)
           ORDER BY x.created_at), '[]'::jsonb)
  INTO h
  FROM status_history x
  WHERE x.complaint_id = (SELECT id FROM complaints WHERE reference_id = v_ref);
  RETURN c || jsonb_build_object('history', h);
END $$;

-- ---------------------------------------------------------------------------
-- 6. Lookups (dataset-backed dropdowns).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_list_routes(p_q text DEFAULT '', p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  needle text := COALESCE(btrim(COALESCE(p_q, '')), '');
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  RETURN jsonb_build_object('items', COALESCE(jsonb_agg(x), '[]'::jsonb))
  FROM (
    SELECT jsonb_build_object(
      'id', r.id, 'name', r.name, 'origin', r.origin, 'destination', r.destination,
      'service_type', r.service_type, 'depot_name', d.name,
      'auto_routable', (d.name IS NOT NULL)) AS x
    FROM routes r
    LEFT JOIN LATERAL (
      SELECT dep.name FROM route_depot_mapping m
      JOIN depots dep ON dep.id = m.depot_id
      WHERE m.route_id = r.id AND m.mapping_status = 'VERIFIED'
      ORDER BY dep.name LIMIT 1
    ) d ON true
    WHERE needle = ''
       OR r.name ILIKE '%' || needle || '%'
       OR r.origin ILIKE '%' || needle || '%'
       OR r.destination ILIKE '%' || needle || '%'
       OR EXISTS (SELECT 1 FROM route_aliases a
                  WHERE a.route_id = r.id
                    AND a.match_key LIKE '%' || lower(needle) || '%')
    ORDER BY (d.name IS NOT NULL) DESC, r.name
    LIMIT lim
  ) s(x);
END $$;

CREATE OR REPLACE FUNCTION app_list_depots(p_q text DEFAULT '', p_limit int DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  needle text := COALESCE(btrim(COALESCE(p_q, '')), '');
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 200), 300));
BEGIN
  RETURN jsonb_build_object('items', COALESCE(jsonb_agg(x), '[]'::jsonb))
  FROM (
    SELECT jsonb_build_object(
      'id', dep.id, 'name', dep.name, 'district', dep.district,
      'phone', dep.phone, 'email', dep.email, 'zone', dep.zone,
      'verified_routes', count(m.route_id) FILTER (WHERE m.mapping_status = 'VERIFIED')
    ) AS x
    FROM depots dep
    LEFT JOIN route_depot_mapping m ON m.depot_id = dep.id
    WHERE needle = ''
       OR dep.name ILIKE '%' || needle || '%'
       OR COALESCE(dep.district, '') ILIKE '%' || needle || '%'
    GROUP BY dep.id
    ORDER BY count(m.route_id) FILTER (WHERE m.mapping_status = 'VERIFIED') DESC, dep.name
    LIMIT lim
  ) s(x);
END $$;

-- ---------------------------------------------------------------------------
-- 7. Dashboard (anonymised). List requires staff auth — enforced at the
--    router (Bearer ADMIN_API_TOKEN), same fail-closed rule as FastAPI.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_dashboard_summary() RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'complaints', (SELECT count(*) FROM complaints),
    'sla_breaches', (SELECT count(*) FROM complaints WHERE sla_breached),
    'escalations', (SELECT count(*) FROM complaints WHERE status = 'escalated'),
    'needs_triage', (SELECT count(*) FROM complaints WHERE status = 'needs_triage'),
    'by_category', COALESCE((SELECT jsonb_object_agg(category, n) FROM
      (SELECT category, count(*) AS n FROM complaints GROUP BY category) t), '{}'::jsonb),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, n) FROM
      (SELECT status, count(*) AS n FROM complaints GROUP BY status) t), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION app_dashboard_complaints(
  p_limit int DEFAULT 20, p_offset int DEFAULT 0,
  p_status text DEFAULT NULL, p_category text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));
  off int := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN
    ('submitted','in_review','resolved','closed','escalated','needs_triage') THEN
    RAISE EXCEPTION 'unknown status' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NOT NULL AND p_category NOT IN
    ('cleanliness','unsafe_driving','overcrowding','missed_stop',
     'concession_denied','ticketing','staff_behaviour','bus_condition','other') THEN
    RAISE EXCEPTION 'unknown category' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'items', COALESCE(jsonb_agg(x), '[]'::jsonb),
    'total', (SELECT count(*) FROM complaints c
              WHERE (p_status IS NULL OR c.status = p_status)
                AND (p_category IS NULL OR c.category = p_category)),
    'limit', lim, 'offset', off)
  FROM (
    SELECT jsonb_build_object(
      'reference_id', c.reference_id, 'category', c.category, 'status', c.status,
      'priority', c.priority, 'depot', d.name, 'sla_breached', c.sla_breached,
      'created_at', c.created_at) AS x
    FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
    WHERE (p_status IS NULL OR c.status = p_status)
      AND (p_category IS NULL OR c.category = p_category)
    ORDER BY c.created_at DESC
    LIMIT lim OFFSET off
  ) s(x);
END $$;

-- ---------------------------------------------------------------------------
-- 8. SLA sweep: mark breaches (Phase 6's checker). Scheduled every 10 min
--    via pg_cron when the extension is present. Status is not flipped here —
--    escalation stays a deliberate human step.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_sla_sweep() RETURNS int
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  n int;
BEGIN
  WITH marked AS (
    UPDATE complaints
    SET sla_breached = true
    WHERE sla_due_at IS NOT NULL AND sla_due_at < now()
      AND sla_breached = false
      AND status NOT IN ('resolved', 'closed')
    RETURNING 1
  )
  SELECT count(*) INTO n FROM marked;
  RETURN n;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('samadhan-sla-sweep')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'samadhan-sla-sweep');
    PERFORM cron.schedule('samadhan-sla-sweep', '*/10 * * * *',
                          'SELECT public.app_sla_sweep()');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. Lock down: only the owner and service_role (Edge Function) execute.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION app_reference_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_file_complaint(text,text,uuid,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_track_complaint(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_list_routes(text,int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_list_depots(text,int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_dashboard_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_dashboard_complaints(int,int,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app_sla_sweep() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_reference_id() TO service_role;
GRANT EXECUTE ON FUNCTION app_file_complaint(text,text,uuid,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION app_track_complaint(text) TO service_role;
GRANT EXECUTE ON FUNCTION app_list_routes(text,int) TO service_role;
GRANT EXECUTE ON FUNCTION app_list_depots(text,int) TO service_role;
GRANT EXECUTE ON FUNCTION app_dashboard_summary() TO service_role;
GRANT EXECUTE ON FUNCTION app_dashboard_complaints(int,int,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION app_sla_sweep() TO service_role;

COMMIT;
