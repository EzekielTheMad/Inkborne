-- Assertions only. No schema repair, grants, role changes or fixture writes.
DO $preflight$
DECLARE expected record; actual record; required record; mapping jsonb;
  reserved_ids uuid[]:=ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000007']::uuid[];
BEGIN
  IF CURRENT_USER<>'postgres' OR SESSION_USER<>'postgres' THEN RAISE EXCEPTION 'command_fixture_actor_mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls) THEN
    RAISE EXCEPTION 'command_fixture_native_postgres_role_drift';
  END IF;
  IF pg_catalog.to_regclass('private.character_writer_guard_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'command_fixture_requires_fresh_guard_absence';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role'))<>4 THEN
    RAISE EXCEPTION 'command_fixture_required_roles_missing';
  END IF;
  IF NOT pg_catalog.has_schema_privilege('postgres','auth','USAGE')
    OR NOT pg_catalog.has_schema_privilege('postgres','public','USAGE')
    OR NOT pg_catalog.has_schema_privilege('postgres','private','USAGE') THEN
    RAISE EXCEPTION 'command_fixture_schema_usage_unavailable';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('auth','users','id','uuid',true),('auth','users','aud','character varying(255)',false),
    ('auth','users','role','character varying(255)',false),('auth','users','is_anonymous','boolean',true),
    ('auth','users','deleted_at','timestamp with time zone',false),('auth','users','banned_until','timestamp with time zone',false),
    ('auth','users','raw_user_meta_data','jsonb',false),
    ('auth','sessions','id','uuid',true),('auth','sessions','user_id','uuid',true),('auth','sessions','not_after','timestamp with time zone',false),
    ('public','profiles','id','uuid',true),('public','profiles','display_name','text',true),
    ('public','characters','id','uuid',true),('public','characters','user_id','uuid',true),
    ('public','characters','system_id','uuid',true),('public','characters','campaign_id','uuid',false),('public','characters','name','text',true),
    ('public','game_systems','id','uuid',true),('public','game_systems','slug','text',true),('public','game_systems','name','text',true),
    ('public','game_systems','status','text',true),('public','game_systems','schema_definition','jsonb',true),('public','game_systems','expression_context','jsonb',true)
  ) AS shape(schema_name,table_name,column_name,type_name,not_null)
  LOOP
    SELECT pg_catalog.format_type(a.atttypid,a.atttypmod) AS type_name,a.attnotnull,c.relkind INTO actual
      FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname=expected.schema_name AND c.relname=expected.table_name
        AND a.attname=expected.column_name AND NOT a.attisdropped;
    IF NOT FOUND OR actual.relkind<>'r' OR actual.type_name IS DISTINCT FROM expected.type_name
      OR actual.attnotnull IS DISTINCT FROM expected.not_null THEN RAISE EXCEPTION 'command_fixture_selected_schema_drift'; END IF;
  END LOOP;
  FOR required IN SELECT * FROM (VALUES
    ('auth.users','id'),('auth.users','aud'),('auth.users','role'),('auth.users','is_anonymous'),('auth.users','deleted_at'),('auth.users','banned_until'),
    ('auth.sessions','id'),('auth.sessions','user_id'),('auth.sessions','not_after'),
    ('public.profiles','id'),('public.characters','id'),('public.characters','user_id')
  ) AS reads(relation_name,column_name)
  LOOP
    IF NOT pg_catalog.has_column_privilege('postgres',required.relation_name,required.column_name,'SELECT') THEN
      RAISE EXCEPTION 'command_fixture_row_lock_column_select_unavailable';
    END IF;
  END LOOP;
  FOR required IN SELECT * FROM (VALUES ('auth.users'),('auth.sessions'),('public.profiles'),('public.characters')) AS locked(relation_name)
  LOOP
    IF NOT pg_catalog.has_any_column_privilege('postgres',required.relation_name,'UPDATE')
      OR pg_catalog.row_security_active(required.relation_name::pg_catalog.regclass) THEN
      RAISE EXCEPTION 'command_fixture_row_lock_privilege_unavailable';
    END IF;
  END LOOP;
  FOR required IN SELECT * FROM (VALUES ('auth.users'),('auth.sessions'),('public.profiles'),('public.characters'),('public.game_systems')) AS names(relation_name)
  LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.conrelid=required.relation_name::pg_catalog.regclass
      AND k.contype='p' AND k.convalidated AND pg_catalog.cardinality(k.conkey)=1
      AND k.conkey[1]=(SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid=k.conrelid AND a.attname='id')) THEN
      RAISE EXCEPTION 'command_fixture_selected_primary_key_drift';
    END IF;
  END LOOP;
  FOR required IN SELECT * FROM (VALUES
    ('auth.sessions','user_id','auth.users','id','c'),('public.profiles','id','auth.users','id','c'),
    ('public.characters','user_id','public.profiles','id','c'),('public.characters','system_id','public.game_systems','id','a')
  ) AS links(source_relation,source_column,target_relation,target_column,delete_action)
  LOOP
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('source_attnum',k.conkey[1],'target_attnum',k.confkey[1])) INTO mapping
      FROM pg_catalog.pg_constraint k WHERE k.conrelid=required.source_relation::pg_catalog.regclass
      AND k.confrelid=required.target_relation::pg_catalog.regclass AND k.contype='f' AND k.convalidated
      AND k.confdeltype::text=required.delete_action AND pg_catalog.cardinality(k.conkey)=1 AND pg_catalog.cardinality(k.confkey)=1
      AND k.conkey[1]=(SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid=k.conrelid AND a.attname=required.source_column)
      AND k.confkey[1]=(SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid=k.confrelid AND a.attname=required.target_column);
    IF mapping IS NULL OR pg_catalog.jsonb_array_length(mapping)<>1 THEN RAISE EXCEPTION 'command_fixture_selected_foreign_key_drift'; END IF;
  END LOOP;
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE t.tgrelid='auth.users'::pg_catalog.regclass AND t.tgname='on_auth_user_created'
      AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgtype=5 AND n.nspname='public' AND p.proname='handle_new_user'
      AND p.pronargs=0 AND p.prorettype='trigger'::pg_catalog.regtype AND p.prosecdef)<>1 THEN
    RAISE EXCEPTION 'command_fixture_profile_trigger_drift';
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM auth.sessions WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM public.characters WHERE id=ANY(reserved_ids))
    OR EXISTS(SELECT 1 FROM public.game_systems WHERE id=ANY(reserved_ids) OR slug='inkborne-authrows-fixture') THEN
    RAISE EXCEPTION 'command_fixture_reserved_identity_collision';
  END IF;
END;
$preflight$;
SELECT pg_catalog.jsonb_build_object('phase','preflight','passed',true) AS result;
