-- 006_telegram_flow.sql — conversational Telegram complaint flow.
--
-- Port of the BloodLink pattern: one-question-at-a-time, inline buttons,
-- conversation state persisted in Postgres (stateless functions), atomic
-- claim to defeat double-taps, /cancel safety. Only 'done' conversations
-- carry a final complaint payload; aborted/unknown states hold none.
--
-- Run after 001-005. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Conversation state per Telegram chat. `data` is a scratch jsonb shaped
--    by the Edge Function (category/route_text/description/...); it is never
--    trusted at insert time — app_file_complaint re-validates everything.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telegram_conversations (
  chat_id    bigint PRIMARY KEY,
  state      text NOT NULL DEFAULT 'idle',
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE telegram_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON telegram_conversations FROM PUBLIC, anon, authenticated;
GRANT ALL ON telegram_conversations TO service_role;

-- get-or-create. ON CONFLICT DO UPDATE (not DO NOTHING): RETURNING yields
-- the row in BOTH cases, so an existing conversation is always returned.
CREATE OR REPLACE FUNCTION tg_conv_get(p_chat_id bigint) RETURNS telegram_conversations
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v telegram_conversations;
BEGIN
  INSERT INTO telegram_conversations (chat_id) VALUES (p_chat_id)
  ON CONFLICT (chat_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO v;
  RETURN v;
END $$;

-- save state (upsert)
CREATE OR REPLACE FUNCTION tg_conv_save(p_chat_id bigint, p_state text, p_data jsonb)
RETURNS void LANGUAGE sql VOLATILE AS $$
  INSERT INTO telegram_conversations (chat_id, state, data, updated_at)
  VALUES (p_chat_id, p_state, COALESCE(p_data, '{}'::jsonb), now())
  ON CONFLICT (chat_id) DO UPDATE
    SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = now();
$$;

-- clear (idle, empty payload)
CREATE OR REPLACE FUNCTION tg_conv_clear(p_chat_id bigint) RETURNS void
LANGUAGE sql VOLATILE AS $$
  INSERT INTO telegram_conversations (chat_id, state, data, updated_at)
  VALUES (p_chat_id, 'idle', '{}'::jsonb, now())
  ON CONFLICT (chat_id) DO UPDATE
    SET state = 'idle', data = '{}'::jsonb, updated_at = now();
$$;

-- Atomic claim: only transitions FROM p_from (double-tap / race defeated:
-- the second caller finds a different state and gets 0 rows).
CREATE OR REPLACE FUNCTION tg_conv_claim(p_chat_id bigint, p_from text, p_to text, p_data jsonb)
RETURNS boolean LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  n int;
BEGIN
  UPDATE telegram_conversations
     SET state = p_to, data = COALESCE(p_data, data), updated_at = now()
   WHERE chat_id = p_chat_id AND state = p_from;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Link complaints to the Telegram chat that filed them (powers /my and
--    future status notifications). Nullable: web/API complaints stay NULL.
-- ---------------------------------------------------------------------------
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;
CREATE INDEX IF NOT EXISTS idx_complaints_tg_chat ON complaints (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. app_file_complaint v2: optional p_telegram_chat_id, returns chat id back.
--    Same validation/re-validation policy as v1 (values from conversation
--    jsonb are untrusted and re-checked here).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app_file_complaint(text,text,uuid,text,text,text,text,text);
CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_telegram_chat_id bigint DEFAULT NULL
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
                              depot_id, status, priority, sla_due_at, telegram_chat_id)
      VALUES (v_ref, NULLIF(btrim(COALESCE(p_bus_number, '')), ''), v_route,
              NULLIF(v_rtext, ''), p_category,
              NULLIF(btrim(COALESCE(p_location_text, '')), ''), v_desc,
              NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
              v_depot, v_status, COALESCE(p_priority, 'normal'), v_due,
              p_telegram_chat_id);
      INSERT INTO status_history (complaint_id, from_status, to_status)
      SELECT id, NULL, v_status FROM complaints WHERE reference_id = v_ref;
      RETURN jsonb_build_object(
        'reference_id', v_ref, 'status', v_status,
        'depot', v_depot_name, 'sla_due_at', v_due,
        'telegram_chat_id', p_telegram_chat_id);
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. /my — recent complaints from this chat (allowlisted fields only).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_my_complaints(p_chat_id bigint, p_limit int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 5), 10));
BEGIN
  RETURN COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'reference_id', c.reference_id, 'category', c.category,
      'status', c.status, 'depot', d.name,
      'sla_breached', c.sla_breached, 'created_at', c.created_at) AS x
    FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id
    WHERE c.telegram_chat_id = p_chat_id
    ORDER BY c.created_at DESC
    LIMIT lim
  ) s;
END $$;

REVOKE EXECUTE ON FUNCTION tg_conv_get(bigint), tg_conv_save(bigint,text,jsonb),
  tg_conv_clear(bigint), tg_conv_claim(bigint,text,text,jsonb),
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint),
  app_my_complaints(bigint,int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tg_conv_get(bigint), tg_conv_save(bigint,text,jsonb),
  tg_conv_clear(bigint), tg_conv_claim(bigint,text,text,jsonb),
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint),
  app_my_complaints(bigint,int)
  TO service_role;

COMMIT;
