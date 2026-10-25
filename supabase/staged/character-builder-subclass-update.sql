-- STAGED ONLY: explicit owner-reviewed Fiend Extra -> Expanded version update.
-- Install after expanded-spells and class-removal. No historical snapshot is
-- rewritten, no class/race/controller is upgraded, and no activation gate opens.
BEGIN;
DO $preflight$
DECLARE dependency record;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.describe_builder_subclass_update_v1(uuid,uuid,integer)') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_expanded_spells_v1(uuid,jsonb,jsonb)') IS NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_class_removal_v1(uuid,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_subclass_update_installation_unavailable' USING ERRCODE='42501'; END IF;
  FOR dependency IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','d55825fd6cf14472f9154a363991b62a'),
    ('private.finish_builder_step_v1(jsonb,uuid)','b8f2a900dde82e63baebc1d2228fa75e'),
    ('public.character_builder_command_v1(jsonb,jsonb)','e596513536422bfe49eb2f9cfbebb160')
  ) wanted(signature,body_md5) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(dependency.signature)
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))=dependency.body_md5
      AND proowner='postgres'::pg_catalog.regrole AND prosecdef AND provolatile='v' AND proconfig=ARRAY['search_path=""']::text[]) THEN
      RAISE EXCEPTION 'builder_subclass_update_dependency_changed' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid=pg_catalog.to_regprocedure(dependency.signature) AND (a.privilege_type<>'EXECUTE'
        OR (dependency.signature LIKE 'private.%' AND a.grantee<>p.proowner)
        OR (dependency.signature LIKE 'public.%' AND a.grantee NOT IN (p.proowner,'authenticated'::pg_catalog.regrole)))) THEN
      RAISE EXCEPTION 'builder_subclass_update_dependency_acl_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $preflight$;

-- Only the new finite updater populates these fields. They are not API inputs
-- or an authority inferred from a role, caller GUC or function signature.
ALTER TABLE private.character_builder_capabilities_v1
  ADD COLUMN correction_operation_id uuid,
  ADD COLUMN correction_preview_digest text,
  ADD COLUMN correction_revision_consumed boolean NOT NULL DEFAULT false;

