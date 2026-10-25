-- STAGED ONLY: finite owned Infernal Legacy tiers, after Draconic HP, parent
-- admission and ancestry HP. No API, writer seal, graph schema, gate or mutation authority is expanded.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb)') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.builder_earned_racial_source_v1(uuid,jsonb,jsonb,uuid)') IS NOT NULL
    OR pg_catalog.to_regclass('private.character_parent_admissions_v1') IS NULL
    OR pg_catalog.to_regprocedure('private.enrolled_character_parent_v1(uuid)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_earned_racial_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

-- The installed parent companion is a prerequisite, rather than a function
-- name/role exception. Every admitted exact postimage and wire is checked.
DO $parent_profiles$
DECLARE item record; proc pg_catalog.pg_proc%ROWTYPE;
  returns_type oid; returns_set boolean;
BEGIN
  IF EXISTS(SELECT 1 FROM private.character_parent_admissions_v1)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls) THEN
    RAISE EXCEPTION 'builder_earned_racial_parent_profile_changed' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','4076b5038db7f3d8189efac86b092fbb','postgres',true,'v'),
    ('private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)','e67b88092e048881f06f9f938ed4145d','postgres',true,'v'),
    ('private.apply_builder_details_v1(uuid,jsonb)','4eb7010b13a560acb1445f5196824baf','postgres',true,'v'),
    ('public.character_builder_command_before_catalog_v1(jsonb,jsonb)','ef2bbbbc83f0ce69612fd8fcbc2571b3','postgres',true,'v'),
    ('public.commit_character_builder_equipment_v1(jsonb,jsonb)','92bdff9c01f7429f072a52ca28748630','postgres',true,'v'),
    ('private.finish_builder_step_v1(jsonb,uuid)','49990c8349db9680757469a1d6fd1ff3','postgres',true,'v'),
    ('private.observe_first_class_choices_revision_v1(jsonb,uuid)','32fbfa2b750bd00dabf89bdd777f0a48','inkborne_hit_die_authority_owner',true,'v'),
    ('public.save_character_abilities(uuid,text,jsonb,text,jsonb)','fe71271a233a802f2991fe0104326438','postgres',false,'v'),
    ('public.patch_character_state_if_current(uuid,jsonb,jsonb)','30f211de2e633e567b0b042ac4d14ffb','postgres',false,'v'),
    ('public.set_character_background(uuid,uuid,integer)','0e0693525522919e612e7c695c22c416','postgres',true,'v'),
    ('public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer)','b25e412d1abde998cf511db422f175c1','postgres',true,'v'),
    ('private.enrolled_character_parent_v1(uuid)','39f00b9614eb00d21d514486da49ee67','postgres',true,'v'),
    ('private.lock_enrolled_parent_guard_v1()','e7969b004266fc6991802acb3743fb10','inkborne_hit_die_authority_owner',true,'v'),
    ('public.lock_character_parent_write_guard_v1()','e7969b004266fc6991802acb3743fb10','inkborne_hit_die_authority_owner',true,'v'),
    ('private.character_parent_mechanics_v1(jsonb)','970b0e0619cdc5ca2ef38fe5eb044420','postgres',false,'i'),
    ('private.first_class_parent_admission_v1(uuid)','57b263f0246b03eee91d154544a9a83f','inkborne_class_origin_owner',true,'v'),
    ('private.seal_builder_parent_admission_v1(uuid,jsonb)','c0a4b6452c9a4c0fb9e5fc257b44fc4f','postgres',true,'v'),
    ('private.observe_unchanged_builder_background_v1(uuid,uuid,integer)','8e5b50dfae8a80866ce474f4239394c2','postgres',true,'v'),
    ('private.enrolled_parent_statement_guard_v1()','e0c9c82b7b9efb9226ba6c214120ebd8','inkborne_hit_die_authority_owner',true,'v'),
    ('private.enrolled_parent_before_v1()','0f7b63f7cd814edbfff30587fe222723','postgres',true,'v'),
    ('private.enrolled_parent_after_revision_v1()','3f79f643c5c2bb19cde738522ef4f09d','postgres',true,'v'),
    ('private.enrolled_parent_observed_v1()','b2eb31d71c9ebc74aa869833bc9c9b61','postgres',true,'v'),
    ('private.finish_parent_admission_v1(uuid,text)','cc211de1f6c9e44df1588191d8d9d0ea','postgres',true,'v'),
    ('private.require_parent_admission_finished_v1()','76f3271ad093b80792103551b7f53607','postgres',true,'v'),
    ('private.hit_die_character_revision_v1()','857950f1a88305838220494f068e5cf5','inkborne_hit_die_authority_owner',true,'v')
  ) expected(signature,body_md5,owner_name,is_definer,volatility) LOOP
    returns_type:=CASE
      WHEN item.signature='private.enrolled_character_parent_v1(uuid)' THEN 'boolean'::pg_catalog.regtype
      WHEN item.signature='private.finish_builder_step_v1(jsonb,uuid)' THEN 'public.characters'::pg_catalog.regtype
      WHEN item.signature IN ('public.save_character_abilities(uuid,text,jsonb,text,jsonb)','public.patch_character_state_if_current(uuid,jsonb,jsonb)',
        'public.set_character_background(uuid,uuid,integer)','public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer)') THEN 'record'::pg_catalog.regtype
      WHEN item.signature IN ('private.enrolled_parent_statement_guard_v1()','private.enrolled_parent_before_v1()',
        'private.enrolled_parent_after_revision_v1()','private.enrolled_parent_observed_v1()',
        'private.require_parent_admission_finished_v1()','private.hit_die_character_revision_v1()') THEN 'trigger'::pg_catalog.regtype
      WHEN item.signature IN ('private.character_parent_mechanics_v1(jsonb)','private.first_class_parent_admission_v1(uuid)',
        'public.character_builder_command_before_catalog_v1(jsonb,jsonb)','public.commit_character_builder_equipment_v1(jsonb,jsonb)',
        'private.observe_first_class_choices_revision_v1(jsonb,uuid)') THEN 'jsonb'::pg_catalog.regtype
      ELSE 'void'::pg_catalog.regtype END;
    returns_set:=returns_type='record'::pg_catalog.regtype;
    SELECT * INTO proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR pg_catalog.md5(pg_catalog.replace(proc.prosrc,E'\r\n',E'\n'))<>item.body_md5
      OR proc.proowner<>item.owner_name::pg_catalog.regrole OR proc.prosecdef IS DISTINCT FROM item.is_definer
      OR proc.prorettype<>returns_type OR proc.proretset IS DISTINCT FROM returns_set OR proc.prokind<>'f'
      OR proc.proisstrict OR proc.proleakproof OR proc.proparallel<>'u'
      OR proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname=CASE
        WHEN item.signature='private.character_parent_mechanics_v1(jsonb)' THEN 'sql' ELSE 'plpgsql' END)
      OR proc.provolatile::text<>item.volatility OR proc.proconfig IS DISTINCT FROM (CASE
        WHEN item.signature='private.enrolled_character_parent_v1(uuid)' THEN ARRAY['search_path=""','row_security=off']::text[]
        ELSE ARRAY['search_path=""']::text[] END)
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proc.proacl,pg_catalog.acldefault('f',proc.proowner))) a
        WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR (a.grantee<>proc.proowner AND NOT (
          (item.signature IN ('private.lock_enrolled_parent_guard_v1()','private.first_class_parent_admission_v1(uuid)',
            'public.lock_character_parent_write_guard_v1()') AND a.grantee='postgres'::pg_catalog.regrole)
          OR (item.signature='private.finish_parent_admission_v1(uuid,text)' AND a.grantee='inkborne_hit_die_authority_owner'::pg_catalog.regrole)
          OR (item.signature='private.observe_first_class_choices_revision_v1(jsonb,uuid)' AND a.grantee='inkborne_class_origin_owner'::pg_catalog.regrole)
          OR (item.signature IN ('public.save_character_abilities(uuid,text,jsonb,text,jsonb)','public.patch_character_state_if_current(uuid,jsonb,jsonb)',
            'public.set_character_background(uuid,uuid,integer)','public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer)',
            'public.lock_character_parent_write_guard_v1()') AND a.grantee IN ('authenticated'::pg_catalog.regrole,'service_role'::pg_catalog.regrole))
          OR (item.signature='public.commit_character_builder_equipment_v1(jsonb,jsonb)' AND a.grantee='service_role'::pg_catalog.regrole))))
      OR (item.signature LIKE 'private.%' AND (pg_catalog.has_function_privilege('anon',proc.oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('authenticated',proc.oid,'EXECUTE') OR pg_catalog.has_function_privilege('service_role',proc.oid,'EXECUTE'))) THEN
      RAISE EXCEPTION 'builder_earned_racial_parent_profile_changed: %',item.signature USING ERRCODE='42501'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['authenticated','service_role']) role_name
    WHERE pg_catalog.has_function_privilege(role_name,'public.lock_character_parent_write_guard_v1()','EXECUTE') IS DISTINCT FROM
      (pg_catalog.has_function_privilege(role_name,'public.save_character_abilities(uuid,text,jsonb,text,jsonb)','EXECUTE')
        OR pg_catalog.has_function_privilege(role_name,'public.patch_character_state_if_current(uuid,jsonb,jsonb)','EXECUTE'))) THEN
    RAISE EXCEPTION 'builder_earned_racial_parent_acl_changed' USING ERRCODE='42501'; END IF;
  IF (SELECT pg_catalog.jsonb_object_agg(tgname,pg_catalog.jsonb_build_array(tgtype,tgfoid::pg_catalog.regprocedure::text,
      COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY c.position)
        FROM pg_catalog.unnest(t.tgattr::smallint[]) WITH ORDINALITY c(attnum,position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=c.attnum),'[]'::jsonb)))
      FROM pg_catalog.pg_trigger t WHERE tgrelid='public.characters'::pg_catalog.regclass AND NOT tgisinternal) IS DISTINCT FROM '{
    "aaa_enrolled_parent_statement_guard":[26,"private.enrolled_parent_statement_guard_v1()",[]],
    "aaa_enrolled_parent_admission":[27,"private.enrolled_parent_before_v1()",[]],
    "enforce_asi_choice_map_boundary":[19,"private.enforce_asi_choice_map_boundary()",["choices"]],
    "enforce_background_choice_map_boundary":[23,"private.enforce_background_choice_map_boundary()",["choices"]],
    "hit_die_character_revision":[19,"private.hit_die_character_revision_v1()",[]],
    "hit_die_order_revision_rebind":[17,"private.hit_die_order_revision_rebind_v1()",[]],
    "prune_inactive_asi_choices_before_choices":[19,"private.prune_inactive_asi_choices_before_choices()",["choices"]],
    "prune_inactive_feature_refs_after_choices":[17,"private.prune_inactive_feature_refs_after_choices()",["choices"]],
    "validate_character_content_boundaries":[17,"private.validate_character_content_boundaries()",["campaign_id","system_id"]],
    "zzz_enrolled_parent_after_revision":[19,"private.enrolled_parent_after_revision_v1()",[]],
    "zzz_enrolled_parent_observed":[17,"private.enrolled_parent_observed_v1()",[]]
  }'::jsonb OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.characters'::pg_catalog.regclass AND NOT tgisinternal
    AND (tgenabled<>'O' OR tgdeferrable OR tginitdeferred OR tgnargs<>0 OR pg_catalog.octet_length(tgargs)<>0 OR tgqual IS NOT NULL
      OR tgoldtable IS NOT NULL OR tgnewtable IS NOT NULL))
    OR (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgname IN ('parent_admission_finished','builder_parent_admission_finished'))<>2
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname IN ('parent_admission_finished','builder_parent_admission_finished')
      AND (NOT tgdeferrable OR NOT tginitdeferred OR tgenabled<>'O' OR tgtype<>5 OR tgnargs<>0 OR tgqual IS NOT NULL
        OR pg_catalog.octet_length(tgargs)<>0 OR tgattr::text<>'' OR tgoldtable IS NOT NULL OR tgnewtable IS NOT NULL
        OR tgfoid<>'private.require_parent_admission_finished_v1()'::pg_catalog.regprocedure
        OR tgrelid<>(CASE tgname WHEN 'parent_admission_finished' THEN 'private.character_parent_admissions_v1'::pg_catalog.regclass
          ELSE 'private.character_builder_capabilities_v1'::pg_catalog.regclass END))) THEN
    RAISE EXCEPTION 'builder_earned_racial_parent_wires_changed' USING ERRCODE='42501'; END IF;
