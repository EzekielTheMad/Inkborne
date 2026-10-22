-- Exact synthetic fixture rows only, after all scenario transactions close.
-- Lock roots before checking inbound FK closure. Unknown references refuse;
-- explicit child deletes avoid crediting an uninspected cascade for cleanup.
BEGIN;
DO $cleanup$
DECLARE link record; parent_ids text[]; child_ids text[]; unexpected boolean;
  users_removed integer; sessions_removed integer; profiles_removed integer;
  characters_removed integer; systems_removed integer;
BEGIN
  IF CURRENT_USER<>'postgres' OR SESSION_USER<>'postgres' THEN RAISE EXCEPTION 'command_fixture_actor_mismatch'; END IF;
  PERFORM id FROM auth.users WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004') ORDER BY id FOR UPDATE;
  PERFORM id FROM auth.sessions WHERE id IN ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006') ORDER BY id FOR UPDATE;
  PERFORM id FROM public.profiles WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004') ORDER BY id FOR UPDATE;
  PERFORM id FROM public.game_systems WHERE id='10000000-0000-4000-8000-000000000005' FOR UPDATE;
  PERFORM id FROM public.characters WHERE id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007') ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM auth.users WHERE
      (id='10000000-0000-4000-8000-000000000001' AND raw_user_meta_data IS DISTINCT FROM '{"full_name":"Inkborne Auth row fixture actor"}'::jsonb)
      OR (id='10000000-0000-4000-8000-000000000004' AND raw_user_meta_data IS DISTINCT FROM '{"full_name":"Inkborne Auth row fixture other"}'::jsonb))
    OR EXISTS(SELECT 1 FROM public.profiles WHERE
      (id='10000000-0000-4000-8000-000000000001' AND display_name IS DISTINCT FROM 'Inkborne Auth row fixture actor')
      OR (id='10000000-0000-4000-8000-000000000004' AND display_name IS DISTINCT FROM 'Inkborne Auth row fixture other'))
    OR EXISTS(SELECT 1 FROM auth.sessions WHERE
      (id='10000000-0000-4000-8000-000000000002' AND user_id IS DISTINCT FROM '10000000-0000-4000-8000-000000000001'::uuid)
      OR (id='10000000-0000-4000-8000-000000000006' AND user_id IS DISTINCT FROM '10000000-0000-4000-8000-000000000004'::uuid))
    OR EXISTS(SELECT 1 FROM public.characters WHERE
      (id='10000000-0000-4000-8000-000000000003' AND (user_id IS DISTINCT FROM '10000000-0000-4000-8000-000000000001'::uuid OR name IS DISTINCT FROM 'Inkborne Auth row fixture target'))
      OR (id='10000000-0000-4000-8000-000000000007' AND (user_id IS DISTINCT FROM '10000000-0000-4000-8000-000000000004'::uuid OR name IS DISTINCT FROM 'Inkborne Auth row fixture other target')))
    OR EXISTS(SELECT 1 FROM public.characters WHERE id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007')
      AND (system_id IS DISTINCT FROM '10000000-0000-4000-8000-000000000005'::uuid OR campaign_id IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.game_systems WHERE id='10000000-0000-4000-8000-000000000005'
      AND (slug IS DISTINCT FROM 'inkborne-authrows-fixture' OR name IS DISTINCT FROM 'Inkborne Auth row fixture'
        OR status IS DISTINCT FROM 'draft' OR schema_definition IS DISTINCT FROM '{}'::jsonb OR expression_context IS DISTINCT FROM '{}'::jsonb)) THEN
    RAISE EXCEPTION 'command_fixture_cleanup_root_identity_drift';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_constraint WHERE contype='f'
    AND confrelid=ANY(ARRAY['auth.users'::pg_catalog.regclass,'auth.sessions'::pg_catalog.regclass,
      'public.profiles'::pg_catalog.regclass,'public.characters'::pg_catalog.regclass,'public.game_systems'::pg_catalog.regclass]))>256 THEN
    RAISE EXCEPTION 'command_fixture_cleanup_reference_budget';
  END IF;
  FOR link IN
    SELECT k.confrelid,k.conrelid,k.conkey,k.confkey,k.convalidated,n.nspname,c.relname,a.attname,
      target.attname AS target_column
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1]
    LEFT JOIN pg_catalog.pg_attribute target ON target.attrelid=k.confrelid AND target.attnum=k.confkey[1]
    WHERE k.contype='f' AND k.confrelid=ANY(ARRAY['auth.users'::pg_catalog.regclass,'auth.sessions'::pg_catalog.regclass,
      'public.profiles'::pg_catalog.regclass,'public.characters'::pg_catalog.regclass,'public.game_systems'::pg_catalog.regclass])
    ORDER BY k.confrelid,k.conrelid,k.oid
  LOOP
    IF NOT link.convalidated OR pg_catalog.cardinality(link.conkey)<>1 OR pg_catalog.cardinality(link.confkey)<>1
      OR link.target_column IS DISTINCT FROM 'id' OR link.attname IS NULL THEN
      RAISE EXCEPTION 'command_fixture_cleanup_unsupported_reference';
    END IF;
    parent_ids := CASE link.confrelid
      WHEN 'auth.users'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004']
      WHEN 'public.profiles'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004']
      WHEN 'auth.sessions'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006']
      WHEN 'public.characters'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007']
      WHEN 'public.game_systems'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000005'] END;
    child_ids := CASE link.conrelid
      WHEN 'auth.users'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004']
      WHEN 'public.profiles'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004']
      WHEN 'auth.sessions'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006']
      WHEN 'public.characters'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007']
      WHEN 'public.game_systems'::pg_catalog.regclass THEN ARRAY['10000000-0000-4000-8000-000000000005'] ELSE NULL END;
    IF child_ids IS NULL THEN
      EXECUTE pg_catalog.format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text=ANY($1))',link.nspname,link.relname,link.attname)
        INTO unexpected USING parent_ids;
    ELSE
      EXECUTE pg_catalog.format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text=ANY($1) AND NOT id::text=ANY($2))',link.nspname,link.relname,link.attname)
        INTO unexpected USING parent_ids,child_ids;
    END IF;
    IF unexpected THEN RAISE EXCEPTION 'command_fixture_cleanup_foreign_reference'; END IF;
  END LOOP;
  DELETE FROM public.characters WHERE id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007');
  GET DIAGNOSTICS characters_removed=ROW_COUNT;
  DELETE FROM auth.sessions WHERE id IN ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006');
  GET DIAGNOSTICS sessions_removed=ROW_COUNT;
  DELETE FROM public.profiles WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004');
  GET DIAGNOSTICS profiles_removed=ROW_COUNT;
  DELETE FROM auth.users WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004');
  GET DIAGNOSTICS users_removed=ROW_COUNT;
  DELETE FROM public.game_systems WHERE id='10000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS systems_removed=ROW_COUNT;
  IF characters_removed>2 OR sessions_removed>2 OR profiles_removed>2 OR users_removed>2 OR systems_removed>1
    OR EXISTS(SELECT 1 FROM public.characters WHERE id IN ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000007'))
    OR EXISTS(SELECT 1 FROM auth.sessions WHERE id IN ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006'))
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004'))
    OR EXISTS(SELECT 1 FROM auth.users WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004'))
    OR EXISTS(SELECT 1 FROM public.game_systems WHERE id='10000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'command_fixture_cleanup_residue';
  END IF;
END;
$cleanup$;
COMMIT;
SELECT pg_catalog.jsonb_build_object('phase','fixture_cleanup','passed',true,'exact_fixture_rows_absent',true) AS result;
