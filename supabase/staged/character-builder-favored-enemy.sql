-- Disposable local companion after multiclass and class-feature choices.
-- Atomic Favored Enemy selections and their exact language pins. Conditional
-- advantage remains narrative; this introduces no generic content writer.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)') IS NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_favored_enemies_v1(uuid,jsonb,jsonb,text)') IS NOT NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_favored_enemy_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

CREATE FUNCTION private.prepare_builder_favored_enemies_v1(target uuid,pending_choices jsonb,expected jsonb,strict_feature_slug text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; refs jsonb; prior jsonb; enemy_source jsonb; pin jsonb;
  sources jsonb; selections jsonb; normalized jsonb:='{}'; candidate jsonb; selection jsonb; enemy text; race jsonb;
  language_definition public.content_versions%ROWTYPE; valid boolean; seen_types text[]:='{}'; seen_races text[]:='{}';
  key text; duplicate boolean;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(pending_choices) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(expected->'refs') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'refs') r(value)
      WHERE r.value->>'character_id' IS DISTINCT FROM target::text) THEN
    RAISE EXCEPTION 'builder_favored_enemy_sources_unavailable' USING ERRCODE='23514'; END IF;
  prior:=cap.protected_graph->'refs';
  SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(expected->'refs') r(value)
    WHERE COALESCE(r.value->>'choice_source','') NOT LIKE 'builder:favored-enemy:%';
  -- Only genuine active feature-grant pins can authorize a selection. A
  -- lookalike mutable catalog entry or unearned higher tier supplies no source.
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) ORDER BY (v.data_snapshot->>'level')::integer,v.slug_snapshot),'[]') INTO sources
    FROM pg_catalog.jsonb_array_elements(refs) r(value)
    JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE v.content_type_snapshot='feature' AND v.data_snapshot->>'class'='ranger'
      AND v.data_snapshot->>'feature_type'='favored_enemy'
      AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
        WHERE g.value->'id'=r.value->'feature_grant_id' AND g.value->'feature_content_id'=r.value->'content_id'
          AND g.value->'feature_version'=r.value->'content_version');
  IF strict_feature_slug IS NOT NULL AND (SELECT count(*) FROM pg_catalog.jsonb_array_elements(sources) s(value)
    WHERE s.value->>'slug_snapshot'=strict_feature_slug)<>1 THEN
    RAISE EXCEPTION 'builder_favored_enemy_unavailable' USING ERRCODE='22023'; END IF;
  selections:=COALESCE(pending_choices->'favored_enemies','{}');
  IF pg_catalog.jsonb_typeof(selections) IS DISTINCT FROM 'object' OR pg_catalog.octet_length(selections::text)>16384 THEN
    RAISE EXCEPTION 'builder_favored_enemy_unavailable' USING ERRCODE='22023'; END IF;
  -- Validate every saved branch before deriving any grants. An edit that
  -- repeats a previously selected enemy fails atomically; downlevel prunes
  -- retired source keys and their owned language pins.
  FOR enemy_source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources) LOOP
    key:=enemy_source->>'slug_snapshot'; candidate:=selections->key;
    IF candidate IS NULL THEN CONTINUE; END IF;
    selection:=candidate->'selection';
    valid:=private.builder_exact_keys_v1(candidate,ARRAY['selection','language'])
      AND pg_catalog.jsonb_typeof(selection)='object' AND pg_catalog.jsonb_typeof(candidate->'language') IN ('string','null')
      AND pg_catalog.jsonb_typeof(enemy_source#>'{data_snapshot,favored_enemy,enemy_types}')='array'
      AND pg_catalog.jsonb_typeof(enemy_source#>'{data_snapshot,favored_enemy,humanoid_races}')='array';
    IF valid AND selection->>'mode'='type' THEN
      enemy:=selection->>'enemy_type';
      valid:=private.builder_exact_keys_v1(selection,ARRAY['mode','enemy_type']) AND pg_catalog.jsonb_typeof(selection->'enemy_type')='string'
        AND (enemy_source#>'{data_snapshot,favored_enemy,enemy_types}') @> pg_catalog.jsonb_build_array(enemy);
    ELSIF valid AND selection->>'mode'='humanoids' THEN
      valid:=private.builder_exact_keys_v1(selection,ARRAY['mode','races']) AND pg_catalog.jsonb_typeof(selection->'races')='array';
      IF valid THEN
        valid:=pg_catalog.jsonb_array_length(selection->'races')=2
          AND (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(selection->'races'))=2
          AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selection->'races') r(value)
            WHERE pg_catalog.jsonb_typeof(r.value)<>'string' OR NOT (enemy_source#>'{data_snapshot,favored_enemy,humanoid_races}') @> pg_catalog.jsonb_build_array(r.value));
      END IF;
    ELSE valid:=false; END IF;
    IF valid AND candidate->'language'<>'null'::jsonb THEN
      SELECT v.* INTO language_definition FROM public.content_versions v JOIN public.content_definitions d
        ON d.id=v.content_id AND d.version=v.version WHERE v.system_id_snapshot=(cap.before_parent->>'system_id')::uuid
        AND v.content_type_snapshot='language' AND v.slug_snapshot=candidate->>'language' AND NOT d.is_retired
        AND v.source_snapshot=enemy_source->>'source_snapshot' AND v.scope_snapshot='platform'
        AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
      valid:=FOUND;
    END IF;
    IF valid IS NOT TRUE THEN
      IF key=strict_feature_slug THEN RAISE EXCEPTION 'builder_favored_enemy_unavailable' USING ERRCODE='22023'; END IF;
      CONTINUE;
    END IF;
    duplicate:=CASE selection->>'mode' WHEN 'type' THEN enemy=ANY(seen_types) ELSE
      EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(selection->'races') r(value) WHERE r.value=ANY(seen_races)) END;
    IF duplicate THEN
      IF strict_feature_slug IS NOT NULL THEN RAISE EXCEPTION 'builder_favored_enemy_duplicate' USING ERRCODE='22023'; END IF;
      CONTINUE;
    END IF;
    IF selection->>'mode'='type' THEN seen_types:=array_append(seen_types,enemy);
    ELSE FOR race IN SELECT value FROM pg_catalog.jsonb_array_elements(selection->'races') LOOP seen_races:=array_append(seen_races,race#>>'{}'); END LOOP; END IF;
    normalized:=normalized||pg_catalog.jsonb_build_object(key,candidate);
    IF candidate->'language'<>'null'::jsonb THEN
      pin:=private.builder_catalog_pin_v1(target,pg_catalog.to_jsonb(language_definition),
        pg_catalog.jsonb_build_object('source','favored_enemy','feature_slug',key), 'builder:favored-enemy:'||key,NULL,prior);
      refs:=refs||pg_catalog.jsonb_build_array(pin);
    END IF;
  END LOOP;
  IF normalized<>'{}'::jsonb OR pending_choices ? 'favored_enemies' THEN
    pending_choices:=pg_catalog.jsonb_set(pending_choices,'{favored_enemies}',normalized,true);
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs);
  RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',pg_catalog.jsonb_set(expected,'{refs}',refs));
END $$;

CREATE FUNCTION private.prepare_builder_favored_enemy_command_v1(target uuid,operation uuid,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; next_choices jsonb; compiled jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>'favored_enemy' OR NOT private.builder_exact_keys_v1(fields,ARRAY['feature_slug','selection','language'])
    OR pg_catalog.jsonb_typeof(fields->'feature_slug') IS DISTINCT FROM 'string' OR length(fields->>'feature_slug') NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'builder_favored_enemy_unavailable' USING ERRCODE='22023'; END IF;
  next_choices:=cap.before_parent->'choices';
  next_choices:=pg_catalog.jsonb_set(next_choices,'{favored_enemies}',COALESCE(next_choices->'favored_enemies','{}')||
    pg_catalog.jsonb_build_object(fields->>'feature_slug',fields-'feature_slug'),true);
  compiled:=private.prepare_builder_favored_enemies_v1(target,next_choices,cap.protected_graph,fields->>'feature_slug');
  next_choices:=compiled->'choices';
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=compiled->'graph',expected_classes=next_choices->'classes',
    expected_choices=next_choices,expected_state=cap.before_parent->'state',expected_level=(cap.before_parent->>'level')::integer
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.apply_builder_progression_graph_v1(target,next_choices,cap.before_parent->'state',(cap.before_parent->>'level')::integer);
END $$;

DO $profile$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; next_source text; needle text;
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(
    'private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)');
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  needle:='RETURN pg_catalog.jsonb_build_object(''choices'',pending_choices,''graph'',graph||pg_catalog.jsonb_build_object(''refs'',refs));';
  IF original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR original.proacl::text<>'{postgres=X/postgres}'
    OR pg_catalog.md5(source)<>'9d96150045a09c91a39eec343549964a'
    OR (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_favored_enemy_preimage_changed' USING ERRCODE='42501'; END IF;
  next_source:=pg_catalog.replace(source,needle,
    'RETURN private.prepare_builder_favored_enemies_v1(target,pending_choices,graph||pg_catalog.jsonb_build_object(''refs'',refs),NULL);');
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,next_source);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF repaired.prosrc IS DISTINCT FROM next_source OR repaired.proowner IS DISTINCT FROM original.proowner
    OR repaired.proacl IS DISTINCT FROM original.proacl OR repaired.proconfig IS DISTINCT FROM original.proconfig
    OR repaired.prosecdef IS DISTINCT FROM original.prosecdef OR repaired.provolatile IS DISTINCT FROM original.provolatile THEN
    RAISE EXCEPTION 'builder_favored_enemy_profile_closure_failed' USING ERRCODE='42501'; END IF;
END $profile$;

ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) RENAME TO character_builder_command_before_favored_enemy_v1;
REVOKE ALL ON FUNCTION public.character_builder_command_before_favored_enemy_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; receipt jsonb;
BEGIN
  IF p_request->>'command' IS DISTINCT FROM 'favored_enemy' THEN
    RETURN public.character_builder_command_before_favored_enemy_v1(p_context,p_request);
  END IF;
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb OR pg_catalog.octet_length(p_request::text)>524288
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'operation_id')
    OR pg_catalog.jsonb_typeof(p_request->'fields') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,'favored_enemy',true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,'favored_enemy');
  PERFORM private.prepare_builder_favored_enemy_command_v1(target,operation,p_request->'fields');
  saved:=private.finish_builder_step_v1(p_context,target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command','favored_enemy','fields',p_request->'fields',
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  PERFORM private.lock_builder_character_rows_v1(p_context,target);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;
ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;

ALTER FUNCTION private.prepare_builder_favored_enemies_v1(uuid,jsonb,jsonb,text) OWNER TO postgres;
ALTER FUNCTION private.prepare_builder_favored_enemy_command_v1(uuid,uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.prepare_builder_favored_enemies_v1(uuid,jsonb,jsonb,text),
  private.prepare_builder_favored_enemy_command_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid IN ('private.prepare_builder_favored_enemies_v1(uuid,jsonb,jsonb,text)'::pg_catalog.regprocedure,
        'private.prepare_builder_favored_enemy_command_v1(uuid,uuid,jsonb)'::pg_catalog.regprocedure) AND a.grantee<>p.proowner)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_favored_enemy_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
