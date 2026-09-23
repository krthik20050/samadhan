-- 009_robust_filing.sql — filing robustness + UX fixes.
--
-- 1. No 10-character minimum on descriptions (a short "Bus was dirty"
--    is a valid complaint). Floor drops to 1 character (NOT NULL stays).
-- 2. app_file_complaint v4 stops letting one bad piece of evidence or a
--    malformed ML date fail the WHOLE complaint:
--      - evidence rows with an empty storage_path are skipped (poisoned
--        sessions from the earlier path:null bug no longer brick Submit),
--      - mime types are sanitized to the allowlist (unknown -> NULL),
--      - travel_date must parse as YYYY-MM-DD, else stored NULL.
--
-- Run after 001-008. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Description floor: 10 -> 1 character.
-- ---------------------------------------------------------------------------
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS chk_complaint_desc;
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaint_desc CHECK (char_length(btrim(description)) BETWEEN 1 AND 5000);

-- ---------------------------------------------------------------------------
-- 2. app_file_complaint v4.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,date,jsonb,jsonb);
DROP FUNCTION IF EXISTS
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb);
CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_telegram_chat_id bigint DEFAULT NULL,
  -- text, not date: a malformed ML-extracted date must reach the guarded
  -- parser inside this function, not fail at the protocol bind step.
  p_travel_date text DEFAULT NULL,
  p_ticket_extracted jsonb DEFAULT NULL,
  p_evidence jsonb DEFAULT NULL   -- [{storage_path, mime_type, size_bytes, telegram_file_id}]
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_cats text[] := ARRAY['cleanliness','unsafe_driving','overcrowding','missed_stop',
    'concession_denied','ticketing','staff_behaviour','bus_condition','other'];
  v_prios text[] := ARRAY['low','normal','high','critical'];
  v_mimes text[] := ARRAY['image/jpeg','image/png','image/webp','image/heic',
    'application/pdf','video/mp4','video/webm','video/quicktime'];
  v_route uuid; v_depot uuid; v_depot_name text; v_status text;
  v_hours int;
  v_ref text;
  v_due timestamptz;
  v_desc text := btrim(COALESCE(p_description, ''));
  v_rtext text := btrim(COALESCE(p_route_text, ''));
  v_bus text := NULLIF(btrim(COALESCE(p_bus_number, '')), '');
  v_date date := NULL;
  v_evidence jsonb := COALESCE(p_evidence, '[]'::jsonb);
  v_evidence_ok jsonb := '[]'::jsonb;
  e jsonb;
  v_path text;
  v_mime text;
BEGIN
  IF NOT (p_category = ANY(v_cats)) THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = '22023';
  END IF;
  IF NOT (COALESCE(p_priority, 'normal') = ANY(v_prios)) THEN
    RAISE EXCEPTION 'invalid priority' USING ERRCODE = '22023';
  END IF;
  IF length(v_desc) < 1 OR length(v_desc) > 5000 THEN
    RAISE EXCEPTION 'description is required' USING ERRCODE = '22023';
  END IF;
  IF v_bus IS NOT NULL AND length(v_bus) > 20 THEN
    RAISE EXCEPTION 'bus number too long' USING ERRCODE = '22023';
  END IF;
  IF p_route_id IS NULL AND v_rtext = '' THEN
    RAISE EXCEPTION 'either route_id or route_text is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_evidence) <> 'array' OR jsonb_array_length(v_evidence) > 10 THEN
    RAISE EXCEPTION 'invalid evidence payload' USING ERRCODE = '22023';
  END IF;

  -- ML-extracted dates can be malformed ('25/09/2026', '25 Sep', garbage).
  -- Accept only ISO YYYY-MM-DD that actually casts; anything else -> NULL.
  BEGIN
    IF p_travel_date IS NOT NULL AND btrim(p_travel_date) ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_date := btrim(p_travel_date)::date;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_date := NULL;
  END;

  -- Evidence hygiene: drop pathless rows (legacy poisoned sessions), sanitize
  -- mime to the allowlist, ignore absurd sizes. Bad rows never fail the file.
  FOR e IN SELECT * FROM jsonb_array_elements(v_evidence) LOOP
    v_path := btrim(COALESCE(e->>'storage_path', ''));
    CONTINUE WHEN v_path = '' OR v_path LIKE '%..%' OR length(v_path) > 500;
    v_mime := e->>'mime_type';
    IF NOT (v_mime = ANY(v_mimes)) THEN v_mime := NULL; END IF;
    v_evidence_ok := v_evidence_ok || jsonb_build_object(
      'storage_path', v_path,
      'mime_type', v_mime,
      'size_bytes', CASE
        WHEN COALESCE((e->>'size_bytes')::bigint, 0) BETWEEN 1 AND 20971520
        THEN (e->>'size_bytes')::int ELSE NULL END,
      'telegram_file_id', NULLIF(btrim(COALESCE(e->>'telegram_file_id', '')), ''));
  END LOOP;

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
                              depot_id, status, priority, sla_due_at, telegram_chat_id,
                              travel_date, ticket_extracted)
      VALUES (v_ref, v_bus, v_route, NULLIF(v_rtext, ''), p_category,
              NULLIF(btrim(COALESCE(p_location_text, '')), ''), v_desc,
              NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
              v_depot, v_status, COALESCE(p_priority, 'normal'), v_due,
              p_telegram_chat_id, v_date, p_ticket_extracted);

      FOR e IN SELECT * FROM jsonb_array_elements(v_evidence_ok) LOOP
        INSERT INTO evidence (complaint_id, storage_path, mime_type, size_bytes, telegram_file_id)
        SELECT id, e->>'storage_path', e->>'mime_type',
               (e->>'size_bytes')::int, e->>'telegram_file_id'
        FROM complaints WHERE reference_id = v_ref;
      END LOOP;

      INSERT INTO status_history (complaint_id, from_status, to_status)
      SELECT id, NULL, v_status FROM complaints WHERE reference_id = v_ref;

      RETURN jsonb_build_object(
        'reference_id', v_ref, 'status', v_status,
        'depot', v_depot_name, 'sla_due_at', v_due,
        'telegram_chat_id', p_telegram_chat_id,
        'evidence_count', jsonb_array_length(v_evidence_ok));
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb)
  TO service_role;

COMMIT;
