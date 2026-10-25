-- STAGED ONLY: selected immutable subrace HP, after Draconic HP then parent
-- admission. No writer, graph, receipt, order, gate or authority is expanded.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)') IS NOT NULL
    OR pg_catalog.to_regclass('private.character_parent_admissions_v1') IS NULL
    OR pg_catalog.to_regprocedure('private.enrolled_character_parent_v1(uuid)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_ancestry_hp_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

-- The installed parent companion is a prerequisite, rather than a function
-- name/role exception. Every admitted exact postimage and wire is checked.
DO $parent_profiles$
DECLARE item record; proc pg_catalog.pg_proc%ROWTYPE;
  returns_type oid; returns_set boolean;
BEGIN
  IF EXISTS(SELECT 1 FROM private.character_parent_admissions_v1)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls) THEN
    RAISE EXCEPTION 'builder_ancestry_hp_parent_profile_changed' USING ERRCODE='42501'; END IF;
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
      RAISE EXCEPTION 'builder_ancestry_hp_parent_profile_changed: %',item.signature USING ERRCODE='42501'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['authenticated','service_role']) role_name
    WHERE pg_catalog.has_function_privilege(role_name,'public.lock_character_parent_write_guard_v1()','EXECUTE') IS DISTINCT FROM
      (pg_catalog.has_function_privilege(role_name,'public.save_character_abilities(uuid,text,jsonb,text,jsonb)','EXECUTE')
        OR pg_catalog.has_function_privilege(role_name,'public.patch_character_state_if_current(uuid,jsonb,jsonb)','EXECUTE'))) THEN
    RAISE EXCEPTION 'builder_ancestry_hp_parent_acl_changed' USING ERRCODE='42501'; END IF;
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
    RAISE EXCEPTION 'builder_ancestry_hp_parent_wires_changed' USING ERRCODE='42501'; END IF;
END $parent_profiles$;

CREATE TEMP TABLE pg_temp.ancestry_hp_functions_v1 ON COMMIT DROP AS
  SELECT p.oid,pg_catalog.to_jsonb(p) AS profile FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private');
CREATE TEMP TABLE pg_temp.ancestry_hp_triggers_v1 ON COMMIT DROP AS
  SELECT oid,pg_catalog.to_jsonb(t) AS wire FROM pg_catalog.pg_trigger t WHERE tgrelid IN (
    'public.characters'::pg_catalog.regclass,'private.character_parent_admissions_v1'::pg_catalog.regclass,
    'private.character_builder_capabilities_v1'::pg_catalog.regclass);

DO $hp_profile$
DECLARE proc pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)');
  IF NOT FOUND OR pg_catalog.md5(pg_catalog.replace(proc.prosrc,E'\r\n',E'\n'))<>'6f4e810b99cfd755babcc0fc058c2431'
    OR proc.proowner<>'postgres'::pg_catalog.regrole OR NOT proc.prosecdef OR proc.provolatile<>'s'
    OR proc.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proc.proacl,pg_catalog.acldefault('f',proc.proowner))) a
      WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee<>proc.proowner) THEN
    RAISE EXCEPTION 'builder_ancestry_hp_dependency_changed' USING ERRCODE='42501'; END IF;
END $hp_profile$;

-- Both existing maximum-HP callers already hold the admitted writer singleton
-- and parent locks. This STABLE helper reads actual frozen ancestry rows; the
-- pending protected graph deliberately does not contain those roots.
CREATE FUNCTION private.builder_ancestry_hit_point_bonus_v1(target uuid,choices jsonb) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; roots jsonb; root jsonb; race jsonb; subrace jsonb;
  kind text; slug text; matches integer; total integer;
