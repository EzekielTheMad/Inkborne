-- STAGED ONLY: selected Auth user/session/profile rows for future fresh creation.
-- The same-token server-verified context remains a caller precondition. This
-- primitive does not verify a JWT, configured session lifetime or save authority.
-- It returns only the validated input deadline and retains its SHARE locks until
-- transaction end. No character/guard/journal/readiness/Auth seam is changed.
-- Auth2.196.0 source: 0204331ca41a5b49f076b6fa3dc6c0d20b996590.

BEGIN;

DO $prerequisites$
DECLARE dependency record; actual record; selected record;
BEGIN
  IF CURRENT_USER <> 'postgres' OR SESSION_USER <> 'postgres'
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles
      WHERE rolname IN ('postgres','anon','authenticated','service_role')) <> 4 THEN
    RAISE EXCEPTION 'character_command_actor_rows_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
  -- Bind the unchanged accepted v1 clock and target wrapper. Canonical body
  -- hashes are from that source, independently matched by its native catalog.
  FOR dependency IN SELECT * FROM (VALUES
    ('private.check_character_command_clock_v1(timestamp with time zone)',
      'timestamp with time zone','055cc671ff088cbea202eaa44dd4b497'),
    ('private.lock_character_command_rows_v1(jsonb,uuid)',
      'void','36776958bd26ed3886c3526458051cec')
  ) AS wanted(signature,result_type,body_md5)
  LOOP
    SELECT p.*,pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
      pg_catalog.format_type(p.prorettype,NULL) AS result_type,
      l.lanname AS language_name INTO actual
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
      WHERE p.oid=pg_catalog.to_regprocedure(dependency.signature);
    IF NOT FOUND OR actual.owner_name IS DISTINCT FROM 'postgres'
      OR actual.result_type IS DISTINCT FROM dependency.result_type
      OR actual.language_name IS DISTINCT FROM 'plpgsql' OR actual.prokind <> 'f'
      OR actual.prosecdef OR actual.proretset OR actual.provolatile <> 'v'
      OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n')) IS DISTINCT FROM dependency.body_md5
      OR pg_catalog.has_function_privilege('anon',actual.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',actual.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',actual.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'character_command_actor_rows_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF NOT pg_catalog.has_schema_privilege('postgres','auth','USAGE')
    OR NOT pg_catalog.has_schema_privilege('postgres','public','USAGE')
    OR NOT pg_catalog.has_schema_privilege('postgres','private','USAGE') THEN
    RAISE EXCEPTION 'character_command_actor_rows_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
  FOR selected IN SELECT * FROM (VALUES
    ('auth.users','id','uuid',true),('auth.users','aud','character varying(255)',false),
    ('auth.users','role','character varying(255)',false),('auth.users','is_anonymous','boolean',true),
    ('auth.users','deleted_at','timestamp with time zone',false),
    ('auth.users','banned_until','timestamp with time zone',false),
    ('auth.sessions','id','uuid',true),('auth.sessions','user_id','uuid',true),
    ('auth.sessions','not_after','timestamp with time zone',false),('public.profiles','id','uuid',true)
  ) AS shape(relation_name,column_name,type_name,not_null)
  LOOP
    SELECT pg_catalog.format_type(a.atttypid,a.atttypmod) AS type_name,a.attnotnull,c.relkind
      INTO actual FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
      WHERE a.attrelid=pg_catalog.to_regclass(selected.relation_name)
        AND a.attname=selected.column_name AND NOT a.attisdropped;
    IF NOT FOUND OR actual.relkind <> 'r' OR actual.type_name IS DISTINCT FROM selected.type_name
      OR actual.attnotnull IS DISTINCT FROM selected.not_null
      OR NOT pg_catalog.has_column_privilege('postgres',selected.relation_name,selected.column_name,'SELECT') THEN
      RAISE EXCEPTION 'character_command_actor_rows_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOR selected IN SELECT * FROM (VALUES ('auth.users'),('auth.sessions'),('public.profiles')) AS locked(relation_name)
  LOOP
    IF NOT pg_catalog.has_any_column_privilege('postgres',selected.relation_name,'UPDATE')
      OR pg_catalog.row_security_active(selected.relation_name::pg_catalog.regclass) THEN
      RAISE EXCEPTION 'character_command_actor_rows_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
END;
$prerequisites$;

CREATE FUNCTION private.lock_character_command_actor_rows_v1(p_context jsonb)
RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid; session_key uuid; expires timestamptz; current_instant timestamptz;
  user_key uuid; user_audience text; user_role text; user_anonymous boolean;
  user_deleted timestamptz; user_banned_until timestamptz;
  selected_session uuid; session_actor uuid; session_not_after timestamptz; profile_key uuid;
BEGIN
  IF p_context IS NULL OR pg_catalog.jsonb_typeof(p_context) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
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
    OR COALESCE(p_context->>'jwt_expires_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.000000Z$' THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END IF;
  BEGIN
    actor := (p_context->>'actor_id')::uuid;
    session_key := (p_context->>'session_id')::uuid;
    expires := (p_context->>'jwt_expires_at')::timestamptz;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END;
  current_instant := private.check_character_command_clock_v1(expires);
  IF pg_catalog.to_char(expires AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    IS DISTINCT FROM p_context->>'jwt_expires_at' THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END IF;

  SELECT source.id,source.aud,source.role,source.is_anonymous,source.deleted_at,source.banned_until
    INTO user_key,user_audience,user_role,user_anonymous,user_deleted,user_banned_until
    FROM auth.users AS source WHERE source.id=actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF user_key IS DISTINCT FROM actor OR user_audience IS DISTINCT FROM 'authenticated'
    OR user_role IS DISTINCT FROM 'authenticated' OR user_anonymous IS DISTINCT FROM false
    OR user_deleted IS NOT NULL
    OR (user_banned_until IS NOT NULL AND (NOT pg_catalog.isfinite(user_banned_until)
      OR user_banned_until < '0001-01-01T00:00:00Z'::timestamptz
      OR user_banned_until >= '10000-01-01T00:00:00Z'::timestamptz
      OR user_banned_until > current_instant)) THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END IF;

  SELECT source.id,source.user_id,source.not_after INTO selected_session,session_actor,session_not_after
    FROM auth.sessions AS source WHERE source.id=session_key AND source.user_id=actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF selected_session IS DISTINCT FROM session_key OR session_actor IS DISTINCT FROM actor
    OR (session_not_after IS NOT NULL AND (NOT pg_catalog.isfinite(session_not_after)
      OR session_not_after < '0001-01-01T00:00:00Z'::timestamptz
      OR session_not_after >= '10000-01-01T00:00:00Z'::timestamptz
      OR session_not_after <= current_instant)) THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END IF;

  SELECT source.id INTO profile_key FROM public.profiles AS source WHERE source.id=actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF profile_key IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END IF;

  -- Reread selected status under the same retained locks. The scalar result is
  -- the validated input deadline, never a token-verification or permission flag.
  SELECT source.id,source.aud,source.role,source.is_anonymous,source.deleted_at,source.banned_until
    INTO user_key,user_audience,user_role,user_anonymous,user_deleted,user_banned_until
    FROM auth.users AS source WHERE source.id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001'; END IF;
  SELECT source.id,source.user_id,source.not_after INTO selected_session,session_actor,session_not_after
    FROM auth.sessions AS source WHERE source.id=session_key AND source.user_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001'; END IF;
  SELECT source.id INTO profile_key FROM public.profiles AS source WHERE source.id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001'; END IF;
  current_instant := private.check_character_command_clock_v1(expires);
  IF user_key IS DISTINCT FROM actor OR user_audience IS DISTINCT FROM 'authenticated'
    OR user_role IS DISTINCT FROM 'authenticated' OR user_anonymous IS DISTINCT FROM false
    OR user_deleted IS NOT NULL OR profile_key IS DISTINCT FROM actor
    OR (user_banned_until IS NOT NULL AND (NOT pg_catalog.isfinite(user_banned_until)
      OR user_banned_until < '0001-01-01T00:00:00Z'::timestamptz
      OR user_banned_until >= '10000-01-01T00:00:00Z'::timestamptz
      OR user_banned_until > current_instant))
    OR selected_session IS DISTINCT FROM session_key OR session_actor IS DISTINCT FROM actor
    OR (session_not_after IS NOT NULL AND (NOT pg_catalog.isfinite(session_not_after)
      OR session_not_after < '0001-01-01T00:00:00Z'::timestamptz
      OR session_not_after >= '10000-01-01T00:00:00Z'::timestamptz
      OR session_not_after <= current_instant)) THEN
    RAISE EXCEPTION 'character_command_rows_unavailable' USING ERRCODE='P0001';
  END IF;
  RETURN expires;
END;
$$;

ALTER FUNCTION private.lock_character_command_actor_rows_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.lock_character_command_actor_rows_v1(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
DO $closed_acl$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,
    LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) privilege
    WHERE p.oid='private.lock_character_command_actor_rows_v1(jsonb)'::pg_catalog.regprocedure
      AND privilege.privilege_type='EXECUTE' AND privilege.grantee<>p.proowner) THEN
    RAISE EXCEPTION 'character_command_actor_rows_unexpected_default_acl' USING ERRCODE='42501';
  END IF;
END;
$closed_acl$;

COMMIT;
