-- Staged creation-only server transport. Not a migration or positive save gate.
-- A service credential holder is trusted to supply the server-verifier context;
-- PostgreSQL does not verify its JWT or prove the server verifier was invoked.
-- Existing production Auth, NEW admission and order-input denials stay intact.
-- Install only after the exact actor-prefix and class-bootstrap sources below.
-- Installation requires a directly authenticated SUPER installer named
-- supabase_admin (native) or postgres (offline fixture). Runtime row-lock shim
-- ownership remains postgres; NONSUPER runtime proof is separate. No automatic
-- membership/grant repair is supplied. Offline SUPER does not prove native RLS.
BEGIN;

DO $dependencies$
DECLARE wanted record; actual record;
BEGIN
  IF CURRENT_USER IS DISTINCT FROM SESSION_USER OR CURRENT_USER NOT IN ('supabase_admin','postgres')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER AND rolsuper)
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','inkborne_class_origin_owner')) <> 5
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'character_creation_bridge_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
  FOR wanted IN SELECT * FROM (VALUES
    ('private.lock_character_command_actor_rows_v1(jsonb)','postgres',false,
      'timestamp with time zone','20723debd6bff48414c085efd2b984af'),
    ('private.create_empty_class_origin_character_v1(jsonb,jsonb)','inkborne_class_origin_owner',true,
      'jsonb','733d2f9a825df33ae9b5cdd277b23d7f'),
    ('private.resolve_empty_class_origin_creation_v1(jsonb,uuid)','inkborne_class_origin_owner',true,
      'jsonb','67e836eabcc4097024c452f27824bf8e')
  ) AS dependencies(signature,owner_name,is_definer,result_type,body_md5)
  LOOP
    SELECT p.*,pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
      pg_catalog.format_type(p.prorettype,NULL) AS result_type,l.lanname INTO actual
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
      WHERE p.oid=pg_catalog.to_regprocedure(wanted.signature);
    IF NOT FOUND OR actual.owner_name IS DISTINCT FROM wanted.owner_name
      OR actual.prosecdef IS DISTINCT FROM wanted.is_definer OR actual.provolatile <> 'v'
      OR actual.prokind <> 'f' OR actual.proretset OR actual.lanname <> 'plpgsql'
      OR actual.result_type IS DISTINCT FROM wanted.result_type
      OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n')) IS DISTINCT FROM wanted.body_md5
      OR pg_catalog.has_function_privilege('anon',actual.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',actual.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',actual.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'character_creation_bridge_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
END;
$dependencies$;

CREATE ROLE inkborne_character_command_gateway_owner NOLOGIN NOSUPERUSER NOBYPASSRLS
  NOINHERIT NOCREATEROLE NOCREATEDB NOREPLICATION;
GRANT USAGE ON SCHEMA public,private TO inkborne_character_command_gateway_owner;

-- Privileged row locks are isolated from the API role and from the gateway's
-- own execution identity. This shim grants no Auth table access to either.
CREATE FUNCTION private.lock_character_command_actor_rows_gateway_v1(p_context jsonb)
RETURNS timestamptz LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RETURN private.lock_character_command_actor_rows_v1(p_context);
END $$;
ALTER FUNCTION private.lock_character_command_actor_rows_gateway_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.lock_character_command_actor_rows_gateway_v1(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.lock_character_command_actor_rows_gateway_v1(jsonb),
  private.create_empty_class_origin_character_v1(jsonb,jsonb),
  private.resolve_empty_class_origin_creation_v1(jsonb,uuid)
  TO inkborne_character_command_gateway_owner;

-- service_role is the trusted server transport only. Never grant this endpoint
-- to authenticated/anon or accept a browser-provided actor/session/deadline.
CREATE FUNCTION public.character_creation_command_v1(p_context jsonb,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE operation uuid; result jsonb; deadline timestamptz;
BEGIN
  -- Validate a finite envelope before acquiring any locks. The prefix below
  -- independently validates all four context keys and their native times.
  IF pg_catalog.jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR pg_catalog.octet_length(p_request::text)>32768 THEN
    RETURN '{"status":"invalid"}'::jsonb;
  END IF;
  IF p_request->>'command'='create_character' THEN
    IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_request))<>4
      OR NOT p_request ?& ARRAY['contract_version','operation_id','command','fields']
      OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb
      OR pg_catalog.jsonb_typeof(p_request->'fields') IS DISTINCT FROM 'object' THEN
      RETURN '{"status":"invalid"}'::jsonb;
    END IF;
    IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_request->'fields'))<>3
      OR NOT (p_request->'fields') ?& ARRAY['name','system_id','campaign_id']
      OR pg_catalog.jsonb_typeof(p_request#>'{fields,name}') IS DISTINCT FROM 'string'
      OR pg_catalog.length(p_request#>>'{fields,name}') NOT BETWEEN 1 AND 100
      OR p_request#>>'{fields,name}' IS DISTINCT FROM pg_catalog.btrim(p_request#>>'{fields,name}')
      OR p_request#>'{fields,campaign_id}' IS DISTINCT FROM 'null'::jsonb
      OR pg_catalog.jsonb_typeof(p_request#>'{fields,system_id}') IS DISTINCT FROM 'string'
      OR p_request#>>'{fields,system_id}' !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' THEN
      RETURN '{"status":"invalid"}'::jsonb;
    END IF;
  ELSIF p_request->>'command'='resolve_creation' THEN
    IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_request))<>3
      OR NOT p_request ?& ARRAY['contract_version','operation_id','command']
      OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb THEN
      RETURN '{"status":"invalid"}'::jsonb;
    END IF;
  ELSE RETURN '{"status":"invalid"}'::jsonb;
  END IF;
  IF pg_catalog.jsonb_typeof(p_request->'operation_id') IS DISTINCT FROM 'string'
    OR p_request->>'operation_id' !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' THEN
    RETURN '{"status":"invalid"}'::jsonb;
  END IF;
  operation:=(p_request->>'operation_id')::uuid;
  deadline:=private.lock_character_command_actor_rows_gateway_v1(p_context);
  -- No caller flag/GUC, role marker or lock token is treated as authentication.
  -- The original callees independently retain their unconditional Auth denials.
  IF p_request->>'command'='create_character' THEN
    result:=private.create_empty_class_origin_character_v1(p_context,p_request);
  ELSE
    result:=private.resolve_empty_class_origin_creation_v1(p_context,operation);
  END IF;
  -- Do not return while a checked actor/session/profile has become unavailable.
  -- This repeats the full prefix, including expiry, under the retained locks.
  deadline:=private.lock_character_command_actor_rows_gateway_v1(p_context);
  IF result IS NULL OR pg_catalog.octet_length(result::text)>65536
    OR pg_catalog.jsonb_typeof(result) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'character_creation_bridge_result_unavailable' USING ERRCODE='P0001';
  END IF;
  RETURN result;
END $$;
ALTER FUNCTION public.character_creation_command_v1(jsonb,jsonb) OWNER TO inkborne_character_command_gateway_owner;
-- Native supabase_admin has a public-schema default EXECUTE grant to postgres.
-- Close this NEW function's ACL after ownership transfer; never alter the
-- installer's defaults or unrelated legacy objects to make installation pass.
REVOKE ALL ON FUNCTION public.character_creation_command_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,postgres;
GRANT EXECUTE ON FUNCTION public.character_creation_command_v1(jsonb,jsonb) TO service_role;

-- Refuse permissive inherited defaults rather than silently reconciling them.
DO $closure$
DECLARE gateway oid; item record;
BEGIN
  SELECT oid INTO gateway FROM pg_catalog.pg_roles WHERE rolname='inkborne_character_command_gateway_owner'
    AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication);
  IF gateway IS NULL OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=gateway OR member=gateway)
    OR pg_catalog.has_schema_privilege(gateway,'public','CREATE')
    OR pg_catalog.has_schema_privilege(gateway,'private','CREATE')
    OR pg_catalog.has_schema_privilege(gateway,'auth','USAGE')
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'character_creation_bridge_capability_unavailable:role_or_schema' USING ERRCODE='42501';
  END IF;
  FOR item IN SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('auth','public','private') AND c.relkind IN ('r','p','v','m','f')
  LOOP
    IF pg_catalog.has_any_column_privilege(gateway,item.oid,'SELECT,INSERT,UPDATE,REFERENCES')
      OR pg_catalog.has_table_privilege(gateway,item.oid,'DELETE,TRUNCATE,TRIGGER') THEN
      RAISE EXCEPTION 'character_creation_bridge_capability_unavailable:relation:%',item.oid::regclass USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOR item IN SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='private'
  LOOP
    IF pg_catalog.has_function_privilege(gateway,item.oid,'EXECUTE') IS DISTINCT FROM (item.oid IN
      ('private.lock_character_command_actor_rows_gateway_v1(jsonb)'::regprocedure,
       'private.create_empty_class_origin_character_v1(jsonb,jsonb)'::regprocedure,
       'private.resolve_empty_class_origin_creation_v1(jsonb,uuid)'::regprocedure)) THEN
      RAISE EXCEPTION 'character_creation_bridge_capability_unavailable:function:%',item.oid::regprocedure USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOR item IN SELECT p.oid,pg_catalog.pg_get_userbyid(a.grantee) AS grantee,a.is_grantable
    FROM pg_catalog.pg_proc p,
      LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    WHERE p.oid IN ('private.lock_character_command_actor_rows_gateway_v1(jsonb)'::regprocedure,
      'public.character_creation_command_v1(jsonb,jsonb)'::regprocedure)
      AND a.privilege_type='EXECUTE' AND a.grantee<>p.proowner
      AND a.grantee<>CASE WHEN p.pronamespace='private'::regnamespace THEN gateway
        ELSE (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='service_role') END
  LOOP
    RAISE EXCEPTION 'character_creation_bridge_capability_unavailable:explicit_acl:%:%:%',
      item.oid::regprocedure,item.grantee,item.is_grantable USING ERRCODE='42501';
  END LOOP;
END;
$closure$;
COMMIT;