BEGIN
  SELECT * INTO parent FROM public.characters WHERE id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(choices) IS DISTINCT FROM 'object'
    OR choices->'race' IS DISTINCT FROM parent.choices->'race' OR choices->'subrace' IS DISTINCT FROM parent.choices->'subrace' THEN
    RAISE EXCEPTION 'builder_ancestry_hp_saved_ancestry_required' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('pin',pg_catalog.to_jsonb(r),'definition',pg_catalog.to_jsonb(v)) ORDER BY r.id),'[]') INTO roots
    FROM public.character_content_refs r LEFT JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
    WHERE r.character_id=target AND (v.content_type_snapshot IN ('race','subrace') OR r.context->>'source' IN ('race','subrace'));
  FOR root IN SELECT value FROM pg_catalog.jsonb_array_elements(roots) LOOP
    IF root->'definition'='null'::jsonb OR root#>>'{definition,content_type_snapshot}' NOT IN ('race','subrace')
      OR root#>>'{definition,system_id_snapshot}' IS DISTINCT FROM parent.system_id::text
      OR root#>>'{definition,source_snapshot}' IS NULL OR root#>>'{definition,source_snapshot}' NOT IN ('srd','homebrew')
      OR root#>>'{definition,scope_snapshot}' IS NULL OR root#>>'{definition,scope_snapshot}' NOT IN ('platform','personal','shared')
      OR pg_catalog.jsonb_typeof(root#>'{definition,data_snapshot}') IS DISTINCT FROM 'object'
      OR (root#>>'{pin,content_version}')::integer<1 THEN
      RAISE EXCEPTION 'builder_ancestry_hp_roots_unavailable' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOREACH kind IN ARRAY ARRAY['race','subrace'] LOOP
    IF parent.choices ? kind AND (pg_catalog.jsonb_typeof(parent.choices->kind) IS DISTINCT FROM 'string'
      OR length(pg_catalog.btrim(parent.choices->>kind)) NOT BETWEEN 1 AND 200) THEN
      RAISE EXCEPTION 'builder_ancestry_hp_roots_unavailable' USING ERRCODE='23514'; END IF;
    slug:=parent.choices->>kind;
    SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,root FROM pg_catalog.jsonb_array_elements(roots)
      WHERE value#>>'{definition,content_type_snapshot}'=kind;
    IF matches<>(CASE WHEN slug IS NULL THEN 0 ELSE 1 END) OR (matches=1 AND root#>>'{definition,slug_snapshot}' IS DISTINCT FROM slug) THEN
      RAISE EXCEPTION 'builder_ancestry_hp_roots_unavailable' USING ERRCODE='23514'; END IF;
    IF kind='race' THEN race:=root; ELSE subrace:=root; END IF;
  END LOOP;
  IF subrace IS NOT NULL AND (race IS NULL OR subrace#>>'{definition,data_snapshot,parent_race}' IS DISTINCT FROM race#>>'{definition,slug_snapshot}') THEN
    RAISE EXCEPTION 'builder_ancestry_hp_roots_unavailable' USING ERRCODE='23514'; END IF;
  -- Valid historical roots retain zero without introducing a class-role or new
  -- root-context requirement that they did not previously need.
  IF subrace IS NULL OR NOT ((subrace#>'{definition,data_snapshot}') ? 'hit_points_bonus_per_character_level') THEN RETURN 0; END IF;
  IF subrace#>'{definition,data_snapshot,hit_points_bonus_per_character_level}' IS DISTINCT FROM '1'::jsonb THEN
    RAISE EXCEPTION 'builder_ancestry_hp_metadata_unavailable' USING ERRCODE='23514'; END IF;
  FOR root IN SELECT value FROM pg_catalog.jsonb_array_elements(roots) LOOP
    IF root#>'{pin,context}' IS DISTINCT FROM pg_catalog.jsonb_build_object('source',root#>>'{definition,content_type_snapshot}')
      OR root#>'{pin,feature_grant_id}' IS DISTINCT FROM 'null'::jsonb OR root#>'{pin,choice_source}' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'builder_ancestry_hp_roots_unavailable' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF pg_catalog.jsonb_typeof(choices->'classes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'builder_ancestry_hp_classes_unavailable' USING ERRCODE='23514'; END IF;
  IF pg_catalog.jsonb_array_length(choices->'classes') NOT BETWEEN 1 AND 20
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(choices->'classes') c(value) WHERE
      pg_catalog.jsonb_typeof(c.value->'level') IS DISTINCT FROM 'number' OR c.value->>'level' !~ '^([1-9]|1[0-9]|20)$') THEN
    RAISE EXCEPTION 'builder_ancestry_hp_classes_unavailable' USING ERRCODE='23514'; END IF;
  -- The original calculator has already validated the full pending class graph,
  -- original occurrence, die/CON minima and each owning subclass term.
  SELECT sum((value->>'level')::integer) INTO total FROM pg_catalog.jsonb_array_elements(choices->'classes');
  IF total NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'builder_ancestry_hp_classes_unavailable' USING ERRCODE='23514'; END IF;
  RETURN total;
END $$;
ALTER FUNCTION private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

DO $replace_calculation$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text;
  needle text:=E'  RETURN result;\n';
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid='private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)'::pg_catalog.regprocedure;
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_ancestry_hp_source_fragment_changed' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(source,needle,E'  RETURN result+private.builder_ancestry_hit_point_bonus_v1(target,choices);\n');
  IF pg_catalog.md5(replacement)<>'f1e31016bdf00414996ac0853ae5efc2' THEN RAISE EXCEPTION 'builder_ancestry_hp_source_postimage_changed' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF pg_catalog.to_jsonb(repaired)-'prosrc' IS DISTINCT FROM pg_catalog.to_jsonb(original)-'prosrc'
    OR repaired.prosrc IS DISTINCT FROM replacement THEN RAISE EXCEPTION 'builder_ancestry_hp_source_attributes_changed' USING ERRCODE='42501'; END IF;
END $replace_calculation$;

DO $closed$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_temp.ancestry_hp_functions_v1 b LEFT JOIN pg_catalog.pg_proc a ON a.oid=b.oid
      WHERE (CASE WHEN b.oid='private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)'::pg_catalog.regprocedure
        THEN b.profile-'prosrc' IS DISTINCT FROM pg_catalog.to_jsonb(a)-'prosrc' ELSE b.profile IS DISTINCT FROM pg_catalog.to_jsonb(a) END))
    OR EXISTS(SELECT 1 FROM pg_temp.ancestry_hp_triggers_v1 b LEFT JOIN pg_catalog.pg_trigger a ON a.oid=b.oid WHERE b.wire IS DISTINCT FROM pg_catalog.to_jsonb(a))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid='private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)'::pg_catalog.regprocedure
        AND (a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee<>p.proowner))
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)'::pg_catalog.regprocedure
      AND p.proowner='postgres'::pg_catalog.regrole AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=""']::text[]
      AND pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n'))='19594d15276862e6d8e2a8ff3f8376f8')
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1) OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready) OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_ancestry_hp_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
