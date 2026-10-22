-- Disposable synthetic rows only. Commit once so independent sessions see them.
-- Profiles MUST be created by the original on_auth_user_created app trigger.
BEGIN;
DO $seed$
DECLARE reserved_ids uuid[]:=ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000007']::uuid[];
BEGIN
  IF CURRENT_USER<>'postgres' OR SESSION_USER<>'postgres' THEN RAISE EXCEPTION 'command_fixture_actor_mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.character_writer_guard_v1 WHERE singleton AND marker=1)
    OR (SELECT pg_catalog.count(*) FROM private.character_writer_guard_v1)<>1 THEN
    RAISE EXCEPTION 'command_fixture_guard_shape_mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM public.characters WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM public.game_systems WHERE id=ANY(reserved_ids) OR slug='inkborne-authrows-fixture') THEN
    RAISE EXCEPTION 'command_fixture_reserved_identity_collision';
  END IF;
  INSERT INTO public.game_systems(id,slug,name,status,schema_definition,expression_context)
    VALUES('10000000-0000-4000-8000-000000000005','inkborne-authrows-fixture','Inkborne Auth row fixture','draft','{}','{}');
  INSERT INTO auth.users(id,aud,role,is_anonymous,deleted_at,banned_until,raw_user_meta_data) VALUES
    ('10000000-0000-4000-8000-000000000001','authenticated','authenticated',false,NULL,NULL,'{"full_name":"Inkborne Auth row fixture actor"}'),
    ('10000000-0000-4000-8000-000000000004','authenticated','authenticated',false,NULL,NULL,'{"full_name":"Inkborne Auth row fixture other"}');
  IF (SELECT pg_catalog.count(*) FROM public.profiles WHERE
      (id='10000000-0000-4000-8000-000000000001' AND display_name='Inkborne Auth row fixture actor')
      OR (id='10000000-0000-4000-8000-000000000004' AND display_name='Inkborne Auth row fixture other'))<>2 THEN
    RAISE EXCEPTION 'command_fixture_original_profile_trigger_failed';
  END IF;
  INSERT INTO auth.sessions(id,user_id,not_after) VALUES
    ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',NULL),
    ('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004',NULL);
  INSERT INTO public.characters(id,user_id,system_id,name) VALUES
    ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','Inkborne Auth row fixture target'),
    ('10000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','Inkborne Auth row fixture other target');
END;
$seed$;
COMMIT;
SELECT pg_catalog.jsonb_build_object('phase','seed','passed',true,'synthetic',true,
  'created_counts',pg_catalog.jsonb_build_object('users',2,'profiles_from_original_trigger',2,'sessions',2,'characters',2,'game_systems',1)) AS result;
