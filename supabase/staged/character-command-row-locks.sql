-- STAGED ONLY: selected-row correspondence after future same-token server
-- verification. A supplied context is not authenticated by this primitive.
-- Auth columns were checked against GoTrue v2.196.0 source commit
-- 0204331ca41a5b49f076b6fa3dc6c0d20b996590; effective native permissions and
-- provider/RI lock order still need separate acceptance. No caller is wired.
-- This does not establish configured timebox/inactivity/low-AAL/single-session
-- validity, enable a writer, or replace existing Auth/readiness denials.

BEGIN;

CREATE FUNCTION private.check_character_command_clock_v1(p_expires timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE current_instant timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF p_expires IS NULL OR NOT pg_catalog.isfinite(p_expires)
    OR p_expires < '0001-01-01T00:00:00Z'::timestamptz
    OR p_expires >= '10000-01-01T00:00:00Z'::timestamptz
    OR NOT pg_catalog.isfinite(current_instant)
    OR current_instant < '0001-01-01T00:00:00Z'::timestamptz
    OR current_instant >= '10000-01-01T00:00:00Z'::timestamptz
    OR current_instant >= p_expires
  THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  RETURN current_instant;
END;
$$;

CREATE FUNCTION private.lock_character_command_rows_v1(p_context jsonb, p_character_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid; session_key uuid; expires timestamptz; current_instant timestamptz;
  user_key uuid; user_audience text; user_role text; user_anonymous boolean;
  user_deleted timestamptz; user_banned_until timestamptz;
  selected_session uuid; session_actor uuid; session_not_after timestamptz;
  profile_key uuid; guard_key boolean; character_key uuid; character_owner uuid;
BEGIN
  IF p_context IS NULL OR pg_catalog.jsonb_typeof(p_context) IS DISTINCT FROM 'object'
    OR p_character_id IS NULL
    OR p_character_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.octet_length(p_context::text) > 2048
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_context)) <> 4
    OR NOT p_context ?& ARRAY['context_version','actor_id','session_id','jwt_expires_at']
    OR p_context->'context_version' IS DISTINCT FROM '1'::jsonb
    OR pg_catalog.jsonb_typeof(p_context->'actor_id') IS DISTINCT FROM 'string'
    OR pg_catalog.jsonb_typeof(p_context->'session_id') IS DISTINCT FROM 'string'
    OR COALESCE(p_context->>'actor_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_context->>'session_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR pg_catalog.jsonb_typeof(p_context->'jwt_expires_at') IS DISTINCT FROM 'string'
    OR COALESCE(p_context->>'jwt_expires_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.000000Z$'
  THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  -- Catch only input conversion failures. Permissions, missing schema/columns,
  -- deadlocks and transaction/concurrency errors retain their real SQLSTATE.
  BEGIN
    actor := (p_context->>'actor_id')::uuid;
    session_key := (p_context->>'session_id')::uuid;
    expires := (p_context->>'jwt_expires_at')::timestamptz;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001';
  END;
  current_instant := private.check_character_command_clock_v1(expires);
  IF pg_catalog.to_char(expires AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    IS DISTINCT FROM p_context->>'jwt_expires_at' THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001';
  END IF;

  -- Lock order is Auth user -> exact owned Auth session -> actor profile ->
  -- mechanical singleton -> exact owned character. Every wait rechecks expiry.
  SELECT source.id,source.aud,source.role,source.is_anonymous,source.deleted_at,source.banned_until
    INTO user_key,user_audience,user_role,user_anonymous,user_deleted,user_banned_until
    FROM auth.users AS source WHERE source.id = actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF user_key IS DISTINCT FROM actor OR user_audience IS DISTINCT FROM 'authenticated'
    OR user_role IS DISTINCT FROM 'authenticated' OR user_anonymous IS DISTINCT FROM false
    OR user_deleted IS NOT NULL
    OR (user_banned_until IS NOT NULL AND (NOT pg_catalog.isfinite(user_banned_until)
      OR user_banned_until < '0001-01-01T00:00:00Z'::timestamptz
      OR user_banned_until >= '10000-01-01T00:00:00Z'::timestamptz
      OR user_banned_until > current_instant))
  THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;

  SELECT source.id,source.user_id,source.not_after INTO selected_session,session_actor,session_not_after
    FROM auth.sessions AS source WHERE source.id = session_key AND source.user_id = actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF selected_session IS DISTINCT FROM session_key OR session_actor IS DISTINCT FROM actor
    OR (session_not_after IS NOT NULL AND (NOT pg_catalog.isfinite(session_not_after)
      OR session_not_after < '0001-01-01T00:00:00Z'::timestamptz
      OR session_not_after >= '10000-01-01T00:00:00Z'::timestamptz
      OR session_not_after <= current_instant))
  THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;

  SELECT source.id INTO profile_key FROM public.profiles AS source WHERE source.id = actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF profile_key IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT source.singleton INTO guard_key FROM private.character_writer_guard_v1 AS source
    WHERE source.singleton = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF guard_key IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT source.id,source.user_id INTO character_key,character_owner FROM public.characters AS source
    WHERE source.id = p_character_id AND source.user_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF character_key IS DISTINCT FROM p_character_id OR character_owner IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001';
  END IF;

  -- Selected status/ownership are reread under the locks already held. No Auth
  -- whole-row values, user metadata, session secrets or row payload are exposed.
  SELECT source.id,source.aud,source.role,source.is_anonymous,source.deleted_at,source.banned_until
    INTO user_key,user_audience,user_role,user_anonymous,user_deleted,user_banned_until
    FROM auth.users AS source WHERE source.id = actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  SELECT source.id,source.user_id,source.not_after INTO selected_session,session_actor,session_not_after
    FROM auth.sessions AS source WHERE source.id = session_key AND source.user_id = actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  SELECT source.id,source.user_id INTO character_key,character_owner FROM public.characters AS source
    WHERE source.id = p_character_id AND source.user_id = actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF user_key IS DISTINCT FROM actor OR user_audience IS DISTINCT FROM 'authenticated'
    OR user_role IS DISTINCT FROM 'authenticated' OR user_anonymous IS DISTINCT FROM false
    OR user_deleted IS NOT NULL
    OR (user_banned_until IS NOT NULL AND (NOT pg_catalog.isfinite(user_banned_until)
      OR user_banned_until < '0001-01-01T00:00:00Z'::timestamptz
      OR user_banned_until >= '10000-01-01T00:00:00Z'::timestamptz
      OR user_banned_until > current_instant))
    OR selected_session IS DISTINCT FROM session_key OR session_actor IS DISTINCT FROM actor
    OR (session_not_after IS NOT NULL AND (NOT pg_catalog.isfinite(session_not_after)
      OR session_not_after < '0001-01-01T00:00:00Z'::timestamptz
      OR session_not_after >= '10000-01-01T00:00:00Z'::timestamptz
      OR session_not_after <= current_instant))
    OR character_key IS DISTINCT FROM p_character_id OR character_owner IS DISTINCT FROM actor
  THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE = 'P0001'; END IF;
END;
$$;

ALTER FUNCTION private.check_character_command_clock_v1(timestamptz) OWNER TO postgres;
ALTER FUNCTION private.lock_character_command_rows_v1(jsonb,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.check_character_command_clock_v1(timestamptz),
  private.lock_character_command_rows_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