END $parent_profiles$;

DO $dependencies$
DECLARE item record; proc pg_catalog.pg_proc%ROWTYPE;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)','f1e31016bdf00414996ac0853ae5efc2','s'),
    ('private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)','19594d15276862e6d8e2a8ff3f8376f8','s'),
    ('private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)','ac38f1a56f22097481aa51ea3472d592','v'),
    ('private.builder_catalog_dependency_v1(uuid,jsonb,text,text)','9e049a6c5039f785f8ec1c8ddec0431d','v')
  ) expected(signature,body_md5,volatility) LOOP
    SELECT * INTO proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR pg_catalog.md5(pg_catalog.replace(proc.prosrc,E'\r\n',E'\n'))<>item.body_md5
      OR proc.proowner<>'postgres'::pg_catalog.regrole OR NOT proc.prosecdef OR proc.provolatile::text<>item.volatility
      OR proc.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR proc.prokind<>'f' OR proc.proretset
      OR proc.prorettype<>(CASE WHEN item.signature IN ('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)',
        'private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)') THEN 'integer'::pg_catalog.regtype ELSE 'jsonb'::pg_catalog.regtype END)
      OR proc.proisstrict OR proc.proleakproof OR proc.proparallel<>'u'
      OR proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proc.proacl,pg_catalog.acldefault('f',proc.proowner))) a
        WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee<>proc.proowner) THEN
      RAISE EXCEPTION 'builder_earned_racial_dependency_changed: %',item.signature USING ERRCODE='42501'; END IF;
  END LOOP;
