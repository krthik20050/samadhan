-- 010_auth_analytics.sql — real accounts + analytics.
--
-- 1. app_users: one row per person. Linked to Supabase Auth (auth_user_id),
--    and/or Telegram (telegram_chat_id), and/or phone/email. A passenger who
--    only ever used the bot gets a row backfilled from `passengers`; the row
--    claims their auth identity the first time they sign in with the same
--    phone/email (app_ensure_user).
-- 2. complaints.user_id: who owns the complaint (NULL = anonymous). Telegram
--    filings auto-link via chat_id; web filings pass the verified user id.
-- 3. app_me(p_user_id): everything the "My Account" dashboard shows — profile,
--    counts (filed / open / resolved / ticket receipts read / trips saved),
--    recent complaints with reference IDs, recent trips.
-- 4. app_admin_analytics(): the admin panel numbers — received / pending /
--    in review / escalated / resolved / urgent-attention (high+critical or
--    SLA-breached), category, DISTRICT and depot breakdowns, recent items.
--    "Tickets booked" on the user side = filings that carry a read ticket
--    receipt (KSRTC exposes no booking API; label honestly in the UI).
--
-- Security: every new function is service_role-only (the Edge Function is the
-- single caller; it verifies the user's Supabase JWT or the staff bearer
-- before calling). RLS on app_users denies everything else.
--
-- Run after 001-009. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. app_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     uuid UNIQUE,            -- Supabase auth.users.id
  email            text,
  phone            text,
  display_name     text,
  telegram_chat_id bigint UNIQUE,          -- link to the bot identity
  role             text NOT NULL DEFAULT 'passenger'
                   CHECK (role IN ('passenger','admin')),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial uniques: several rows may have NULL email/phone; non-nulls must be
