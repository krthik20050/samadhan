-- Clerk identifiers are strings (user_...), unlike legacy Supabase UUIDs.
-- Add a separate identity column without rewriting or dropping legacy links.
BEGIN;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS clerk_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_clerk ON app_users(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app_ensure_clerk_user(
  p_clerk_user_id text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL, p_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  identity text := NULLIF(btrim(p_clerk_user_id), '');
  email_value text := NULLIF(lower(btrim(p_email)), '');
  phone_value text := NULLIF(btrim(p_phone), '');
  name_value text := NULLIF(btrim(p_name), '');
  account app_users%ROWTYPE;
BEGIN
  IF identity IS NULL OR identity !~ '^user_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'invalid Clerk identity' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('clerk:' || identity, 0));
  SELECT * INTO account FROM app_users WHERE clerk_user_id = identity FOR UPDATE;
  IF account.id IS NULL AND email_value IS NOT NULL THEN
    SELECT * INTO account FROM app_users WHERE lower(email) = email_value FOR UPDATE;
  END IF;
  IF account.id IS NULL AND phone_value IS NOT NULL THEN
    SELECT * INTO account FROM app_users WHERE phone = phone_value FOR UPDATE;
  END IF;
  IF account.id IS NOT NULL THEN
    IF account.clerk_user_id IS NOT NULL AND account.clerk_user_id <> identity THEN
      RAISE EXCEPTION 'account already linked to another identity' USING ERRCODE = '23505';
    END IF;
    IF NOT account.is_active THEN
      RAISE EXCEPTION 'account is inactive' USING ERRCODE = '42501';
    END IF;
    UPDATE app_users SET clerk_user_id = identity,
      display_name = COALESCE(name_value, display_name),
      email = COALESCE(email_value, email), phone = COALESCE(phone_value, phone), updated_at = now()
    WHERE id = account.id RETURNING * INTO account;
  ELSE
    INSERT INTO app_users(clerk_user_id, email, phone, display_name)
    VALUES(identity, email_value, phone_value, name_value) RETURNING * INTO account;
  END IF;
  RETURN jsonb_build_object('id', account.id, 'role', account.role, 'display_name', account.display_name);
END $$;
REVOKE EXECUTE ON FUNCTION app_ensure_clerk_user(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_ensure_clerk_user(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION app_passenger_dashboard(p_user_id uuid, p_limit int DEFAULT 50, p_offset int DEFAULT 0, p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  lim int := GREATEST(1, LEAST(COALESCE(p_limit,50),50));
  off int := GREATEST(0,COALESCE(p_offset,0));
  result jsonb;
  totals jsonb;
  recent jsonb;
  activity jsonb;
  months jsonb;
  categories jsonb;
  filtered_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id=p_user_id AND is_active) THEN
    RAISE EXCEPTION 'unknown account' USING ERRCODE='22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('open','resolved','closed','in_review','escalated') THEN
    RAISE EXCEPTION 'invalid status filter' USING ERRCODE='22023';
  END IF;
  result := app_me(p_user_id,lim);
  SELECT jsonb_build_object(
    'total_filed',count(*),
    'open',count(*) FILTER (WHERE status NOT IN ('resolved','closed')),
    'resolved',count(*) FILTER (WHERE status='resolved'),
    'closed',count(*) FILTER (WHERE status='closed'),
    'in_review',count(*) FILTER (WHERE status='in_review'),
    'escalated',count(*) FILTER (WHERE status='escalated'),
    'sla_breached',count(*) FILTER (WHERE sla_breached AND status NOT IN ('resolved','closed')),
    'ticket_receipts',count(*) FILTER (WHERE ticket_extracted IS NOT NULL),
    'trips_saved',(result->'stats'->'trips_saved')::int
  ) INTO totals FROM complaints WHERE user_id=p_user_id;
  SELECT COALESCE(jsonb_agg(row_value ORDER BY created_at DESC),'[]'::jsonb) INTO recent FROM (
    SELECT c.created_at,jsonb_build_object(
      'reference_id',c.reference_id,'category',c.category,'status',c.status,'priority',c.priority,
      'depot',d.name,'district',d.district,'route_text',c.route_text,'bus_number',c.bus_number,
      'description',c.description,'location_text',c.location_text,
      'has_ticket',c.ticket_extracted IS NOT NULL,'sla_breached',c.sla_breached,
      'sla_due_at',c.sla_due_at,'created_at',c.created_at,'updated_at',c.updated_at,
      'latest_action',latest.note,'latest_action_at',latest.created_at
    ) AS row_value FROM complaints c LEFT JOIN depots d ON d.id=c.depot_id
    LEFT JOIN LATERAL (SELECT note,created_at FROM status_history WHERE complaint_id=c.id ORDER BY created_at DESC LIMIT 1) latest ON true
    WHERE c.user_id=p_user_id AND (p_status IS NULL OR (p_status='open' AND c.status NOT IN ('resolved','closed')) OR c.status=p_status)
    ORDER BY c.created_at DESC LIMIT lim OFFSET off
  ) rows;
  SELECT COALESCE(jsonb_agg(row_value ORDER BY created_at DESC),'[]'::jsonb) INTO activity FROM (
    SELECT h.created_at,jsonb_build_object('reference_id',c.reference_id,'from_status',h.from_status,
      'to_status',h.to_status,'note',h.note,'created_at',h.created_at) AS row_value
    FROM status_history h JOIN complaints c ON c.id=h.complaint_id WHERE c.user_id=p_user_id
    ORDER BY h.created_at DESC LIMIT 12
  ) rows;
  SELECT jsonb_agg(jsonb_build_object('month',to_char(month,'YYYY-MM'),
    'filed',(SELECT count(*) FROM complaints c WHERE c.user_id=p_user_id AND date_trunc('month',c.created_at AT TIME ZONE 'Asia/Kolkata')=month),
    'resolved',(SELECT count(DISTINCT h.complaint_id) FROM status_history h JOIN complaints c ON c.id=h.complaint_id
      WHERE c.user_id=p_user_id AND h.to_status='resolved' AND date_trunc('month',h.created_at AT TIME ZONE 'Asia/Kolkata')=month)) ORDER BY month
  ) INTO months FROM generate_series(date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')-interval '5 months',
    date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata'),interval '1 month') month;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('category',category,'count',n) ORDER BY n DESC),'[]'::jsonb)
    INTO categories FROM (SELECT category,count(*) n FROM complaints WHERE user_id=p_user_id GROUP BY category) rows;
  SELECT count(*) INTO filtered_count FROM complaints c WHERE c.user_id=p_user_id
    AND (p_status IS NULL OR (p_status='open' AND c.status NOT IN ('resolved','closed')) OR c.status=p_status);
  RETURN result || jsonb_build_object('stats',totals,'recent_complaints',recent,'activity',activity,
    'monthly_activity',months,'by_category',categories,'has_more',filtered_count>off+lim,'filtered_total',filtered_count,
    'offset',off,'limit',lim);
END $$;
REVOKE EXECUTE ON FUNCTION app_passenger_dashboard(uuid,int,int,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_passenger_dashboard(uuid,int,int,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