CREATE FUNCTION private.require_builder_subclass_update_request_v1(request jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE fields jsonb:=request->'fields';
BEGIN
  IF NOT private.builder_exact_keys_v1(request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR request->'contract_version' IS DISTINCT FROM '1'::jsonb OR request->>'command' IS DISTINCT FROM 'update_subclass_version'
    OR pg_catalog.octet_length(request::text)>32768 OR NOT private.builder_uuid_v1(request->>'character_id') OR NOT private.builder_uuid_v1(request->>'operation_id')
    OR NOT private.builder_exact_keys_v1(fields,ARRAY['class_slug','occurrence_id','subclass_ref_id','content_id','expected_content_version','target_content_version','expected_action_revision','preview_digest'])
    OR fields->>'class_slug' IS DISTINCT FROM 'warlock'
    OR NOT private.builder_uuid_v1(fields->>'occurrence_id') OR NOT private.builder_uuid_v1(fields->>'subclass_ref_id') OR NOT private.builder_uuid_v1(fields->>'content_id')
    OR pg_catalog.jsonb_typeof(fields->'expected_content_version') IS DISTINCT FROM 'number' OR pg_catalog.jsonb_typeof(fields->'target_content_version') IS DISTINCT FROM 'number'
    OR COALESCE(fields->>'expected_content_version','') !~ '^[1-9][0-9]{0,9}$' OR COALESCE(fields->>'target_content_version','') !~ '^[1-9][0-9]{0,9}$'
    OR (fields->>'expected_content_version')::numeric>2147483647 OR (fields->>'target_content_version')::numeric>2147483647
    OR (fields->>'target_content_version')::numeric<=(fields->>'expected_content_version')::numeric
    OR pg_catalog.jsonb_typeof(fields->'expected_action_revision') IS DISTINCT FROM 'string' OR COALESCE(fields->>'expected_action_revision','') !~ '^(0|[1-9][0-9]{0,18})$'
    OR (fields->>'expected_action_revision')::numeric>9223372036854775807 OR COALESCE(fields->>'preview_digest','') !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'builder_invalid_subclass_update' USING ERRCODE='22023'; END IF;
END $$;

CREATE FUNCTION private.describe_builder_subclass_update_v1(target uuid,ref_id uuid,target_version integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; old_pin public.character_content_refs%ROWTYPE;
  prior public.content_versions%ROWTYPE; desired public.content_versions%ROWTYPE; occurrence jsonb; graph jsonb;
  old_features jsonb:='[]'; new_features jsonb:='[]'; dependencies jsonb:='[]'; source jsonb; tier jsonb; slug jsonb; dependency jsonb;
  retained jsonb:='[]'; removed jsonb:='[]'; added jsonb:='[]'; fields jsonb; digest_input jsonb; actual jsonb; expected jsonb;
  entry jsonb; class_level integer; known_tiers jsonb;
BEGIN
  SELECT * INTO parent FROM public.characters WHERE id=target;
  IF NOT FOUND OR parent.campaign_id IS NOT NULL OR parent.level NOT BETWEEN 1 AND 20 THEN
    RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  PERFORM private.builder_class_roles_v1(target);
  SELECT * INTO old_pin FROM public.character_content_refs WHERE id=ref_id AND character_id=target;
  IF NOT FOUND THEN RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  SELECT pg_catalog.to_jsonb(o),(c.value->>'level')::integer INTO occurrence,class_level
    FROM private.character_class_occurrences_v1 o
    JOIN LATERAL pg_catalog.jsonb_array_elements(parent.choices->'classes') c(value)
      ON c.value->>'occurrence_id'=o.id::text AND c.value->>'slug'='warlock' AND c.value->>'subclass'='fiend'
    WHERE o.character_id=target AND o.class_slug='warlock' AND o.lifecycle<>'ended' AND o.subclass_ref_id=ref_id;
  IF occurrence IS NULL OR old_pin.context IS DISTINCT FROM '{"source":"subclass","class":"warlock"}'::jsonb
    OR old_pin.choice_source IS DISTINCT FROM 'builder:subclass:'||(occurrence->>'id') OR old_pin.feature_grant_id IS NOT NULL THEN
    RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  SELECT * INTO prior FROM public.content_versions WHERE content_id=old_pin.content_id AND version=old_pin.content_version FOR SHARE;
  SELECT v.* INTO desired FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id AND d.version=v.version
    WHERE v.content_id=old_pin.content_id AND v.version=target_version AND NOT d.is_retired FOR SHARE OF v,d;
  IF prior.content_id IS NULL OR desired.content_id IS NULL OR target_version<=old_pin.content_version
    OR prior.system_id_snapshot IS DISTINCT FROM parent.system_id OR desired.system_id_snapshot IS DISTINCT FROM parent.system_id
    OR prior.content_type_snapshot<>'subclass' OR desired.content_type_snapshot<>'subclass'
    OR prior.slug_snapshot<>'fiend' OR desired.slug_snapshot<>'fiend'
    OR prior.source_snapshot<>'srd' OR desired.source_snapshot<>'srd'
    OR prior.scope_snapshot<>'platform' OR desired.scope_snapshot<>'platform'
    OR prior.owner_id_snapshot IS NOT NULL OR desired.owner_id_snapshot IS NOT NULL
    OR prior.name_snapshot IS DISTINCT FROM desired.name_snapshot OR prior.effects_snapshot IS DISTINCT FROM desired.effects_snapshot
    OR prior.data_snapshot->>'parent_class' IS DISTINCT FROM 'warlock'
    OR desired.data_snapshot->>'parent_class' IS DISTINCT FROM 'warlock'
    OR NOT prior.data_snapshot ? 'spellcastingExtra' OR prior.data_snapshot ? 'spellcastingExpanded'
    OR NOT desired.data_snapshot ? 'spellcastingExpanded' OR desired.data_snapshot ? 'spellcastingExtra'
    OR (prior.data_snapshot-'spellcastingExtra') IS DISTINCT FROM (desired.data_snapshot-'spellcastingExpanded')
    OR prior.data_snapshot->'spellcastingExtra' IS DISTINCT FROM desired.data_snapshot->'spellcastingExpanded'
    OR NOT private.character_can_access_content_version(target,prior.content_id,prior.version)
    OR NOT private.character_can_access_content_version(target,desired.content_id,desired.version) THEN
    RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  -- This first correction has a reviewed finite semantic delta, not a slug-
  -- based compatibility exception for arbitrary historical content.
  known_tiers:='[{"level":1,"spells":["burning-hands","command"]},{"level":3,"spells":["blindness-deafness","scorching-ray"]},{"level":5,"spells":["fireball","stinking-cloud"]},{"level":7,"spells":["fire-shield","wall-of-fire"]},{"level":9,"spells":["flame-strike","hallow"]}]';
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('level',t.value->'level','spells',
    (SELECT pg_catalog.jsonb_agg(s.value ORDER BY s.value#>>'{}') FROM pg_catalog.jsonb_array_elements(t.value->'spells') s(value)))
    ORDER BY (t.value->>'level')::integer),'[]') INTO expected FROM pg_catalog.jsonb_array_elements(known_tiers) t(value);
  IF pg_catalog.jsonb_typeof(prior.data_snapshot->'spellcastingExtra') IS DISTINCT FROM 'array' THEN
    RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('level',t.value->'level','spells',
    (SELECT pg_catalog.jsonb_agg(s.value ORDER BY s.value#>>'{}') FROM pg_catalog.jsonb_array_elements(t.value->'spells') s(value)))
    ORDER BY (t.value->>'level')::integer),'[]') INTO actual FROM pg_catalog.jsonb_array_elements(prior.data_snapshot->'spellcastingExtra') t(value);
  IF actual IS DISTINCT FROM expected THEN RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  graph:=private.builder_progression_full_graph_v1(target);
  -- A newer controller timestamp can select different child versions. Bind
  -- both complete closures, and refuse feature upgrades in this first slice.
  FOREACH source IN ARRAY ARRAY[pg_catalog.to_jsonb(prior),pg_catalog.to_jsonb(desired)] LOOP
    actual:='[]';
    FOR tier IN SELECT value FROM pg_catalog.jsonb_array_elements(source#>'{data_snapshot,levels}') ORDER BY (value->>'level')::integer LOOP
      FOR slug IN SELECT value FROM pg_catalog.jsonb_array_elements(tier->'features') ORDER BY value#>>'{}' LOOP
        dependency:=private.builder_catalog_dependency_v1(target,source,'feature',slug#>>'{}');
        IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(dependency->'effects_snapshot') e(value) WHERE e.value->>'type'='choice')
          OR dependency#>'{data_snapshot,bonus_spells}' IS NOT NULL THEN
          RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
        actual:=actual||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('level',tier->'level','snapshot',dependency));
      END LOOP;
    END LOOP;
    IF source->'version'=pg_catalog.to_jsonb(prior.version) THEN old_features:=actual; ELSE new_features:=actual; END IF;
    FOR tier IN SELECT value FROM pg_catalog.jsonb_array_elements(prior.data_snapshot->'spellcastingExtra') ORDER BY (value->>'level')::integer LOOP
      FOR slug IN SELECT value FROM pg_catalog.jsonb_array_elements(tier->'spells') ORDER BY value#>>'{}' LOOP
        dependency:=private.builder_catalog_dependency_v1(target,source,'spell',slug#>>'{}');
        dependencies:=dependencies||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('controller_version',source->'version',
          'level',tier->'level','snapshot',dependency));
        IF source->'version'=pg_catalog.to_jsonb(desired.version) AND (tier->>'level')::integer<=class_level THEN
          added:=added||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind','expanded_spell','label',dependency->>'name_snapshot'));
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF old_features IS DISTINCT FROM new_features OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(prior.effects_snapshot) e(value) WHERE e.value->>'type'='choice') THEN
    RETURN '{"status":"unavailable","reason":"unavailable"}'::jsonb; END IF;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(old_features) LOOP
    retained:=retained||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind','feature','label',entry#>>'{snapshot,name_snapshot}'));
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(graph->'spells') WHERE value->>'source'='selection' LOOP
    retained:=retained||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind','ordinary_spell','label',entry->>'name'));
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(graph->'spell_grants') WHERE value->>'controller_ref_id'=ref_id::text LOOP
    removed:=removed||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind','spell_grant','label',entry->>'spell_name'));
  END LOOP;
  retained:=retained||'[{"kind":"choice","label":"Existing class, invocation, ASI and spell choices"},{"kind":"invariant","label":"Class origins, levels, HP rolls, inventory and equipment awards"}]'::jsonb;
  fields:=pg_catalog.jsonb_build_object('class_slug','warlock','occurrence_id',occurrence->'id','subclass_ref_id',ref_id,
    'content_id',old_pin.content_id,'expected_content_version',old_pin.content_version,'target_content_version',target_version,
    'expected_action_revision',parent.action_revision::text);
  -- Bind the parent mechanics reviewed here. Metadata-only edits do not advance
  -- action_revision or change these consequences, and must not strand an exact
  -- retained intent. The commit still captures/preserves the fresh whole parent.
  digest_input:=pg_catalog.jsonb_build_object('contract_version',1,'parent',pg_catalog.jsonb_build_object(
    'id',parent.id,'user_id',parent.user_id,'system_id',parent.system_id,'campaign_id',parent.campaign_id,
    'archived',parent.archived,'level',parent.level,'choices',parent.choices,'state',parent.state,
    'base_stats',parent.base_stats,'action_revision',parent.action_revision),'graph',graph,
    'order',(SELECT pg_catalog.to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=target),
    'old_snapshot',pg_catalog.to_jsonb(prior),'target_snapshot',pg_catalog.to_jsonb(desired),
    'old_features',old_features,'target_features',new_features,'spell_dependencies',dependencies,'fields',fields,
    'retained',retained,'removed',removed,'added',added);
  fields:=fields||pg_catalog.jsonb_build_object('preview_digest',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(digest_input::text,'UTF8')),'hex'));
  RETURN pg_catalog.jsonb_build_object('status','available','preview',pg_catalog.jsonb_build_object('contract_version',1,
    'character_id',target,'actor_id',parent.user_id,'fields',fields,'saved_name',prior.name_snapshot,'target_name',desired.name_snapshot,
    'retained',retained,'removed',removed,'added',added,'automatic_spells_learned',0));
END $$;

CREATE FUNCTION public.character_builder_subclass_update_preview_v1(p_context jsonb,p_character_id uuid,p_subclass_ref_id uuid,p_target_content_version integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM private.begin_builder_step_v1(p_context,p_character_id,'preview_subclass_update',true);
  result:=private.describe_builder_subclass_update_v1(p_character_id,p_subclass_ref_id,p_target_content_version);
  PERFORM private.lock_builder_character_rows_v1(p_context,p_character_id);
  RETURN result;
END $$;

-- Terminal only for this exact original intent: under the current owner/session
-- guard, an observed larger database-controlled revision makes its old expected
-- revision permanently invalid. This does not cancel/reserve the UUID itself.
CREATE FUNCTION public.character_builder_subclass_update_resolution_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; stored private.character_builder_receipts_v1%ROWTYPE;
  target uuid; operation uuid; expected bigint;
BEGIN
  PERFORM private.require_builder_subclass_update_request_v1(p_request);
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,'resolve_subclass_update',true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','recorded','receipt',stored.receipt);
  END IF;
  expected:=(p_request#>>'{fields,expected_action_revision}')::bigint;
  IF expected<parent.action_revision THEN
    PERFORM private.builder_class_roles_v1(target);
    IF NOT EXISTS(SELECT 1 FROM private.character_projection_order_v1 WHERE character_id=target AND producer_revision=parent.action_revision) THEN
      RAISE EXCEPTION 'builder_order_unavailable' USING ERRCODE='23514'; END IF;
    PERFORM private.lock_builder_character_rows_v1(p_context,target);
    RETURN pg_catalog.jsonb_build_object('status','rejected','rejection',pg_catalog.jsonb_build_object('actor_id',parent.user_id,
      'character_id',target,'operation_id',operation,'command','update_subclass_version','fields',p_request->'fields',
      'reason','stale_review','observed_action_revision',parent.action_revision::text));
  END IF;
  RETURN '{"status":"absent"}'::jsonb;
END $$;

-- A root-version-only change leaves parent choices identical. This finite
-- bridge asks the EXISTING native revision trigger to take its normal +1 path.
CREATE FUNCTION private.builder_subclass_update_revision_v1(before_row jsonb,after_row jsonb) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; old_occurrence jsonb; new_occurrence jsonb; old_pin jsonb; new_pin jsonb;
  old_snapshot jsonb; new_snapshot jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id()
    AND character_id=(before_row->>'id')::uuid AND correction_operation_id IS NOT NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,cap.character_id);
  IF cap.command<>'select_subclass' OR cap.correction_revision_consumed OR COALESCE(cap.correction_preview_digest,'') !~ '^[a-f0-9]{64}$'
    OR cap.before_parent IS DISTINCT FROM before_row OR before_row IS DISTINCT FROM after_row
    OR cap.expected_choices IS DISTINCT FROM before_row->'choices' OR cap.expected_classes IS DISTINCT FROM before_row#>'{choices,classes}' THEN
    RAISE EXCEPTION 'builder_subclass_update_revision_invalid' USING ERRCODE='23514'; END IF;
  SELECT o.value INTO old_occurrence FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'occurrences') o(value)
    WHERE o.value->>'class_slug'='warlock' AND o.value->>'lifecycle'<>'ended';
  SELECT o.value INTO new_occurrence FROM pg_catalog.jsonb_array_elements(cap.expected_graph->'occurrences') o(value) WHERE o.value->'id'=old_occurrence->'id';
  SELECT r.value INTO old_pin FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') r(value) WHERE r.value->'id'=old_occurrence->'subclass_ref_id';
  SELECT r.value INTO new_pin FROM pg_catalog.jsonb_array_elements(cap.expected_graph->'refs') r(value) WHERE r.value->'id'=new_occurrence->'subclass_ref_id';
  IF old_occurrence IS NULL OR new_occurrence IS NULL OR old_pin IS NULL OR new_pin IS NULL
    OR (old_occurrence-'subclass_ref_id') IS DISTINCT FROM (new_occurrence-'subclass_ref_id')
    OR old_pin->'id'=new_pin->'id' OR old_pin->'content_id' IS DISTINCT FROM new_pin->'content_id'
    OR old_pin->'context' IS DISTINCT FROM '{"source":"subclass","class":"warlock"}'::jsonb
    OR old_pin->'context' IS DISTINCT FROM new_pin->'context' OR old_pin->'choice_source' IS DISTINCT FROM new_pin->'choice_source'
    OR (new_pin->>'content_version')::integer<=(old_pin->>'content_version')::integer THEN
    RAISE EXCEPTION 'builder_subclass_update_revision_invalid' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.to_jsonb(v) INTO old_snapshot FROM public.content_versions v
    WHERE v.content_id=(old_pin->>'content_id')::uuid AND v.version=(old_pin->>'content_version')::integer
      AND v.content_type_snapshot='subclass' AND v.slug_snapshot='fiend' AND v.source_snapshot='srd'
      AND v.scope_snapshot='platform' AND v.owner_id_snapshot IS NULL AND v.system_id_snapshot=(before_row->>'system_id')::uuid;
  SELECT pg_catalog.to_jsonb(v) INTO new_snapshot FROM public.content_versions v
    WHERE v.content_id=(new_pin->>'content_id')::uuid AND v.version=(new_pin->>'content_version')::integer
      AND v.content_type_snapshot='subclass' AND v.slug_snapshot='fiend' AND v.source_snapshot='srd'
      AND v.scope_snapshot='platform' AND v.owner_id_snapshot IS NULL AND v.system_id_snapshot=(before_row->>'system_id')::uuid;
  IF old_snapshot IS NULL OR new_snapshot IS NULL OR old_snapshot->'effects_snapshot' IS DISTINCT FROM new_snapshot->'effects_snapshot'
    OR old_snapshot#>'{data_snapshot,spellcastingExtra}' IS NULL OR new_snapshot#>'{data_snapshot,spellcastingExpanded}' IS NULL
    OR old_snapshot#>'{data_snapshot,spellcastingExtra}' IS DISTINCT FROM new_snapshot#>'{data_snapshot,spellcastingExpanded}'
    OR ((old_snapshot->'data_snapshot')-'spellcastingExtra') IS DISTINCT FROM ((new_snapshot->'data_snapshot')-'spellcastingExpanded') THEN
    RAISE EXCEPTION 'builder_subclass_update_revision_invalid' USING ERRCODE='23514'; END IF;
  UPDATE private.character_builder_capabilities_v1 SET correction_revision_consumed=true
    WHERE transaction_id=cap.transaction_id AND character_id=cap.character_id;
  RETURN true;
END $$;

DO $revision_profile$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text; needle text;
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid='private.hit_die_character_revision_v1()'::pg_catalog.regprocedure;
  IF original.proowner<>'inkborne_hit_die_authority_owner'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(original.proacl,pg_catalog.acldefault('f',original.proowner))) a
      WHERE a.grantee<>original.proowner OR a.privilege_type<>'EXECUTE')
    OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>'2daf275513b60cc98818f07a7e982946' THEN
    RAISE EXCEPTION 'builder_subclass_revision_preimage_changed' USING ERRCODE='42501'; END IF;
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  needle:='IS DISTINCT FROM (OLD.state,OLD.base_stats,OLD.choices,OLD.level,OLD.system_id,OLD.campaign_id,OLD.archived,OLD.user_id) THEN';
  IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'builder_subclass_revision_fragment_changed' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(source,needle,'IS DISTINCT FROM (OLD.state,OLD.base_stats,OLD.choices,OLD.level,OLD.system_id,OLD.campaign_id,OLD.archived,OLD.user_id)'||
    ' OR private.builder_subclass_update_revision_v1(pg_catalog.to_jsonb(OLD),pg_catalog.to_jsonb(NEW)) THEN');
  IF pg_catalog.md5(replacement)<>'857950f1a88305838220494f068e5cf5' THEN
    RAISE EXCEPTION 'builder_subclass_revision_postimage_changed' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF repaired.prosrc IS DISTINCT FROM replacement OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
    OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef OR repaired.provolatile IS DISTINCT FROM original.provolatile THEN
    RAISE EXCEPTION 'builder_subclass_revision_profile_changed' USING ERRCODE='42501'; END IF;