-- unique case-insensitively for email, exactly for phone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_email
  ON app_users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_phone
  ON app_users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_users_chat
  ON app_users (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_users FROM PUBLIC, anon, authenticated;
GRANT ALL ON app_users TO service_role;

-- ---------------------------------------------------------------------------
-- 2. complaints ownership
-- ---------------------------------------------------------------------------
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES app_users(id);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Backfill: Telegram passengers -> app_users (idempotent)
--    auth_user_id stays NULL; app_ensure_user claims the row on first sign-in.
-- ---------------------------------------------------------------------------
INSERT INTO app_users (telegram_chat_id, phone, display_name, created_at)
SELECT p.chat_id, p.phone, p.name, p.linked_at
FROM passengers p
WHERE NOT EXISTS (
  SELECT 1 FROM app_users u
  WHERE u.telegram_chat_id = p.chat_id
     OR (p.phone IS NOT NULL AND u.phone = p.phone)
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Identity resolution: called by the Edge Function AFTER it has verified a
--    Supabase access token. Matches an auth identity to an existing row by
--    auth id -> email -> phone, else creates one. Returns the app_users id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_ensure_user(
  p_auth_user_id uuid,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_email text := NULLIF(btrim(COALESCE(p_email, '')), '');
  v_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_name  text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_id uuid;
  v_existing jsonb;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_id required' USING ERRCODE = '22023';
  END IF;

  -- Already linked?
  SELECT id INTO v_id FROM app_users WHERE auth_user_id = p_auth_user_id;
  IF v_id IS NOT NULL THEN
    UPDATE app_users SET
      email = COALESCE(v_email, email),
      phone = COALESCE(v_phone, phone),
      display_name = COALESCE(display_name, v_name),
      updated_at = now()
    WHERE id = v_id;
    SELECT jsonb_build_object('id', id, 'role', role, 'display_name', display_name)
      INTO v_existing FROM app_users WHERE id = v_id;
    RETURN v_existing;
  END IF;

  -- Claim an existing row by email (bot backfill / earlier web signup) ...
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM app_users WHERE lower(email) = lower(v_email) LIMIT 1;
  END IF;
  -- ... or by phone (bot /link backfill).
  IF v_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_id FROM app_users WHERE phone = v_phone LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE app_users SET
      auth_user_id = p_auth_user_id,
      email = COALESCE(email, v_email),
      phone = COALESCE(phone, v_phone),
      display_name = COALESCE(display_name, v_name),
      updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO app_users (auth_user_id, email, phone, display_name)
    VALUES (p_auth_user_id, v_email, v_phone, v_name)
    RETURNING id INTO v_id;
  END IF;

  SELECT jsonb_build_object('id', id, 'role', role, 'display_name', display_name)
    INTO v_existing FROM app_users WHERE id = v_id;
  RETURN v_existing;
END $$;

-- ---------------------------------------------------------------------------
-- 5. app_file_complaint v5: stamp ownership.
--    p_user_id comes from the Edge Function after JWT verification; when only
--    a Telegram chat is known, ownership resolves from the backfilled row.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb);
CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_telegram_chat_id bigint DEFAULT NULL,
  p_travel_date text DEFAULT NULL,
  p_ticket_extracted jsonb DEFAULT NULL,
  p_evidence jsonb DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
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
  v_uid uuid := p_user_id;
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
                              travel_date, ticket_extracted, user_id)
      VALUES (v_ref, v_bus, v_route, NULLIF(v_rtext, ''), p_category,
              NULLIF(btrim(COALESCE(p_location_text, '')), ''), v_desc,
              NULLIF(btrim(COALESCE(p_contact_phone, '')), ''),
              v_depot, v_status, COALESCE(p_priority, 'normal'), v_due,
              p_telegram_chat_id, v_date, p_ticket_extracted, v_uid);

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
        'evidence_count', jsonb_array_length(v_evidence_ok));
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. app_me: the passenger's own dashboard, in one call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_me(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
  v_chat bigint;
  result jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required' USING ERRCODE = '22023';
  END IF;

  SELECT telegram_chat_id INTO v_chat FROM app_users WHERE id = p_user_id;

  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'phone', u.phone,
      'display_name', u.display_name,
      'telegram_chat_id', u.telegram_chat_id,
      'role', u.role,
      'member_since', u.created_at),
    'stats', jsonb_build_object(
      'total_filed', (SELECT count(*) FROM complaints c WHERE c.user_id = p_user_id),
      'open', (SELECT count(*) FROM complaints c WHERE c.user_id = p_user_id
               AND c.status IN ('submitted','needs_triage','in_review','escalated')),
      'resolved', (SELECT count(*) FROM complaints c WHERE c.user_id = p_user_id
                   AND c.status IN ('resolved','closed')),
      'sla_breached', (SELECT count(*) FROM complaints c WHERE c.user_id = p_user_id
                       AND c.sla_breached),
      'ticket_receipts', (SELECT count(*) FROM complaints c WHERE c.user_id = p_user_id
                          AND c.ticket_extracted IS NOT NULL),
      'trips_saved', (SELECT count(*) FROM trips t WHERE t.chat_id = v_chat)),
    'recent_complaints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'reference_id', c.reference_id, 'category', c.category,
               'status', c.status, 'priority', c.priority,
               'depot', d.name, 'district', d.district,
               'route_text', c.route_text, 'bus_number', c.bus_number,
               'has_ticket', (c.ticket_extracted IS NOT NULL),
               'sla_breached', c.sla_breached,
               'created_at', c.created_at) ORDER BY c.created_at DESC)
      FROM (SELECT c.* FROM complaints c WHERE c.user_id = p_user_id
            ORDER BY c.created_at DESC LIMIT lim) c
      LEFT JOIN depots d ON d.id = c.depot_id
    ), '[]'::jsonb),
    'trips', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'route_id', t.route_id, 'route_label', t.route_label,
               'bus_number', t.bus_number, 'use_count', t.use_count,
               'last_used_at', t.last_used_at) ORDER BY t.last_used_at DESC)
      FROM (SELECT * FROM trips WHERE chat_id = v_chat
            ORDER BY last_used_at DESC LIMIT 10) t
    ), '[]'::jsonb)
  ) INTO result
  FROM app_users u
  WHERE u.id = p_user_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'unknown user' USING ERRCODE = '22023';
  END IF;
  RETURN result;
END $$;

