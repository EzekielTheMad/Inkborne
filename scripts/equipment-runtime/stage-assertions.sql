-- Check staged entrypoints, effective grants, protections and real helper presence.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
DO $check$
DECLARE function_name text; api_role text;
BEGIN
  IF pg_catalog.to_regclass('public.character_starting_grants') IS NULL THEN RAISE EXCEPTION 'R07.1 stage table absent'; END IF;
  FOREACH function_name IN ARRAY ARRAY[
    'public.create_character_with_starting_grant(uuid,text,uuid)',
    'public.resolve_starting_equipment(uuid,uuid,jsonb)',
    'public.commit_starting_equipment(uuid,uuid,jsonb,jsonb,jsonb)'
  ] LOOP
    IF pg_catalog.to_regprocedure(function_name) IS NULL OR NOT pg_catalog.has_function_privilege('service_role',function_name,'EXECUTE') THEN
      RAISE EXCEPTION 'R07.1 trusted entrypoint absent/inaccessible';
    END IF;
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF pg_catalog.has_function_privilege(api_role,function_name,'EXECUTE') THEN RAISE EXCEPTION 'R07.1 forbidden entrypoint executable'; END IF;
    END LOOP;
  END LOOP;
  IF NOT pg_catalog.has_table_privilege('authenticated','public.character_starting_grants','SELECT')
     OR pg_catalog.has_table_privilege('authenticated','public.character_starting_grants','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.character_starting_grants','UPDATE')
     OR pg_catalog.has_table_privilege('anon','public.character_starting_grants','SELECT')
     OR NOT EXISTS (SELECT FROM pg_catalog.pg_class WHERE oid = 'public.character_starting_grants'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT FROM pg_catalog.pg_policy WHERE polrelid = 'public.character_starting_grants'::regclass) THEN
    RAISE EXCEPTION 'R07.1 stage table grants/RLS mismatch';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.character_starting_grants'::regclass AND tgname = 'preserve_starting_grant_receipt' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.character_content_refs'::regclass AND tgname = 'aaa_lock_starting_equipment_refs' AND tgenabled = 'O')
     OR NOT EXISTS (SELECT FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.character_inventory'::regclass AND tgname = 'protect_starting_inventory_provenance' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'R07.1 stage protections absent/disabled';
  END IF;
END
$check$;
COMMIT;