END $revision_profile$;

ALTER TABLE private.character_builder_progression_history_v1 DROP CONSTRAINT character_builder_progression_history_v1_command_check;
ALTER TABLE private.character_builder_progression_history_v1 ADD CONSTRAINT character_builder_progression_history_v1_command_check
  CHECK(command IN ('add_class','remove_class','set_class_level','save_hp_roll','select_asi','select_class_spells','update_subclass_version'));

ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) RENAME TO character_builder_command_before_subclass_update_v1;
REVOKE ALL ON FUNCTION public.character_builder_command_before_subclass_update_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; fields jsonb; preview jsonb; receipt jsonb; before_graph jsonb; after_graph jsonb;
  before_order jsonb; after_order jsonb; old_ref uuid; new_ref uuid; old_features uuid[]; new_features uuid[]; old_grants uuid[]; new_grants uuid[];
  domain text; prior_rows jsonb; next_rows jsonb;
BEGIN
  IF p_request->>'command' IS DISTINCT FROM 'update_subclass_version' THEN RETURN public.character_builder_command_before_subclass_update_v1(p_context,p_request); END IF;
  fields:=p_request->'fields';
  PERFORM private.require_builder_subclass_update_request_v1(p_request);
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,'update_subclass_version',true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  IF (fields->>'expected_action_revision')::bigint<parent.action_revision THEN
    RETURN public.character_builder_subclass_update_resolution_v1(p_context,p_request); END IF;
  IF parent.action_revision::text IS DISTINCT FROM fields->>'expected_action_revision' THEN RAISE EXCEPTION 'builder_stale_action_revision' USING ERRCODE='22023'; END IF;
  preview:=private.describe_builder_subclass_update_v1(target,(fields->>'subclass_ref_id')::uuid,(fields->>'target_content_version')::integer);
  IF preview->>'status' IS DISTINCT FROM 'available' OR preview#>'{preview,fields}' IS DISTINCT FROM fields THEN
    RAISE EXCEPTION 'builder_subclass_update_preview_changed' USING ERRCODE='22023'; END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,'select_subclass');
  UPDATE private.character_builder_capabilities_v1 SET correction_operation_id=operation,correction_preview_digest=fields->>'preview_digest'
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  before_graph:=private.builder_progression_full_graph_v1(target);
  SELECT c.before_order INTO before_order FROM private.character_builder_capabilities_v1 c WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  old_ref:=(fields->>'subclass_ref_id')::uuid;
  SELECT COALESCE(array_agg((value->>'id')::uuid),'{}') INTO old_features FROM pg_catalog.jsonb_array_elements(before_graph->'feature_grants') WHERE value->>'controller_ref_id'=old_ref::text;
  SELECT COALESCE(array_agg((value->>'id')::uuid),'{}') INTO old_grants FROM pg_catalog.jsonb_array_elements(before_graph->'spell_grants') WHERE value->>'controller_ref_id'=old_ref::text;
  PERFORM private.apply_builder_catalog_command_v1(target,'select_subclass',pg_catalog.jsonb_build_object('class_slug','warlock','content_id',fields->'content_id','content_version',fields->'target_content_version'));
  IF NOT EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target AND correction_revision_consumed) THEN
    RAISE EXCEPTION 'builder_subclass_update_revision_missing' USING ERRCODE='23514'; END IF;
  saved:=private.finish_builder_step_v1(p_context,target);
  after_graph:=private.builder_progression_full_graph_v1(target);
  SELECT subclass_ref_id INTO new_ref FROM private.character_class_occurrences_v1 WHERE id=(fields->>'occurrence_id')::uuid AND character_id=target;
  SELECT COALESCE(array_agg((value->>'id')::uuid),'{}') INTO new_features FROM pg_catalog.jsonb_array_elements(after_graph->'feature_grants') WHERE value->>'controller_ref_id'=new_ref::text;
  SELECT COALESCE(array_agg((value->>'id')::uuid),'{}') INTO new_grants FROM pg_catalog.jsonb_array_elements(after_graph->'spell_grants') WHERE value->>'controller_ref_id'=new_ref::text;
  IF saved.choices IS DISTINCT FROM parent.choices OR saved.base_stats IS DISTINCT FROM parent.base_stats OR saved.state IS DISTINCT FROM parent.state
    OR saved.level IS DISTINCT FROM parent.level OR saved.action_revision<>parent.action_revision+1 OR new_ref IS NULL OR new_ref=old_ref
    OR new_grants<>'{}'::uuid[] OR after_graph->'origin' IS DISTINCT FROM before_graph->'origin' OR after_graph->'commands' IS DISTINCT FROM before_graph->'commands'
    OR (SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN value->>'id'=fields->>'occurrence_id' THEN value-'subclass_ref_id' ELSE value END ORDER BY value->>'id'),'[]') FROM pg_catalog.jsonb_array_elements(before_graph->'occurrences'))
      IS DISTINCT FROM (SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN value->>'id'=fields->>'occurrence_id' THEN value-'subclass_ref_id' ELSE value END ORDER BY value->>'id'),'[]') FROM pg_catalog.jsonb_array_elements(after_graph->'occurrences')) THEN
    RAISE EXCEPTION 'builder_subclass_update_preservation_failed' USING ERRCODE='23514'; END IF;
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','inventory'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY value->>'id'),'[]') INTO prior_rows FROM pg_catalog.jsonb_array_elements(before_graph->domain)
      WHERE CASE domain WHEN 'refs' THEN value->>'id'<>old_ref::text AND NOT COALESCE((value->>'feature_grant_id')::uuid=ANY(old_features),false)
        WHEN 'feature_grants' THEN NOT (value->>'id')::uuid=ANY(old_features)
        WHEN 'spell_grants' THEN NOT (value->>'id')::uuid=ANY(old_grants)
        WHEN 'spells' THEN NOT COALESCE((value->>'spell_grant_id')::uuid=ANY(old_grants),false) ELSE true END;
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY value->>'id'),'[]') INTO next_rows FROM pg_catalog.jsonb_array_elements(after_graph->domain)
      WHERE CASE domain WHEN 'refs' THEN value->>'id'<>new_ref::text AND NOT COALESCE((value->>'feature_grant_id')::uuid=ANY(new_features),false)
        WHEN 'feature_grants' THEN NOT (value->>'id')::uuid=ANY(new_features)
        WHEN 'spell_grants' THEN NOT (value->>'id')::uuid=ANY(new_grants) ELSE true END;
    IF prior_rows IS DISTINCT FROM next_rows THEN RAISE EXCEPTION 'builder_subclass_update_preservation_failed' USING ERRCODE='23514'; END IF;
  END LOOP;
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command','update_subclass_version','fields',fields,
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1 VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  SELECT pg_catalog.to_jsonb(o) INTO after_order FROM private.character_projection_order_v1 o WHERE character_id=target;
  INSERT INTO private.character_builder_progression_history_v1(actor_id,operation_id,character_id,command,before_parent,after_parent,before_graph,after_graph,before_order,after_order,receipt,created_at)
    VALUES(parent.user_id,operation,target,'update_subclass_version',pg_catalog.to_jsonb(parent),pg_catalog.to_jsonb(saved),before_graph,after_graph,before_order,after_order,receipt,pg_catalog.transaction_timestamp());
  PERFORM private.lock_builder_character_rows_v1(p_context,target);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;

ALTER FUNCTION private.describe_builder_subclass_update_v1(uuid,uuid,integer) OWNER TO postgres;
ALTER FUNCTION private.require_builder_subclass_update_request_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION private.builder_subclass_update_revision_v1(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer) OWNER TO postgres;
ALTER FUNCTION public.character_builder_subclass_update_resolution_v1(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.describe_builder_subclass_update_v1(uuid,uuid,integer),private.require_builder_subclass_update_request_v1(jsonb),private.builder_subclass_update_revision_v1(jsonb,jsonb),
  public.character_builder_subclass_update_resolution_v1(jsonb,jsonb),
  public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer),public.character_builder_command_v1(jsonb,jsonb)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.builder_subclass_update_revision_v1(jsonb,jsonb) TO inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer),public.character_builder_subclass_update_resolution_v1(jsonb,jsonb),public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE') OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_subclass_update_preview_v1(jsonb,uuid,uuid,integer)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_subclass_update_resolution_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_subclass_update_resolution_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','private.describe_builder_subclass_update_v1(uuid,uuid,integer)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','private.builder_subclass_update_revision_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_subclass_update_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
NOTIFY pgrst,'reload schema';
COMMIT;
