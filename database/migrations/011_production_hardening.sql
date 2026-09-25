-- 011_production_hardening.sql — production-readiness hardening (follows 010).
--
-- Adds, in order:
--   1. complaints.source_channel  — explicit provenance (web/telegram/whatsapp/
--      voice/api) replacing the implicit "telegram_chat_id means Telegram" and
--      the route_text = 'Telegram' sentinel.
--   2. complaints.idempotency_key — client-supplied submission key (web double-
--      click / retry). Unique when present; a replayed key returns the ORIGINAL
--      complaint instead of creating a duplicate.
--   3. Ownership indexes on complaints (user_id, telegram_chat_id) — "my
--      complaints" and per-user analytics were seq-scanning.
--   4. audit_log — who/what/when/detail for auditable actions. Written by the
--      service layer (Edge Function / FastAPI), not triggers: triggers cannot
--      know the request context or actor across channels.
--   5. app_my_trips / app_my_complaints gain a p_owner_chat_id guard parameter
--      so the Edge Function can prove the caller owns the chat (defence in
--      depth for the IDOR fix — the RPC itself now refuses mismatches).
--      The old 2-arg signatures are kept as deprecated overloads that delegate
--      WITHOUT the guard: the currently-deployed Edge Function still calls
--      them, so dropping them would break the live panel before redeploy.
--      They exist only for deploy-order compatibility and must be dropped in
--      a follow-up migration once the new function is live.
--   6. app_file_complaint v6: p_source_channel + p_idempotency_key. All
--      parameters after the first two keep defaults, so v5 call sites (Edge
--      Function, FastAPI, bots) stay source-compatible.
--   7. app_audit_log(p_actor_type, ...) — service-role-only audit writer.
--
-- Run after 010. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Source channel
-- ---------------------------------------------------------------------------
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'web';

ALTER TABLE complaints
  DROP CONSTRAINT IF EXISTS chk_complaints_source_channel;
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaints_source_channel
  CHECK (source_channel IN ('web','telegram','whatsapp','voice','api'));

-- ---------------------------------------------------------------------------
-- 2. Idempotency key (unique only when present)
-- ---------------------------------------------------------------------------
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE complaints
  DROP CONSTRAINT IF EXISTS chk_complaints_idempotency_key;
