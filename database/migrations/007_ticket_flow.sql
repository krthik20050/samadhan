-- 007_ticket_flow.sql — ticket-first Telegram flow with ML extraction and
-- media proof.
--
-- Adds: evidence allowance for short videos, ticket-extraction fields on
-- complaints, and the private `evidence` Storage bucket. Bus number / route
-- already have columns; travel date and the raw extraction payload are new
-- (the payload is kept for audit: what the ML read vs what the user fixed).
--
-- Run after 001-006. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Complaint fields from the ticket (all nullable — ticketless complaints
--    are valid and stay needs_triage-able).
-- ---------------------------------------------------------------------------
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS travel_date date;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ticket_extracted jsonb;

-- ---------------------------------------------------------------------------
-- 2. Evidence domain: allow short videos alongside images/pdf and raise the
--    cap to 20 MB (Telegram bots cannot download files above 20 MB anyway).
-- ---------------------------------------------------------------------------
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS chk_evidence_mime;
ALTER TABLE evidence ADD CONSTRAINT chk_evidence_mime CHECK
  (mime_type IS NULL OR mime_type IN
    ('image/jpeg','image/png','image/webp','image/heic','application/pdf',
     'video/mp4','video/webm','video/quicktime'));
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS chk_evidence_size;
ALTER TABLE evidence ADD CONSTRAINT chk_evidence_size CHECK
  (size_bytes IS NULL OR (size_bytes > 0 AND size_bytes <= 20971520));

-- Provenance: the Telegram file the upload came from (dedupe key + audit).
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS telegram_file_id text;
CREATE INDEX IF NOT EXISTS idx_evidence_tg_file ON evidence (telegram_file_id)
  WHERE telegram_file_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Private storage bucket for evidence bytes (service-role writes only;
--    anon/authenticated get nothing — RLS on storage.objects denies them).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. app_file_complaint v3: travel date, ticket payload, and evidence rows
--    inserted atomically with the complaint.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app_file_complaint(text,text,uuid,text,text,text,text,text,bigint);
CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_telegram_chat_id bigint DEFAULT NULL,
  p_travel_date date DEFAULT NULL,
  p_ticket_extracted jsonb DEFAULT NULL,
  p_evidence jsonb DEFAULT NULL   -- [{storage_path, mime_type, size_bytes, telegram_file_id}]
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
  v_bus text := NULLIF(btrim(COALESCE(p_bus_number, '')), '');
  v_evidence jsonb := COALESCE(p_evidence, '[]'::jsonb);
  e jsonb;
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
  IF v_bus IS NOT NULL AND length(v_bus) > 20 THEN
    RAISE EXCEPTION 'bus number too long' USING ERRCODE = '22023';
  END IF;
  IF p_route_id IS NULL AND v_rtext = '' THEN
    RAISE EXCEPTION 'either route_id or route_text is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_evidence) <> 'array' OR jsonb_array_length(v_evidence) > 10 THEN
    RAISE EXCEPTION 'invalid evidence payload' USING ERRCODE = '22023';
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
                              depot_id, status, priority, sla_due_at, telegram_chat_id,
                              travel_date, ticket_extracted)
      VALUES (v_ref, v_bus, v_route, NULLIF(v_rtext, ''), p_category,
              NULLIF(btrim(COALESCE(p_location_text, '')), ''), v_desc,
              NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
              v_depot, v_status, COALESCE(p_priority, 'normal'), v_due,
              p_telegram_chat_id, p_travel_date, p_ticket_extracted);

      FOR e IN SELECT * FROM jsonb_array_elements(v_evidence) LOOP
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
        'evidence_count', jsonb_array_length(v_evidence));
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,date,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,date,jsonb,jsonb)
  TO service_role;

COMMIT;