END $dependencies$;

CREATE TEMP TABLE pg_temp.earned_racial_functions_v1 ON COMMIT DROP AS
  SELECT p.oid,pg_catalog.to_jsonb(p) AS profile FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private');
CREATE TEMP TABLE pg_temp.earned_racial_triggers_v1 ON COMMIT DROP AS
  SELECT oid,pg_catalog.to_jsonb(t) AS wire FROM pg_catalog.pg_trigger t;

-- Resolve only the finite reviewed immutable declaration. An empty historical
-- source means no earned grant; malformed positive metadata never becomes zero.
CREATE FUNCTION private.builder_earned_racial_source_v1(target uuid,choices jsonb,source_refs jsonb,system_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE roots jsonb; root jsonb; race jsonb; subrace jsonb; entry jsonb; trait jsonb; dependency jsonb;
  kind text; selected text; matches integer;
  contract jsonb:='{"version":1,"source_trait":"infernal-legacy","spellcasting_ability":"charisma","grants":[{"character_level":3,"spell":"hellish-rebuke","spell_level":1,"cast_level":2},{"character_level":5,"spell":"darkness","spell_level":2,"cast_level":2}]}';
BEGIN
  IF pg_catalog.jsonb_typeof(choices) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(source_refs) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(source_refs)>4096 OR pg_catalog.octet_length(source_refs::text)>8388608
    OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(source_refs))<>pg_catalog.jsonb_array_length(source_refs) THEN
    RAISE EXCEPTION 'builder_earned_racial_sources_unavailable' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('pin',r.value,'definition',pg_catalog.to_jsonb(v))),'[]') INTO roots
    FROM pg_catalog.jsonb_array_elements(source_refs) r(value) LEFT JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE v.content_type_snapshot IN ('race','subrace') OR r.value#>>'{context,source}' IN ('race','subrace');
  FOR root IN SELECT value FROM pg_catalog.jsonb_array_elements(roots) LOOP
    kind:=root#>>'{definition,content_type_snapshot}';
    IF root->'definition'='null'::jsonb OR kind IS NULL OR kind NOT IN ('race','subrace')
      OR root#>>'{pin,character_id}' IS DISTINCT FROM target::text
      OR NOT private.builder_uuid_v1(root#>>'{pin,id}') OR root#>>'{definition,system_id_snapshot}' IS DISTINCT FROM system_id::text
      OR root#>'{pin,content_version}' IS DISTINCT FROM root#>'{definition,version}'
      OR root#>'{pin,content_id}' IS DISTINCT FROM root#>'{definition,content_id}'
      OR root#>'{pin,context}' IS DISTINCT FROM pg_catalog.jsonb_build_object('source',kind)
      OR root#>'{pin,feature_grant_id}' IS DISTINCT FROM 'null'::jsonb OR root#>'{pin,choice_source}' IS DISTINCT FROM 'null'::jsonb
      OR pg_catalog.jsonb_typeof(root#>'{definition,data_snapshot}') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'builder_earned_racial_roots_unavailable' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOREACH kind IN ARRAY ARRAY['race','subrace'] LOOP
    IF choices ? kind AND (pg_catalog.jsonb_typeof(choices->kind) IS DISTINCT FROM 'string'
      OR length(pg_catalog.btrim(choices->>kind)) NOT BETWEEN 1 AND 200) THEN
      RAISE EXCEPTION 'builder_earned_racial_roots_unavailable' USING ERRCODE='23514'; END IF;
    selected:=choices->>kind;
    SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,root FROM pg_catalog.jsonb_array_elements(roots)
      WHERE value#>>'{definition,content_type_snapshot}'=kind;
    IF matches<>(CASE WHEN selected IS NULL THEN 0 ELSE 1 END) OR (matches=1 AND root#>>'{definition,slug_snapshot}' IS DISTINCT FROM selected) THEN
      RAISE EXCEPTION 'builder_earned_racial_roots_unavailable' USING ERRCODE='23514'; END IF;
    IF kind='race' THEN race:=root; ELSE subrace:=root; END IF;
  END LOOP;
  IF subrace IS NOT NULL AND (race IS NULL OR subrace#>>'{definition,data_snapshot,parent_race}' IS DISTINCT FROM race#>>'{definition,slug_snapshot}') THEN
    RAISE EXCEPTION 'builder_earned_racial_roots_unavailable' USING ERRCODE='23514'; END IF;
  IF subrace#>'{definition,data_snapshot}' ? 'earned_racial_spells' THEN
    RAISE EXCEPTION 'builder_earned_racial_contract_unavailable' USING ERRCODE='23514'; END IF;
  IF race IS NULL OR NOT ((race#>'{definition,data_snapshot}') ? 'earned_racial_spells') THEN RETURN NULL; END IF;
  IF subrace IS NOT NULL OR race#>>'{definition,slug_snapshot}' IS DISTINCT FROM 'tiefling'
    OR race#>'{definition,data_snapshot,earned_racial_spells}' IS DISTINCT FROM contract
    OR race#>>'{definition,source_snapshot}' IS DISTINCT FROM 'srd' OR race#>>'{definition,scope_snapshot}' IS DISTINCT FROM 'platform'
    OR race#>'{definition,owner_id_snapshot}' IS DISTINCT FROM 'null'::jsonb
    OR pg_catalog.jsonb_typeof(race#>'{definition,data_snapshot,traits}') IS DISTINCT FROM 'array'
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(race#>'{definition,data_snapshot,traits}') WHERE value='"infernal-legacy"'::jsonb)<>1 THEN
    RAISE EXCEPTION 'builder_earned_racial_contract_unavailable' USING ERRCODE='23514'; END IF;
  dependency:=private.builder_catalog_dependency_v1(target,race->'definition','trait','infernal-legacy');
  SELECT count(*),pg_catalog.jsonb_agg(r.value)->0 INTO matches,trait FROM pg_catalog.jsonb_array_elements(source_refs) r(value)
    JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE v.content_type_snapshot='trait' AND v.slug_snapshot='infernal-legacy';
  IF matches<>1 OR trait->>'character_id' IS DISTINCT FROM target::text OR NOT private.builder_uuid_v1(trait->>'id')
    OR trait->'content_id' IS DISTINCT FROM dependency->'content_id' OR trait->'content_version' IS DISTINCT FROM dependency->'version'
    OR trait->'context' IS DISTINCT FROM pg_catalog.jsonb_build_object('source','racial_trait','root_controller_ref_id',race#>>'{pin,id}')
    OR trait->>'choice_source' IS DISTINCT FROM 'builder:racial-trait:infernal-legacy' OR trait->'feature_grant_id' IS DISTINCT FROM 'null'::jsonb
    OR dependency->>'system_id_snapshot' IS DISTINCT FROM system_id::text OR dependency->>'source_snapshot' IS DISTINCT FROM 'srd'
    OR dependency->>'scope_snapshot' IS DISTINCT FROM 'platform' OR dependency->'owner_id_snapshot' IS DISTINCT FROM 'null'::jsonb
    OR dependency#>'{data_snapshot,races}' IS DISTINCT FROM '["tiefling"]'::jsonb
    OR COALESCE(dependency#>'{data_snapshot,subraces}','[]') IS DISTINCT FROM '[]'::jsonb
    OR pg_catalog.jsonb_typeof(dependency->'effects_snapshot') IS DISTINCT FROM 'array'
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(dependency->'effects_snapshot') WHERE value->>'type'='grant' AND value->>'stat'='spellcasting_ability')<>1
    OR NOT (dependency->'effects_snapshot') @> '[{"type":"grant","stat":"spellcasting_ability","value":"charisma"}]'::jsonb
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(dependency->'effects_snapshot') WHERE value->>'type'='grant' AND value->>'stat'='spell')<>1
    OR NOT (dependency->'effects_snapshot') @> '[{"type":"grant","stat":"spell","value":"thaumaturgy"}]'::jsonb
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(dependency->'effects_snapshot') e(value)
      WHERE e.value->>'type'='grant' AND e.value->>'stat' IN ('spellcasting_ability','spell')
        AND NOT private.builder_exact_keys_v1(e.value,ARRAY['type','stat','value'])) THEN
    RAISE EXCEPTION 'builder_earned_racial_trait_unavailable' USING ERRCODE='23514'; END IF;
  RETURN race||pg_catalog.jsonb_build_object('trait_pin',trait);
END $$;

-- Only the already admitted compilers call this owner-only final reconciler.
-- Complete prior ownership is checked before either pruning or allocating rows.
CREATE FUNCTION private.prepare_builder_earned_racial_spells_v1(target uuid,pending_choices jsonb,graph jsonb,supplemental_refs jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
  prior_refs jsonb; pending_refs jsonb; prior_source jsonb; pending_source jsonb; source jsonb; roots jsonb;
  current_choices jsonb; current_graph jsonb; picked jsonb; occurrence jsonb; pin jsonb; definition public.content_versions%ROWTYPE;
  prior_level integer; pending_level integer; selected_level integer; total integer; count_classes integer; matches integer;
  side integer; kind text; root jsonb; old_root jsonb; original uuid; tier jsonb; dependency jsonb; metadata jsonb; expected jsonb;
  existing jsonb; claims jsonb:='[]'; retained jsonb:='[]'; spells jsonb; entry jsonb; physical public.character_spells%ROWTYPE;
  grant_key text; expected_keys text[]:='{}';
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(pending_choices) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(graph->'refs') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(graph->'spells') IS DISTINCT FROM 'array' OR pg_catalog.jsonb_typeof(graph->'occurrences') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(supplemental_refs) IS DISTINCT FROM 'array' OR pg_catalog.octet_length(graph::text)+pg_catalog.octet_length(supplemental_refs::text)>8388608 THEN
    RAISE EXCEPTION 'builder_earned_racial_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND OR pg_catalog.to_jsonb(parent) IS DISTINCT FROM cap.before_parent THEN
    RAISE EXCEPTION 'builder_earned_racial_preimage_changed' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') INTO roots FROM public.character_content_refs r
    LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
    WHERE r.character_id=target AND (v.content_type_snapshot IN ('race','subrace') OR r.context->>'source' IN ('race','subrace'));
  prior_refs:=(cap.protected_graph->'refs')||roots; pending_refs:=(graph->'refs')||supplemental_refs;
  prior_source:=private.builder_earned_racial_source_v1(target,cap.before_parent->'choices',prior_refs,parent.system_id);
  pending_source:=private.builder_earned_racial_source_v1(target,pending_choices,pending_refs,parent.system_id);
  -- The first-class B3 producer does not call this normalizer. Established
  -- nonparticipating builders retain the exact existing normalizer result;
  -- they acquire no new original-occurrence/class-manifest requirement.
  IF prior_source IS NULL AND pending_source IS NULL THEN
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements((cap.protected_graph->'spells')||(graph->'spells')) s(value)
      WHERE pg_catalog.jsonb_typeof(s.value->'custom_data')='object' AND (s.value->'custom_data') ? 'builder_earned_racial_spell') THEN
      RAISE EXCEPTION 'builder_earned_racial_unproved_claim' USING ERRCODE='23514'; END IF;
    RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph);
  END IF;
  -- A normal source selection cannot silently replace an existing same-slug
  -- immutable root version. Historical correction is a separate reviewed lane.
  FOREACH kind IN ARRAY ARRAY['race','subrace'] LOOP
    IF cap.before_parent#>ARRAY['choices',kind] IS NOT NULL AND cap.before_parent#>ARRAY['choices',kind]=pending_choices->kind THEN
      SELECT r.value INTO old_root FROM pg_catalog.jsonb_array_elements(prior_refs) r(value) JOIN public.content_versions v
        ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer WHERE v.content_type_snapshot=kind;
      SELECT r.value INTO root FROM pg_catalog.jsonb_array_elements(pending_refs) r(value) JOIN public.content_versions v
        ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer WHERE v.content_type_snapshot=kind;
      IF old_root IS DISTINCT FROM root THEN RAISE EXCEPTION 'builder_earned_racial_root_correction_required' USING ERRCODE='22023'; END IF;
    END IF;
  END LOOP;
  -- Saved and pending totals use their accepted immutable occurrence/controller
  -- tuples. Acquisition can add a trusted pending occurrence before its insert.
  original:=(private.builder_original_occurrence_v1(target)->>'id')::uuid;
  FOR side IN 0..1 LOOP
    current_choices:=CASE WHEN side=0 THEN cap.before_parent->'choices' ELSE pending_choices END;
    current_graph:=CASE WHEN side=0 THEN cap.protected_graph ELSE graph END;
    IF original IS NULL OR pg_catalog.jsonb_typeof(current_choices->'classes') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_typeof(current_graph->'occurrences') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
    count_classes:=pg_catalog.jsonb_array_length(current_choices->'classes'); total:=0;
    IF count_classes NOT BETWEEN 1 AND 20 OR (SELECT count(DISTINCT value->>'slug') FROM pg_catalog.jsonb_array_elements(current_choices->'classes'))<>count_classes
      OR (SELECT count(DISTINCT value->>'occurrence_id') FROM pg_catalog.jsonb_array_elements(current_choices->'classes'))<>count_classes
      OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(current_choices->'classes') WHERE value->>'occurrence_id'=original::text)<>1
      OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(current_graph->'occurrences') WHERE value->>'lifecycle'<>'ended')<>count_classes THEN
      RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
    FOR picked IN SELECT value FROM pg_catalog.jsonb_array_elements(current_choices->'classes') LOOP
      IF NOT private.builder_uuid_v1(picked->>'occurrence_id') OR pg_catalog.jsonb_typeof(picked->'level') IS DISTINCT FROM 'number'
        OR picked->>'level' !~ '^([1-9]|1[0-9]|20)$' THEN RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
      selected_level:=(picked->>'level')::integer; total:=total+selected_level;
      SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,occurrence FROM pg_catalog.jsonb_array_elements(current_graph->'occurrences')
        WHERE value->>'id'=picked->>'occurrence_id';
      IF matches<>1 OR occurrence->>'lifecycle' IS DISTINCT FROM 'accepted' OR occurrence->>'character_id' IS DISTINCT FROM target::text
        OR occurrence->>'system_id' IS DISTINCT FROM parent.system_id::text OR occurrence->>'class_slug' IS DISTINCT FROM picked->>'slug' THEN
        RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
      SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,pin FROM pg_catalog.jsonb_array_elements(current_graph->'refs')
        WHERE value->'id'=occurrence->'controller_ref_id';
      IF matches<>1 OR pin->>'character_id' IS DISTINCT FROM target::text OR pin->'content_id' IS DISTINCT FROM occurrence->'content_id'
        OR pin->'content_version' IS DISTINCT FROM occurrence->'content_version' OR pin->'feature_grant_id' IS DISTINCT FROM 'null'::jsonb
        OR pin#>>'{context,source}' IS DISTINCT FROM 'class' THEN RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
      SELECT * INTO definition FROM public.content_versions WHERE content_id=(pin->>'content_id')::uuid AND version=(pin->>'content_version')::integer;
      IF NOT FOUND OR definition.content_type_snapshot IS DISTINCT FROM 'class' OR definition.system_id_snapshot IS DISTINCT FROM parent.system_id
        OR definition.slug_snapshot IS DISTINCT FROM picked->>'slug' OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(definition.data_snapshot->'levels') WHERE value->'level'=pg_catalog.to_jsonb(selected_level)) THEN
        RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
    END LOOP;
    IF total NOT BETWEEN 1 AND 20 OR (side=0 AND total<>(cap.before_parent->>'level')::integer) THEN
      RAISE EXCEPTION 'builder_earned_racial_classes_unavailable' USING ERRCODE='23514'; END IF;
    IF side=0 THEN prior_level:=total; ELSE pending_level:=total; END IF;
  END LOOP;
  -- Every prior marker, even on a forged source/group, must be the exact owned
  -- row earned by the old immutable source and old total. Do not heal omissions.
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'spells') LOOP
    IF pg_catalog.jsonb_typeof(entry->'custom_data')='object' AND (entry->'custom_data') ? 'builder_earned_racial_spell' THEN
      claims:=claims||pg_catalog.jsonb_build_array(entry);
    ELSIF entry->>'source'='racial_trait' THEN
      SELECT * INTO definition FROM public.content_versions WHERE content_id=(entry->>'content_id')::uuid AND version=(entry->>'content_version')::integer;
      IF NOT FOUND OR definition.data_snapshot->'level' IS DISTINCT FROM '0'::jsonb THEN
        RAISE EXCEPTION 'builder_earned_racial_unproved_claim' USING ERRCODE='23514'; END IF;
    END IF;
  END LOOP;
  FOR side IN 0..1 LOOP
    source:=CASE WHEN side=0 THEN prior_source ELSE pending_source END;
    IF source IS NULL THEN CONTINUE; END IF;
    FOR tier IN SELECT value FROM pg_catalog.jsonb_array_elements(source#>'{definition,data_snapshot,earned_racial_spells,grants}') LOOP
      IF (tier->>'character_level')::integer>(CASE WHEN side=0 THEN prior_level ELSE pending_level END) THEN CONTINUE; END IF;
      dependency:=private.builder_catalog_dependency_v1(target,source->'definition','spell',tier->>'spell');
      IF dependency#>'{data_snapshot,level}' IS DISTINCT FROM tier->'spell_level' OR dependency->>'system_id_snapshot' IS DISTINCT FROM parent.system_id::text
        OR dependency->>'source_snapshot' IS DISTINCT FROM 'srd' OR dependency->>'scope_snapshot' IS DISTINCT FROM 'platform'
        OR dependency->'owner_id_snapshot' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'builder_earned_racial_spell_unavailable' USING ERRCODE='23514'; END IF;
      grant_key:='infernal-legacy:'||(tier->>'character_level')||':'||(tier->>'spell');
      metadata:=pg_catalog.jsonb_build_object('builder_source_pin_id',source#>>'{trait_pin,id}','builder_root_ref_id',source#>>'{pin,id}',
        'builder_choice_id',NULL,'spellcasting_ability','charisma','builder_earned_racial_spell',pg_catalog.jsonb_build_object('contract_version',1,
          'grant_key',grant_key,'character_level',tier->'character_level','spell_level',tier->'spell_level','cast_level',tier->'cast_level'));
      physical:=NULL; physical.character_id:=target; physical.content_id:=(dependency->>'content_id')::uuid;
      physical.content_version:=(dependency->>'version')::integer; physical.name:=dependency->>'name_snapshot'; physical.class_slug:='race:tiefling';
      physical.is_known:=true; physical.is_prepared:=true; physical.always_prepared:=true; physical.in_spellbook:=false;
      physical.source:='racial_trait'; physical.spell_grant_id:=NULL; physical.custom_data:=metadata;
      expected:=pg_catalog.to_jsonb(physical)-ARRAY['id','created_at'];
      SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,existing FROM pg_catalog.jsonb_array_elements(claims)
        WHERE (value-ARRAY['id','created_at'])=expected;
      IF side=0 THEN
        IF matches<>1 OR NOT private.builder_uuid_v1(existing->>'id') OR pg_catalog.jsonb_typeof(existing->'created_at') IS DISTINCT FROM 'string'
          OR NOT pg_catalog.isfinite((existing->>'created_at')::timestamptz) THEN
          RAISE EXCEPTION 'builder_earned_racial_prior_incomplete' USING ERRCODE='23514'; END IF;
        expected_keys:=array_append(expected_keys,existing->>'id');
      ELSE
        IF matches>1 THEN RAISE EXCEPTION 'builder_earned_racial_duplicate_claim' USING ERRCODE='23514'; END IF;
        IF matches=0 THEN physical.id:=pg_catalog.gen_random_uuid(); physical.created_at:=pg_catalog.transaction_timestamp(); existing:=pg_catalog.to_jsonb(physical); END IF;
        retained:=retained||pg_catalog.jsonb_build_array(existing);
      END IF;
    END LOOP;
  END LOOP;
  IF cardinality(expected_keys)<>pg_catalog.jsonb_array_length(claims) THEN
    RAISE EXCEPTION 'builder_earned_racial_unproved_claim' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(graph->'spells') s(value)
    WHERE NOT COALESCE(pg_catalog.jsonb_typeof(s.value->'custom_data')='object' AND (s.value->'custom_data') ? 'builder_earned_racial_spell',false);
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(graph->'spells') s(value)
    WHERE pg_catalog.jsonb_typeof(s.value->'custom_data')='object' AND (s.value->'custom_data') ? 'builder_earned_racial_spell'
      AND NOT claims @> pg_catalog.jsonb_build_array(s.value)) THEN
    RAISE EXCEPTION 'builder_earned_racial_pending_claim_changed' USING ERRCODE='23514'; END IF;
  spells:=spells||retained;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells);
  IF pg_catalog.jsonb_array_length(spells)>400 OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(spells))<>pg_catalog.jsonb_array_length(spells)
    OR pg_catalog.octet_length((graph||pg_catalog.jsonb_build_object('spells',spells))::text)>8388608 THEN
    RAISE EXCEPTION 'builder_earned_racial_graph_bound' USING ERRCODE='54000'; END IF;
  RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph||pg_catalog.jsonb_build_object('spells',spells));