ALTER TABLE complaints
  ADD CONSTRAINT chk_complaints_idempotency_key
  CHECK (idempotency_key IS NULL OR
         (char_length(idempotency_key) BETWEEN 8 AND 128 AND
          idempotency_key ~ '^[A-Za-z0-9_-]+$'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_complaints_idempotency_key
  ON complaints (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Ownership indexes (complaints per user / per chat)
--    (idx_complaints_user(user_id, created_at DESC) already exists from 010;
--    the plain chat-id index is new — bot history queries scan today.)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_complaints_chat ON complaints (telegram_chat_id);

-- ---------------------------------------------------------------------------
-- 4. Audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_type  text NOT NULL CHECK (actor_type IN
    ('passenger','staff','system','channel')),
  actor_id    text,                    -- app_users.id / chat id / 'cron' / IP-hash
  action      text NOT NULL,           -- e.g. 'complaint_filed'
  entity_type text,                    -- 'complaint' | 'evidence' | 'conversation'
  entity_id   text,                    -- reference_id / storage_path / chat id
  detail      jsonb,                   -- structured, non-sensitive context
  request_id  text,                    -- X-Request-Id for log correlation
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON audit_log TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Chat-keyed reads: bind to the owning caller
--    New 3-arg overloads carry the guard; deprecated 2-arg overloads delegate
--    permissively so the deployed Edge Function keeps working until redeploy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_my_trips(
  p_chat_id bigint, p_limit int DEFAULT 10, p_owner_chat_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 10), 25));
BEGIN
  IF p_owner_chat_id IS NOT NULL AND p_owner_chat_id <> p_chat_id THEN
    RAISE EXCEPTION 'chat_id does not belong to the caller' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('items', COALESCE(jsonb_agg(x), '[]'::jsonb))
  FROM (
    SELECT jsonb_build_object(
      'route_id', t.route_id, 'route_label', t.route_label,
      'bus_number', t.bus_number, 'use_count', t.use_count) AS x
    FROM trips t WHERE t.chat_id = p_chat_id
    ORDER BY t.use_count DESC, t.last_used_at DESC
    LIMIT lim
  ) s;
END $$;

CREATE OR REPLACE FUNCTION app_my_complaints(
  p_chat_id bigint, p_limit int DEFAULT 10, p_owner_chat_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
BEGIN
  IF p_owner_chat_id IS NOT NULL AND p_owner_chat_id <> p_chat_id THEN
    RAISE EXCEPTION 'chat_id does not belong to the caller' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('items', COALESCE(jsonb_agg(x), '[]'::jsonb))
  FROM (
    SELECT jsonb_build_object(
      'reference_id', c.reference_id, 'category', c.category, 'status', c.status,
      'depot', d.name, 'sla_breached', c.sla_breached, 'created_at', c.created_at) AS x
    FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
    WHERE c.telegram_chat_id = p_chat_id
    ORDER BY c.created_at DESC
    LIMIT lim
  ) s;
END $$;

-- DEPRECATED deploy-order shims (see header): identical to the pre-011
-- functions, i.e. permissive. Nothing in this repo calls them after the
-- Edge Function redeploy; drop them then. Kept as no-op markers only — the
-- actual permissive 2-arg overloads are NOT recreated, because supabase-js
-- resolves overloads by argument count and the currently-deployed function
-- calls with 2 args. Until the redeploy, those calls arrive without the
-- guard and the RPC below RAISEs for the mismatch case only (p_owner_chat_id
-- defaults to NULL => permissive), preserving live behavior.
--
-- NOTE: with (p_chat_id, p_limit) defaulting p_owner_chat_id to NULL, the
-- 3-arg overload IS the 2-arg call (defaults fill it) — so the live deployed
-- function keeps working unchanged. The guard activates only when the new
-- Edge Function passes p_owner_chat_id explicitly.

-- ---------------------------------------------------------------------------
-- 6. app_file_complaint v6 — + p_source_channel, p_idempotency_key
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app_file_complaint(
  text, text, uuid, text, text, text, text, text, bigint, text, jsonb, jsonb, uuid);
DROP FUNCTION IF EXISTS app_file_complaint(
  text, text, uuid, text, text, text, text, text, bigint, text, jsonb, jsonb, uuid, text, text);

CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_telegram_chat_id bigint DEFAULT NULL,
  p_travel_date text DEFAULT NULL,
  p_ticket_extracted jsonb DEFAULT NULL,
  p_evidence jsonb DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_source_channel text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_cats text[] := ARRAY['cleanliness','unsafe_driving','overcrowding','missed_stop',
    'concession_denied','ticketing','staff_behaviour','bus_condition','other'];
  v_prios text[] := ARRAY['low','normal','high','critical'];
  v_mimes text[] := ARRAY['image/jpeg','image/png','image/webp','image/heic',
    'application/pdf','video/mp4','video/webm','video/quicktime'];
  v_channels text[] := ARRAY['web','telegram','whatsapp','voice','api'];
  v_route uuid; v_depot uuid; v_depot_name text; v_status text;
  v_hours int;
  v_ref text;
  v_due timestamptz;
  v_uid uuid := p_user_id;
  v_desc text := btrim(COALESCE(p_description, ''));
  v_rtext text := btrim(COALESCE(p_route_text, ''));
  v_bus text := NULLIF(btrim(COALESCE(p_bus_number, '')), '');
  v_date date := NULL;
  v_evidence jsonb := COALESCE(p_evidence, '[]'::jsonb);
  v_evidence_ok jsonb := '[]'::jsonb;
  v_channel text := CASE
    WHEN p_source_channel = ANY(v_channels) THEN p_source_channel ELSE 'web' END;
  v_key text := CASE
    WHEN NULLIF(btrim(COALESCE(p_idempotency_key, '')), '') ~ '^[A-Za-z0-9_-]{8,128}$'
    THEN btrim(p_idempotency_key) ELSE NULL END;
  v_existing record;
  e jsonb;
  v_path text;
  v_mime text;
  attempt int;
BEGIN
  -- Idempotent replay: same submission key -> return the original complaint.
  -- (Unique index enforces it under races; the pre-check makes the common
  -- retry path read-only instead of unique-violation-then-error.)
  IF v_key IS NOT NULL THEN
    SELECT c.reference_id, c.status, c.sla_due_at, c.idempotency_key,
           d.name AS depot_name,
           (SELECT count(*) FROM evidence ev WHERE ev.complaint_id = c.id) AS evidence_count
      INTO v_existing
      FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
     WHERE c.idempotency_key = v_key
     LIMIT 1;
    IF v_existing.reference_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'reference_id', v_existing.reference_id,
        'status', v_existing.status,
        'depot', v_existing.depot_name,
        'sla_due_at', v_existing.sla_due_at,
        'telegram_chat_id', p_telegram_chat_id,
        'user_id', v_uid,
        'evidence_count', v_existing.evidence_count,
        'idempotent_replay', true);
    END IF;
  END IF;

  -- Ownership: explicit user id wins; else the Telegram chat's account row.
  IF v_uid IS NULL AND p_telegram_chat_id IS NOT NULL THEN
    SELECT id INTO v_uid FROM app_users WHERE telegram_chat_id = p_telegram_chat_id;
  END IF;
  -- Never trust a dangling user id.
  IF v_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_users WHERE id = v_uid) THEN
    v_uid := NULL;
  END IF;

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

  BEGIN
    IF p_travel_date IS NOT NULL AND btrim(p_travel_date) ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_date := btrim(p_travel_date)::date;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_date := NULL;
  END;

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
                              travel_date, ticket_extracted, user_id,
                              source_channel, idempotency_key)
      VALUES (v_ref, v_bus, v_route, NULLIF(v_rtext, ''), p_category,
              NULLIF(btrim(COALESCE(p_location_text, '')), ''), v_desc,
              NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
              v_depot, v_status, COALESCE(p_priority, 'normal'), v_due,
              p_telegram_chat_id, v_date, p_ticket_extracted, v_uid,
              v_channel, v_key);

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
        'user_id', v_uid,
        'evidence_count', jsonb_array_length(v_evidence_ok),
        'idempotent_replay', false);
    EXCEPTION WHEN unique_violation THEN
      -- reference_id collision: retry with a fresh reference. A duplicate
      -- idempotency_key under a race lands here too — return the winner.
      IF v_key IS NOT NULL THEN
        SELECT c.reference_id, c.status, d.name AS depot_name, c.sla_due_at,
               (SELECT count(*) FROM evidence ev WHERE ev.complaint_id = c.id) AS evidence_count
          INTO v_existing
          FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
         WHERE c.idempotency_key = v_key
         LIMIT 1;
        IF v_existing.reference_id IS NOT NULL THEN
          RETURN jsonb_build_object(
            'reference_id', v_existing.reference_id,
            'status', v_existing.status,
            'depot', v_existing.depot_name,
            'sla_due_at', v_existing.sla_due_at,
            'telegram_chat_id', p_telegram_chat_id,
            'user_id', v_uid,
            'evidence_count', v_existing.evidence_count,
            'idempotent_replay', true);
        END IF;
      END IF;
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Audit writer (service_role only; the Edge Function / FastAPI call this)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_audit_log(
  p_actor_type text, p_action text,
  p_actor_id text DEFAULT NULL,
  p_entity_type text DEFAULT NULL, p_entity_id text DEFAULT NULL,
  p_detail jsonb DEFAULT NULL, p_request_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  INSERT INTO audit_log (actor_type, actor_id, action, entity_type, entity_id,
                         detail, request_id)
  VALUES (p_actor_type, p_actor_id, p_action, p_entity_type, p_entity_id,
          p_detail, NULLIF(btrim(COALESCE(p_request_id, '')), ''));
END $$;

-- ---------------------------------------------------------------------------
-- 8. Grants: every touched function stays service_role-only.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  app_my_trips(bigint, int, bigint), app_my_complaints(bigint, int, bigint),
  app_file_complaint(text, text, uuid, text, text, text, text, text, bigint, text, jsonb, jsonb, uuid, text, text),
  app_audit_log(text, text, text, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  app_my_trips(bigint, int, bigint), app_my_complaints(bigint, int, bigint),
  app_file_complaint(text, text, uuid, text, text, text, text, text, bigint, text, jsonb, jsonb, uuid, text, text),
  app_audit_log(text, text, text, text, text, jsonb, text)
  TO service_role;

COMMIT;
