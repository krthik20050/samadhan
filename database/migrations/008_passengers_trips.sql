-- 008_passengers_trips.sql — two fixes:
--
-- 1. Route search understands OD phrases: "Guruvayoor to Thrissur" previously
--    matched nothing (substring ILIKE cannot bridge the alias + separator).
--    app_list_routes now parses q through app_route_text_od_key (the same
--    canonical pipeline as filing) and matches od_match_key in both
--    directions first.
--
-- 2. Passenger accounts + saved trips. /link in Telegram binds a chat to a
--    phone; trips the passenger files (or pins) are remembered so the next
--    complaint is two taps. NOTE: KSRTC publishes no booking API — trips are
--    the passenger's own history from this system, not a live KSRTC feed.
--    If the organisers supply an account API, tg_passenger_* is the seam.
--
-- Run after 001-007. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. app_list_routes v2: OD-phrase aware.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_list_routes(p_q text DEFAULT '', p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  needle text := COALESCE(btrim(COALESCE(p_q, '')), '');
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  od_key text;
  rev_key text;
BEGIN
  od_key := app_route_text_od_key(needle);          -- NULL unless q parses as "A to B"
  IF od_key IS NOT NULL AND position('|' in od_key) > 0 THEN
    rev_key := split_part(od_key, '|', 2) || '|' || split_part(od_key, '|', 1);
  END IF;

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
       OR (od_key IS NOT NULL AND (r.od_match_key = od_key OR r.od_match_key = rev_key))
       OR r.name ILIKE '%' || needle || '%'
       OR r.origin ILIKE '%' || needle || '%'
       OR r.destination ILIKE '%' || needle || '%'
       OR EXISTS (SELECT 1 FROM route_aliases a
                  WHERE a.route_id = r.id
                    AND a.match_key LIKE '%' || lower(needle) || '%')
    -- exact OD phrase match wins, then auto-routable, then alphabetical
    ORDER BY (od_key IS NOT NULL AND r.od_match_key = od_key) DESC,
             (od_key IS NOT NULL AND r.od_match_key = rev_key) DESC,
             (d.name IS NOT NULL) DESC,
             r.name
    LIMIT lim
  ) s;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Passengers (Telegram chat <-> phone) and their saved trips.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passengers (
  chat_id    bigint PRIMARY KEY,
  phone      text NOT NULL UNIQUE,
  name       text,
  linked_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON passengers FROM PUBLIC, anon, authenticated;
GRANT ALL ON passengers TO service_role;

CREATE TABLE IF NOT EXISTS trips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     bigint NOT NULL REFERENCES passengers(chat_id) ON DELETE CASCADE,
  route_id    uuid REFERENCES routes(id) ON DELETE SET NULL,
  route_label text NOT NULL,                -- display name at save time
  bus_number  text,
  use_count   integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, route_label, bus_number)
);
CREATE INDEX IF NOT EXISTS idx_trips_chat ON trips (chat_id, last_used_at DESC);
-- NULL bus numbers are distinct in a plain UNIQUE constraint (NULL != NULL),
-- so dedupe must compare COALESCE(bus_number, '') — functional unique index.
DELETE FROM trips a USING trips b
  WHERE a.chat_id = b.chat_id AND a.route_label = b.route_label
    AND COALESCE(a.bus_number, '') = COALESCE(b.bus_number, '') AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_chat_label_bus
  ON trips (chat_id, route_label, COALESCE(bus_number, ''));
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trips FROM PUBLIC, anon, authenticated;
GRANT ALL ON trips TO service_role;

-- link (upsert chat -> phone)
CREATE OR REPLACE FUNCTION tg_passenger_link(p_chat_id bigint, p_phone text, p_name text)
RETURNS void LANGUAGE sql VOLATILE AS $$
  INSERT INTO passengers (chat_id, phone, name) VALUES (p_chat_id, p_phone, p_name)
  ON CONFLICT (chat_id) DO UPDATE
    SET phone = EXCLUDED.phone, name = COALESCE(EXCLUDED.name, passengers.name),
        linked_at = now();
$$;

CREATE OR REPLACE FUNCTION tg_passenger_get(p_chat_id bigint)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('chat_id', chat_id, 'phone', phone, 'name', name)
  FROM passengers WHERE chat_id = p_chat_id;
$$;

CREATE OR REPLACE FUNCTION tg_passenger_unlink(p_chat_id bigint) RETURNS void
LANGUAGE sql VOLATILE AS $$
  DELETE FROM passengers WHERE chat_id = p_chat_id;
$$;

-- remember a trip (called on submit when linked)
CREATE OR REPLACE FUNCTION tg_trip_save(
  p_chat_id bigint, p_route_id uuid, p_route_label text, p_bus_number text
) RETURNS void LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  IF p_route_label IS NULL OR btrim(p_route_label) = '' THEN RETURN; END IF;
  INSERT INTO trips (chat_id, route_id, route_label, bus_number)
  VALUES (p_chat_id, p_route_id, btrim(p_route_label), NULLIF(btrim(COALESCE(p_bus_number, '')), ''))
  ON CONFLICT (chat_id, route_label, COALESCE(bus_number, '')) DO UPDATE
    SET use_count = trips.use_count + 1, last_used_at = now(),
        route_id = COALESCE(EXCLUDED.route_id, trips.route_id);
END $$;

CREATE OR REPLACE FUNCTION tg_trip_list(p_chat_id bigint, p_limit int DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 5), 10));
BEGIN
  RETURN COALESCE(jsonb_agg(x), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'route_id', t.route_id, 'route_label', t.route_label,
      'bus_number', t.bus_number, 'use_count', t.use_count) AS x
    FROM trips t WHERE t.chat_id = p_chat_id
    ORDER BY t.use_count DESC, t.last_used_at DESC
    LIMIT lim
  ) s;
END $$;

-- Web account panel: per-chat trips + complaints (allowlisted, no PII beyond
-- the chat's own operational phone). Guarded at the router by staff Bearer OR
-- a self-service chat_id in future Supabase Auth — service-role only here.
CREATE OR REPLACE FUNCTION app_my_trips(p_chat_id bigint, p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 10), 25));
BEGIN
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

CREATE OR REPLACE FUNCTION app_my_complaints(p_chat_id bigint, p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
BEGIN
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

REVOKE EXECUTE ON FUNCTION
  tg_passenger_link(bigint,text,text), tg_passenger_get(bigint),
  tg_passenger_unlink(bigint), tg_trip_save(bigint,uuid,text,text),
  tg_trip_list(bigint,int), app_list_routes(text,int),
  app_my_trips(bigint,int), app_my_complaints(bigint,int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  tg_passenger_link(bigint,text,text), tg_passenger_get(bigint),
  tg_passenger_unlink(bigint), tg_trip_save(bigint,uuid,text,text),
  tg_trip_list(bigint,int), app_list_routes(text,int),
  app_my_trips(bigint,int), app_my_complaints(bigint,int)
  TO service_role;

COMMIT;