END $$;

ALTER FUNCTION private.builder_earned_racial_source_v1(uuid,jsonb,jsonb,uuid) OWNER TO postgres;
ALTER FUNCTION private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.builder_earned_racial_source_v1(uuid,jsonb,jsonb,uuid),private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

DO $hook$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text;
  needle text:='RETURN private.prepare_builder_bonus_spells_v1(target,projected->''choices'',projected->''graph'',NULL,NULL);';
  insertion text:='projected:=private.prepare_builder_bonus_spells_v1(target,projected->''choices'',projected->''graph'',NULL,NULL); RETURN private.prepare_builder_earned_racial_spells_v1(target,projected->''choices'',projected->''graph'',supplemental_refs);';
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid='private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)'::pg_catalog.regprocedure;
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  IF pg_catalog.md5(source)<>'ac38f1a56f22097481aa51ea3472d592'
    OR (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_earned_racial_hook_preimage_changed' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(source,needle,insertion);
  IF pg_catalog.md5(replacement)<>'ecd93787a191f3074ae6b458b763e932' THEN
    RAISE EXCEPTION 'builder_earned_racial_hook_postimage_changed' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF pg_catalog.to_jsonb(repaired)-'prosrc' IS DISTINCT FROM pg_catalog.to_jsonb(original)-'prosrc' OR repaired.prosrc IS DISTINCT FROM replacement THEN
    RAISE EXCEPTION 'builder_earned_racial_hook_profile_changed' USING ERRCODE='42501'; END IF;
END $hook$;

DO $closed$
DECLARE signature text; proc pg_catalog.pg_proc%ROWTYPE;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_temp.earned_racial_functions_v1 b LEFT JOIN pg_catalog.pg_proc a ON a.oid=b.oid
      WHERE (CASE WHEN b.oid='private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)'::pg_catalog.regprocedure
        THEN b.profile-'prosrc' IS DISTINCT FROM pg_catalog.to_jsonb(a)-'prosrc' ELSE b.profile IS DISTINCT FROM pg_catalog.to_jsonb(a) END))
    OR EXISTS(SELECT 1 FROM pg_temp.earned_racial_triggers_v1 b LEFT JOIN pg_catalog.pg_trigger a ON a.oid=b.oid WHERE b.wire IS DISTINCT FROM pg_catalog.to_jsonb(a))
    OR (SELECT count(*) FROM pg_catalog.pg_trigger)<>(SELECT count(*) FROM pg_temp.earned_racial_triggers_v1)
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1) OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready) OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_earned_racial_closure_failed' USING ERRCODE='42501'; END IF;
  FOREACH signature IN ARRAY ARRAY['private.builder_earned_racial_source_v1(uuid,jsonb,jsonb,uuid)',
    'private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb)'] LOOP
    SELECT * INTO proc FROM pg_catalog.pg_proc WHERE oid=signature::pg_catalog.regprocedure;
    IF proc.proowner<>'postgres'::pg_catalog.regrole OR NOT proc.prosecdef OR proc.provolatile<>'v' OR proc.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR proc.prorettype<>'jsonb'::pg_catalog.regtype OR proc.proretset OR proc.proisstrict OR proc.proleakproof OR proc.proparallel<>'u'
      OR proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
      OR pg_catalog.md5(pg_catalog.replace(proc.prosrc,E'\r\n',E'\n'))<>(CASE signature
        WHEN 'private.builder_earned_racial_source_v1(uuid,jsonb,jsonb,uuid)' THEN '13b480ff386a5c565e205370ce08fbe0'
        ELSE '05989bdb6d1683d31d781e67b302a04d' END)
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proc.proacl,pg_catalog.acldefault('f',proc.proowner))) a
        WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee<>proc.proowner) THEN
      RAISE EXCEPTION 'builder_earned_racial_helper_profile_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $closed$;
COMMIT;