-- ---------------------------------------------------------------------------
-- 7. app_admin_analytics: the whole admin panel, in one call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_admin_analytics()
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'received',  (SELECT count(*) FROM complaints),
      'today',     (SELECT count(*) FROM complaints WHERE created_at >= date_trunc('day', now())),
      'last_7d',   (SELECT count(*) FROM complaints WHERE created_at >= now() - interval '7 days'),
      'pending',   (SELECT count(*) FROM complaints
                    WHERE status IN ('submitted','needs_triage')),
      'in_review', (SELECT count(*) FROM complaints WHERE status = 'in_review'),
      'escalated', (SELECT count(*) FROM complaints WHERE status = 'escalated'),
      'resolved',  (SELECT count(*) FROM complaints WHERE status IN ('resolved','closed')),
      'sla_breached', (SELECT count(*) FROM complaints
                       WHERE sla_breached AND status NOT IN ('resolved','closed')),
      'urgent_attention', (SELECT count(*) FROM complaints
                           WHERE status NOT IN ('resolved','closed')
                             AND (priority IN ('high','critical') OR sla_breached)),
      'ticket_receipts', (SELECT count(*) FROM complaints
                          WHERE ticket_extracted IS NOT NULL)),
    'by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', x.category, 'n', x.n)
                        ORDER BY x.n DESC)
      FROM (SELECT category, count(*) AS n FROM complaints
            GROUP BY category ORDER BY n DESC) x
    ), '[]'::jsonb),
    'by_district', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('district', x.district, 'n', x.n)
                        ORDER BY x.n DESC)
      FROM (SELECT COALESCE(d.district, 'Unknown') AS district, count(*) AS n
            FROM complaints c JOIN depots d ON d.id = c.depot_id
            GROUP BY 1 ORDER BY n DESC) x
    ), '[]'::jsonb),
    'by_depot', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'depot', x.depot, 'district', x.district,
               'total', x.total, 'open', x.open,
               'resolved', x.resolved, 'breached', x.breached)
                        ORDER BY x.total DESC)
      FROM (SELECT d.name AS depot, COALESCE(d.district, 'Unknown') AS district,
                   count(*) AS total,
                   count(*) FILTER (WHERE c.status NOT IN ('resolved','closed')) AS open,
                   count(*) FILTER (WHERE c.status IN ('resolved','closed')) AS resolved,
                   count(*) FILTER (WHERE c.sla_breached
                                    AND c.status NOT IN ('resolved','closed')) AS breached
            FROM complaints c JOIN depots d ON d.id = c.depot_id
            GROUP BY d.name, d.district ORDER BY total DESC LIMIT 25) x
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'reference_id', c.reference_id, 'category', c.category,
               'status', c.status, 'priority', c.priority,
               'depot', d.name, 'district', d.district,
               'sla_breached', c.sla_breached, 'created_at', c.created_at)
                        ORDER BY c.created_at DESC)
      FROM (SELECT * FROM complaints ORDER BY created_at DESC LIMIT 10) c
      LEFT JOIN depots d ON d.id = c.depot_id
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Grants: every new function is service_role-only.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION app_ensure_user(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_ensure_user(uuid,text,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb,uuid)
  TO service_role;

-- Compatibility overload: a not-yet-redeployed Edge Function (or the local
-- FastAPI harness) still calls the 12-arg v4 signature. Delegate with no user.
CREATE OR REPLACE FUNCTION app_file_complaint(
  p_category text, p_description text,
  p_route_id uuid DEFAULT NULL, p_route_text text DEFAULT NULL,
  p_bus_number text DEFAULT NULL, p_location_text text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_telegram_chat_id bigint DEFAULT NULL,
  p_travel_date text DEFAULT NULL,
  p_ticket_extracted jsonb DEFAULT NULL,
  p_evidence jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  RETURN app_file_complaint(p_category, p_description, p_route_id, p_route_text,
    p_bus_number, p_location_text, p_contact_phone, p_priority, p_telegram_chat_id,
    p_travel_date, p_ticket_extracted, p_evidence, NULL);
END $$;
REVOKE EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  app_file_complaint(text,text,uuid,text,text,text,text,text,bigint,text,jsonb,jsonb)
  TO service_role;

REVOKE EXECUTE ON FUNCTION app_me(uuid,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_me(uuid,int) TO service_role;

REVOKE EXECUTE ON FUNCTION app_admin_analytics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_admin_analytics() TO service_role;

COMMIT;
