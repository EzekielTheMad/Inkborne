-- Local staged SRD catalog continuation. Install AFTER character-builder-steps.sql.
-- No general writer/readiness gate, legacy service private-schema access, class
-- history rewrite, or hosted migration is enabled by this source.
BEGIN;

DO $preflight$
DECLARE dependency record;
BEGIN
  IF CURRENT_USER <> 'supabase_admin'
    OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('public.character_builder_command_v1(jsonb,jsonb)') IS NULL
    OR pg_catalog.to_regprocedure('private.finish_builder_step_v1(jsonb,uuid)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1) THEN
    RAISE EXCEPTION 'builder_catalog_installation_unavailable' USING ERRCODE='42501';
  END IF;
  FOR dependency IN SELECT * FROM (VALUES
    ('public.character_builder_command_v1(jsonb,jsonb)','2afef22d9ed582b85c56d7ad4735e7c7'),
    ('private.builder_protected_graph_v1(uuid)','dd2455e0e736dd55dfff29145dda3a9d'),
    ('private.first_class_materialization_inputs_v1(uuid,text)','29227ef7311e3f03307733ac87168748'),
    ('private.finish_builder_step_v1(jsonb,uuid)','7542abfcc4c00534615f18f9b6b17548'),
    ('private.mint_builder_step_v1(jsonb,public.characters,text)','fa7ccd47be95f3120774102645ec8e0d'),
    ('private.materialize_feature_grants_for_ref(uuid)','055ac79e49f2b3538f88e970f14d278c'),
    ('private.materialize_spell_grants_for_ref(uuid)','d56f97321309287c664f7ff712f34524')
  ) wanted(signature,body_md5) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(dependency.signature)
      AND pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n'))=dependency.body_md5
      AND p.proconfig=ARRAY['search_path=""']::text[] AND p.proowner='postgres'::pg_catalog.regrole::oid) THEN
      RAISE EXCEPTION 'builder_catalog_dependency_drift' USING ERRCODE='42501'; END IF;
  END LOOP;
END $preflight$;

ALTER TABLE private.character_builder_capabilities_v1
  ADD COLUMN expected_graph jsonb NOT NULL,
  ADD COLUMN expected_classes jsonb NOT NULL,
  ADD COLUMN expected_name text NOT NULL;

-- Retained rows must exist unchanged throughout the operation. Every changing
-- row must be exactly a sealed before/after row, including its allocated ID.
-- Final closure additionally requires the complete after graph. A caller never
-- supplies this graph: the catalog compiler below derives it from exact pins.
CREATE FUNCTION private.assert_builder_catalog_graph_v1(target uuid,complete boolean) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; actual jsonb; domain text;
  classes jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT choices->'classes' INTO classes FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  actual:=private.builder_protected_graph_v1(target);
  IF actual->'origin' IS DISTINCT FROM cap.protected_graph->'origin'
    OR actual->'commands' IS DISTINCT FROM cap.protected_graph->'commands'
    OR (classes IS DISTINCT FROM cap.before_parent->'choices'->'classes'
      AND classes IS DISTINCT FROM cap.expected_classes) THEN
    RAISE EXCEPTION 'builder_protected_class_changed' USING ERRCODE='23514'; END IF;
  IF complete THEN
    IF actual IS DISTINCT FROM cap.expected_graph OR classes IS DISTINCT FROM cap.expected_classes THEN
      RAISE EXCEPTION 'builder_catalog_graph_incomplete' USING ERRCODE='23514'; END IF;
    RETURN;
  END IF;
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(actual->domain) a(value)
      WHERE NOT (cap.protected_graph->domain) @> pg_catalog.jsonb_build_array(a.value)
        AND NOT (cap.expected_graph->domain) @> pg_catalog.jsonb_build_array(a.value))
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.protected_graph->domain) old(value)
        WHERE (cap.expected_graph->domain) @> pg_catalog.jsonb_build_array(old.value)
          AND NOT (actual->domain) @> pg_catalog.jsonb_build_array(old.value)) THEN
      RAISE EXCEPTION 'builder_catalog_unplanned_row' USING ERRCODE='23514'; END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.mint_builder_step_v1(context jsonb,parent public.characters,command text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ordering jsonb; protected jsonb;
BEGIN
  IF parent.campaign_id IS NOT NULL OR parent.level<>1
    OR NOT EXISTS(SELECT 1 FROM private.character_class_origin_v1 o WHERE o.character_id=parent.id AND o.creation_provenance='new_character' AND o.command_revision=1
      AND EXISTS(SELECT 1 FROM private.character_creation_commands_v1 c WHERE c.target_character_id=parent.id AND c.operation_id=o.creation_operation_id
        AND c.receipt->>'verified_actor_id'=parent.user_id::text AND c.receipt->>'receipt_kind'='bootstrap_new'))
    OR (SELECT count(*) FROM private.character_class_commands_v1 c WHERE c.character_id=parent.id)<>1
    OR NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1 c WHERE c.character_id=parent.id AND c.receipt#>>'{canonical_intent,command}'='add_class'
      AND c.receipt->>'verified_actor_id'=parent.user_id::text AND c.receipt->>'after_class_revision'='1') THEN
    RAISE EXCEPTION 'builder_genuine_first_class_required' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.to_jsonb(o) INTO ordering FROM private.character_projection_order_v1 o WHERE character_id=parent.id;
  IF ordering IS NULL OR (ordering->>'producer_revision')::bigint<>parent.action_revision THEN
    RAISE EXCEPTION 'builder_order_unavailable' USING ERRCODE='23514'; END IF;
  protected:=private.builder_protected_graph_v1(parent.id);
  INSERT INTO private.character_builder_capabilities_v1(transaction_id,character_id,actor_id,command,context,before_parent,before_order,protected_graph,before_inventory,expected_graph,expected_classes,expected_name)
  VALUES(pg_catalog.pg_current_xact_id(),parent.id,parent.user_id,command,context,pg_catalog.to_jsonb(parent),ordering,protected,
    (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=parent.id),
    protected,parent.choices->'classes',parent.name);
END $$;

CREATE FUNCTION private.apply_builder_details_v1(target uuid,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; next_choices jsonb; chosen_name text; alignment text;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>'save_details' THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  IF NOT private.builder_exact_keys_v1(fields,ARRAY['name','alignment']) OR pg_catalog.jsonb_typeof(fields->'name')<>'string'
    OR length(pg_catalog.btrim(fields->>'name')) NOT BETWEEN 1 AND 100
    OR pg_catalog.jsonb_typeof(fields->'alignment') NOT IN ('string','null')
    OR (fields->'alignment'<>'null'::jsonb AND length(pg_catalog.btrim(fields->>'alignment')) NOT BETWEEN 1 AND 100) THEN
    RAISE EXCEPTION 'builder_invalid_details' USING ERRCODE='22023'; END IF;
  chosen_name:=pg_catalog.btrim(fields->>'name'); alignment:=pg_catalog.btrim(fields->>'alignment');
  next_choices:=pg_catalog.jsonb_set(cap.before_parent->'choices','{details_confirmed}','true'::jsonb,true);
  IF alignment IS NULL THEN next_choices:=next_choices-'alignment';
  ELSE next_choices:=pg_catalog.jsonb_set(next_choices,'{alignment}',pg_catalog.to_jsonb(alignment),true); END IF;
  UPDATE private.character_builder_capabilities_v1 SET expected_name=chosen_name
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  UPDATE public.characters SET name=chosen_name,choices=next_choices WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION private.first_class_materialization_inputs_v1(p_target uuid,p_phase text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=p_target) THEN
    IF p_phase IS NULL OR p_phase NOT IN ('grants','active','prune') THEN
      RAISE EXCEPTION 'builder_capability_unavailable' USING ERRCODE='42501'; END IF;
    PERFORM private.assert_builder_catalog_graph_v1(p_target,false);
    RETURN NULL;
  END IF;
  RETURN private.first_class_materialization_inputs_before_builder_v1(p_target,p_phase);
END $$;

-- During a sealed builder projection, all manifest rows are inserted explicitly
-- from the finite plan. Preserve complete B2/ordinary bodies outside this route.
ALTER FUNCTION private.materialize_feature_grants_for_ref(uuid) RENAME TO materialize_feature_grants_before_builder_catalog_v1;
ALTER FUNCTION private.materialize_spell_grants_for_ref(uuid) RENAME TO materialize_spell_grants_before_builder_catalog_v1;
CREATE FUNCTION private.materialize_feature_grants_for_ref(target_ref_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
  SELECT character_id INTO target FROM public.character_content_refs WHERE id=target_ref_id;
  IF EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target) THEN
    PERFORM private.assert_builder_catalog_graph_v1(target,false); RETURN;
  END IF;
  PERFORM private.materialize_feature_grants_before_builder_catalog_v1(target_ref_id);
END $$;
CREATE FUNCTION private.materialize_spell_grants_for_ref(target_ref_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
  SELECT character_id INTO target FROM public.character_content_refs WHERE id=target_ref_id;
  IF EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target) THEN
    PERFORM private.assert_builder_catalog_graph_v1(target,false); RETURN;
  END IF;
  PERFORM private.materialize_spell_grants_before_builder_catalog_v1(target_ref_id);
END $$;

CREATE FUNCTION private.builder_catalog_dependency_v1(target uuid,controller jsonb,wanted_type text,wanted_slug text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE found_version public.content_versions%ROWTYPE;
BEGIN
  IF wanted_type NOT IN ('trait','feature','spell') OR wanted_slug IS NULL OR length(wanted_slug) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'builder_dependency_unavailable' USING ERRCODE='22023'; END IF;
  SELECT candidate.* INTO found_version FROM public.content_versions candidate
    WHERE candidate.system_id_snapshot=(controller->>'system_id_snapshot')::uuid
      AND candidate.content_type_snapshot=wanted_type AND candidate.slug_snapshot=wanted_slug
      AND candidate.created_at<=(controller->>'created_at')::timestamptz
      AND ((controller->>'source_snapshot'='srd' AND candidate.source_snapshot='srd' AND candidate.scope_snapshot='platform')
        OR (controller->>'source_snapshot'='homebrew' AND
          (candidate.owner_id_snapshot IS NOT DISTINCT FROM (controller->>'owner_id_snapshot')::uuid OR candidate.scope_snapshot='platform')))
      AND private.character_can_access_content_version(target,candidate.content_id,candidate.version)
    ORDER BY (candidate.owner_id_snapshot IS NOT DISTINCT FROM (controller->>'owner_id_snapshot')::uuid) DESC,
      (candidate.scope_snapshot='platform') DESC,candidate.created_at DESC,candidate.version DESC,candidate.content_id
    LIMIT 1 FOR SHARE OF candidate;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_dependency_unavailable' USING ERRCODE='23503'; END IF;
  RETURN pg_catalog.to_jsonb(found_version);
END $$;

CREATE FUNCTION private.builder_catalog_pin_v1(target uuid,definition jsonb,context jsonb,choice_source text,grant_id uuid,prior jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE pin public.character_content_refs%ROWTYPE;
BEGIN
  SELECT (pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,p.value)).* INTO pin
    FROM pg_catalog.jsonb_array_elements(prior) p(value)
    WHERE p.value->>'character_id'=target::text AND p.value->>'content_id'=definition->>'content_id'
      AND p.value->'content_version'=definition->'version' AND p.value->'context'=context
      AND p.value->>'choice_source' IS NOT DISTINCT FROM choice_source
      AND p.value->>'feature_grant_id' IS NOT DISTINCT FROM grant_id::text LIMIT 1;
  IF NOT FOUND THEN
    pin.id:=pg_catalog.gen_random_uuid(); pin.character_id:=target;
    pin.content_id:=(definition->>'content_id')::uuid; pin.content_version:=(definition->>'version')::integer;
    pin.context:=context; pin.choice_source:=choice_source; pin.feature_grant_id:=grant_id;
    pin.created_at:=pg_catalog.transaction_timestamp();
  END IF;
  RETURN pg_catalog.to_jsonb(pin);
END $$;

-- Existing occurrence lifecycle/history stays immutable. The only additional
-- transition is the exact sealed subclass_ref_id replacement on the same
-- provisional first occurrence; all its other columns are unchanged.
CREATE FUNCTION private.builder_catalog_occurrence_transition_v1(before_row jsonb,after_row jsonb) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=(before_row->>'character_id')::uuid;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,cap.character_id);
  RETURN cap.command='select_subclass' AND before_row IS NOT NULL AND after_row IS NOT NULL
    AND before_row->>'lifecycle'='provisional' AND (before_row-'subclass_ref_id')=(after_row-'subclass_ref_id')
    AND (cap.protected_graph->'occurrences') @> pg_catalog.jsonb_build_array(before_row)
    AND (cap.expected_graph->'occurrences') @> pg_catalog.jsonb_build_array(after_row);
END $$;

DO $occurrence_guard$
DECLARE original text; replacement text;
BEGIN
  SELECT pg_catalog.replace(prosrc,E'\r\n',E'\n') INTO original FROM pg_catalog.pg_proc
    WHERE oid='private.class_origin_protected_row_guard_v1()'::pg_catalog.regprocedure;
  IF pg_catalog.md5(original)<>'632bd1c54c3ce2d0a9fb0662ae6b34f1' THEN
    RAISE EXCEPTION 'builder_occurrence_guard_drift' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(original,E'BEGIN\n  IF TG_OP<>''INSERT'' THEN',
    E'BEGIN\n  IF TG_TABLE_SCHEMA=''private'' AND TG_TABLE_NAME=''character_class_occurrences_v1'' AND TG_OP=''UPDATE''\n    AND private.builder_catalog_occurrence_transition_v1(pg_catalog.to_jsonb(OLD),pg_catalog.to_jsonb(NEW)) THEN RETURN NEW; END IF;\n  IF TG_OP<>''INSERT'' THEN');
  IF replacement=original THEN RAISE EXCEPTION 'builder_occurrence_guard_drift' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.format('CREATE OR REPLACE FUNCTION private.class_origin_protected_row_guard_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS %L',replacement);
END $occurrence_guard$;

CREATE FUNCTION private.apply_builder_subclass_link_v1(target uuid,occurrence_id uuid,subclass_ref_id uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap jsonb;
BEGIN
  cap:=private.read_builder_capability_v1(target);
  IF cap IS NULL OR cap->>'command'<>'select_subclass' THEN
    RAISE EXCEPTION 'builder_subclass_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap->'context',target);
  UPDATE private.character_class_occurrences_v1 o SET subclass_ref_id=apply_builder_subclass_link_v1.subclass_ref_id
    WHERE o.id=occurrence_id AND o.character_id=target
      AND cap#>'{protected_graph,occurrences}' @> pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(o));
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_subclass_occurrence_unavailable' USING ERRCODE='42501'; END IF;
END $$;
ALTER FUNCTION private.apply_builder_subclass_link_v1(uuid,uuid,uuid) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.apply_builder_subclass_link_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.apply_builder_subclass_link_v1(uuid,uuid,uuid) TO postgres;
GRANT EXECUTE ON FUNCTION private.read_builder_capability_v1(uuid),private.builder_catalog_occurrence_transition_v1(jsonb,jsonb) TO inkborne_class_origin_owner;

-- New reserved provenance cannot be minted or stripped by legacy table writes.
CREATE FUNCTION private.guard_builder_catalog_projection_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb; after_row jsonb; row_value jsonb; target uuid; domain text;
  cap private.character_builder_capabilities_v1%ROWTYPE; reserved boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN before_row:=pg_catalog.to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN after_row:=pg_catalog.to_jsonb(NEW); END IF;
  row_value:=COALESCE(after_row,before_row); target:=(row_value->>'character_id')::uuid;
  domain:=CASE TG_TABLE_NAME WHEN 'character_spells' THEN 'spells' ELSE 'refs' END;
  reserved:=CASE domain WHEN 'spells' THEN before_row->>'source'='racial_trait' OR after_row->>'source'='racial_trait'
    ELSE before_row->>'choice_source' LIKE 'builder:%' OR after_row->>'choice_source' LIKE 'builder:%' END;
  IF COALESCE(reserved,false) THEN
    SELECT * INTO cap FROM private.character_builder_capabilities_v1
      WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
    IF NOT FOUND OR (before_row IS NOT NULL AND NOT (cap.protected_graph->domain) @> pg_catalog.jsonb_build_array(before_row))
      OR (after_row IS NOT NULL AND NOT (cap.expected_graph->domain) @> pg_catalog.jsonb_build_array(after_row)) THEN
      RAISE EXCEPTION 'builder_projection_provenance_required' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER builder_catalog_ref_provenance BEFORE INSERT OR UPDATE OR DELETE ON public.character_content_refs
  FOR EACH ROW EXECUTE FUNCTION private.guard_builder_catalog_projection_v1();
CREATE TRIGGER builder_catalog_spell_provenance BEFORE INSERT OR UPDATE OR DELETE ON public.character_spells
  FOR EACH ROW EXECUTE FUNCTION private.guard_builder_catalog_projection_v1();

CREATE FUNCTION private.apply_builder_catalog_command_v1(target uuid,command text,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
  selected public.content_versions%ROWTYPE; ref_row public.character_content_refs%ROWTYPE;
  feature_row public.character_feature_grants%ROWTYPE; spell_grant_row public.character_spell_grants%ROWTYPE;
  spell_row public.character_spells%ROWTYPE; occurrence jsonb; next_occurrence jsonb;
  prior_refs jsonb; race_refs jsonb; before_race_refs jsonb; prior_subclass jsonb; subclass_pin jsonb;
  next_choices jsonb; expected jsonb; refs jsonb; features jsonb; grants jsonb; spells jsonb;
  selected_type text; old_types text[]; affected_ids text[]; selected_class_slug text; class_version jsonb;
  entry jsonb; pin jsonb; definition jsonb; dependency jsonb; source jsonb; root_pin jsonb;
  queue jsonb:='[]'; queue_index integer:=0; roots jsonb; trait_refs jsonb:='[]'; visited text[]:='{}';
  slug text; choice jsonb; chosen jsonb; choice_count bigint; tier jsonb; values_list jsonb;
  unlock_level integer; ordinal integer; manifest jsonb; existing jsonb; grant_value jsonb;
  casting_ability text; root_slug text; group_slug text; keep boolean; domain text;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command IS DISTINCT FROM command THEN
    RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(parent.choices->'classes')<>'array'
    OR pg_catalog.jsonb_array_length(parent.choices->'classes')<>1
    OR parent.choices#>'{classes,0,level}' IS DISTINCT FROM '1'::jsonb THEN
    RAISE EXCEPTION 'builder_initial_class_required' USING ERRCODE='42501'; END IF;
  next_choices:=parent.choices; selected_class_slug:=parent.choices#>>'{classes,0,slug}';
  SELECT pg_catalog.to_jsonb(o) INTO occurrence FROM private.character_class_occurrences_v1 o
    WHERE o.character_id=target AND o.id=(parent.choices#>>'{classes,0,occurrence_id}')::uuid
      AND o.class_slug=selected_class_slug AND o.lifecycle='provisional';
  IF occurrence IS NULL THEN RAISE EXCEPTION 'builder_initial_class_required' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO prior_refs
    FROM public.character_content_refs r WHERE r.character_id=target;
  SELECT pg_catalog.to_jsonb(v) INTO class_version FROM public.character_content_refs r JOIN public.content_versions v
    ON v.content_id=r.content_id AND v.version=r.content_version
    WHERE r.id=(occurrence->>'controller_ref_id')::uuid AND r.character_id=target
      AND v.content_type_snapshot='class' AND v.slug_snapshot=selected_class_slug;
  IF class_version IS NULL THEN RAISE EXCEPTION 'builder_class_pin_unavailable' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(p.value ORDER BY v.content_type_snapshot,p.value->>'id'),'[]') INTO race_refs
    FROM pg_catalog.jsonb_array_elements(prior_refs) p(value) JOIN public.content_versions v
      ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    WHERE v.content_type_snapshot IN ('race','subrace');
  before_race_refs:=race_refs;
  SELECT p.value INTO prior_subclass FROM pg_catalog.jsonb_array_elements(prior_refs) p(value)
    JOIN public.content_versions v ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    WHERE v.content_type_snapshot='subclass';
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(prior_refs) p(value) JOIN public.content_versions v
    ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    WHERE v.content_type_snapshot='subclass')>1
    OR occurrence->'subclass_ref_id' IS DISTINCT FROM COALESCE(prior_subclass->'id','null'::jsonb) THEN
    RAISE EXCEPTION 'builder_subclass_pin_mismatch' USING ERRCODE='23514'; END IF;
  subclass_pin:=prior_subclass;

  IF command IN ('select_race','select_subrace','select_subclass') THEN
    IF (command='select_subclass' AND NOT private.builder_exact_keys_v1(fields,ARRAY['class_slug','content_id','content_version']))
      OR (command<>'select_subclass' AND NOT private.builder_exact_keys_v1(fields,ARRAY['content_id','content_version'])) THEN
      RAISE EXCEPTION 'builder_invalid_selection' USING ERRCODE='22023'; END IF;
    selected_type:=CASE command WHEN 'select_race' THEN 'race' WHEN 'select_subrace' THEN 'subrace' ELSE 'subclass' END;
    IF command='select_subclass' AND (fields->>'class_slug' IS DISTINCT FROM selected_class_slug
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(class_version#>'{data_snapshot,levels}') l(value)
        WHERE l.value->>'level'='1' AND l.value->'subclass_level'='true'::jsonb)
      AND NOT EXISTS(SELECT 1 FROM public.character_feature_grants g JOIN public.content_versions v
        ON v.content_id=g.feature_content_id AND v.version=g.feature_version
        WHERE g.character_id=target AND g.controller_ref_id=(occurrence->>'controller_ref_id')::uuid
          AND g.unlock_level<=1 AND v.data_snapshot->>'feature_type'='subclass')) THEN
      RAISE EXCEPTION 'builder_subclass_not_available' USING ERRCODE='22023'; END IF;
    IF command='select_subclass' AND fields->'content_id'='null'::jsonb AND fields->'content_version'='null'::jsonb THEN
      subclass_pin:=NULL;
      next_choices:=pg_catalog.jsonb_set(next_choices,'{classes,0}',(next_choices#>'{classes,0}')-'subclass');
    ELSE
      IF NOT private.builder_uuid_v1(fields->>'content_id') OR pg_catalog.jsonb_typeof(fields->'content_version')<>'number'
        OR fields->>'content_version' !~ '^[1-9][0-9]{0,9}$' OR (fields->>'content_version')::numeric>2147483647 THEN
        RAISE EXCEPTION 'builder_invalid_selection' USING ERRCODE='22023'; END IF;
      SELECT v.* INTO selected FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id AND d.version=v.version
        WHERE v.content_id=(fields->>'content_id')::uuid AND v.version=(fields->>'content_version')::integer
          AND v.system_id_snapshot=parent.system_id AND v.content_type_snapshot=selected_type AND NOT d.is_retired
          AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
      IF NOT FOUND THEN RAISE EXCEPTION 'builder_content_unavailable' USING ERRCODE='42501'; END IF;
      IF selected_type='subclass' THEN
        IF selected.data_snapshot->>'parent_class' IS DISTINCT FROM selected_class_slug THEN
          RAISE EXCEPTION 'builder_subclass_parent_mismatch' USING ERRCODE='22023'; END IF;
        subclass_pin:=private.builder_catalog_pin_v1(target,pg_catalog.to_jsonb(selected),
          pg_catalog.jsonb_build_object('source','subclass','class',selected_class_slug),
          'builder:subclass:'||(occurrence->>'id'),NULL,prior_refs);
        next_choices:=pg_catalog.jsonb_set(next_choices,'{classes,0,subclass}',pg_catalog.to_jsonb(selected.slug_snapshot),true);
      ELSE
        IF selected_type='subrace' AND selected.data_snapshot->>'parent_race' IS DISTINCT FROM parent.choices->>'race' THEN
          RAISE EXCEPTION 'builder_subrace_parent_mismatch' USING ERRCODE='22023'; END IF;
        old_types:=CASE selected_type WHEN 'race' THEN ARRAY['race','subrace'] ELSE ARRAY['subrace'] END;
        SELECT COALESCE(pg_catalog.jsonb_agg(p.value),'[]') INTO race_refs FROM pg_catalog.jsonb_array_elements(race_refs) p(value)
          JOIN public.content_versions v ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
          WHERE NOT v.content_type_snapshot=ANY(old_types);
        pin:=private.builder_catalog_pin_v1(target,pg_catalog.to_jsonb(selected),pg_catalog.jsonb_build_object('source',selected_type),NULL,NULL,prior_refs);
        race_refs:=race_refs||pg_catalog.jsonb_build_array(pin);
        IF selected_type='race' THEN next_choices:=next_choices-'subrace'; END IF;
        next_choices:=pg_catalog.jsonb_set(next_choices,ARRAY[selected_type],pg_catalog.to_jsonb(selected.slug_snapshot),true);
      END IF;
    END IF;
  ELSIF command IN ('clear_race','clear_subrace') THEN
    IF NOT private.builder_exact_keys_v1(fields,'{}'::text[]) THEN RAISE EXCEPTION 'builder_invalid_clear' USING ERRCODE='22023'; END IF;
    old_types:=CASE command WHEN 'clear_race' THEN ARRAY['race','subrace'] ELSE ARRAY['subrace'] END;
    SELECT COALESCE(pg_catalog.jsonb_agg(p.value),'[]') INTO race_refs FROM pg_catalog.jsonb_array_elements(race_refs) p(value)
      JOIN public.content_versions v ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
      WHERE NOT v.content_type_snapshot=ANY(old_types);
    next_choices:=next_choices-old_types;
  ELSIF command IN ('race_choice','class_choice') THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['choice_id','selections']) OR pg_catalog.jsonb_typeof(fields->'choice_id')<>'string'
      OR length(fields->>'choice_id') NOT BETWEEN 1 AND 200 OR pg_catalog.jsonb_typeof(fields->'selections')<>'array'
      OR pg_catalog.jsonb_array_length(fields->'selections')>100
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(fields->'selections') e(value)
        WHERE pg_catalog.jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}') NOT BETWEEN 1 AND 300)
      OR (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(fields->'selections'))<>pg_catalog.jsonb_array_length(fields->'selections') THEN
      RAISE EXCEPTION 'builder_invalid_choice' USING ERRCODE='22023'; END IF;
    SELECT count(*),pg_catalog.jsonb_agg(e.value)->0 INTO choice_count,choice
      FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE r.character_id=target AND e.value->>'type'='choice' AND e.value->>'choice_id'=fields->>'choice_id'
        AND ((command='race_choice' AND (v.content_type_snapshot IN ('race','subrace')
          OR (v.content_type_snapshot='trait' AND r.choice_source LIKE 'builder:racial-trait:%')))
          OR (command='class_choice' AND (r.id=(occurrence->>'controller_ref_id')::uuid
            OR (v.content_type_snapshot='subclass' AND r.id=(occurrence->>'subclass_ref_id')::uuid)
            OR (r.feature_grant_id IS NOT NULL AND private.is_character_feature_grant_active(r.feature_grant_id)))));
    IF choice_count<>1 OR choice->>'choose' !~ '^[1-9][0-9]{0,2}$'
      OR pg_catalog.jsonb_array_length(fields->'selections')>(choice->>'choose')::integer THEN
      RAISE EXCEPTION 'builder_choice_unavailable' USING ERRCODE='22023'; END IF;
    IF command='class_choice' AND choice->>'grant_type' IN ('trait','spell') THEN
      RAISE EXCEPTION 'builder_choice_kind_unavailable' USING ERRCODE='22023'; END IF;
    IF (SELECT count(*) FROM public.character_content_refs r JOIN public.content_versions v
      ON v.content_id=r.content_id AND v.version=r.content_version CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE r.character_id=target AND e.value->>'type'='choice' AND e.value->>'choice_id'=fields->>'choice_id')<>1 THEN
      RAISE EXCEPTION 'builder_ambiguous_choice' USING ERRCODE='22023'; END IF;
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(fields->'selections') LOOP
      IF pg_catalog.jsonb_typeof(choice->'from')='array' THEN
        IF NOT (choice->'from') @> pg_catalog.jsonb_build_array(chosen) THEN
          RAISE EXCEPTION 'builder_choice_unavailable' USING ERRCODE='22023'; END IF;
      ELSIF choice->>'from'='all_languages' OR (choice->>'from'='any' AND choice->>'grant_type'='language') THEN
        IF NOT EXISTS(SELECT 1 FROM public.content_definitions d WHERE d.system_id=parent.system_id AND d.content_type='language'
          AND NOT d.is_retired AND d.slug=chosen#>>'{}' AND private.character_can_access_content_version(target,d.id,d.version))
          OR EXISTS(SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
            WHERE r.character_id=target AND (COALESCE(v.data_snapshot->'languages','[]') @> pg_catalog.jsonb_build_array(chosen)
              OR COALESCE(v.data_snapshot->'languageProfs','[]') @> pg_catalog.jsonb_build_array(chosen)
              OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v.effects_snapshot) effect(value)
                WHERE effect.value->>'type'='grant' AND effect.value->>'stat' IN ('language','languages') AND effect.value->'value'=chosen))) THEN
          RAISE EXCEPTION 'builder_choice_unavailable' USING ERRCODE='22023'; END IF;
      ELSE RAISE EXCEPTION 'builder_choice_category_unavailable' USING ERRCODE='22023'; END IF;
    END LOOP;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')
      ||pg_catalog.jsonb_build_object(fields->>'choice_id',fields->'selections'),true);
  ELSIF command='fighting_style' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['feature_slug','style_slug']) OR pg_catalog.jsonb_typeof(fields->'feature_slug')<>'string'
      OR pg_catalog.jsonb_typeof(fields->'style_slug') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'builder_invalid_fighting_style' USING ERRCODE='22023'; END IF;
    SELECT count(*),pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v))->0 INTO choice_count,definition
      FROM public.character_feature_grants g JOIN public.content_versions v ON v.content_id=g.feature_content_id AND v.version=g.feature_version
      WHERE g.character_id=target AND g.controller_ref_id=(occurrence->>'controller_ref_id')::uuid
        AND g.feature_slug=fields->>'feature_slug' AND g.unlock_level<=1 AND v.data_snapshot->>'feature_type'='fighting_style';
    IF choice_count<>1 OR (fields->'style_slug'<>'null'::jsonb AND NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(definition#>'{data_snapshot,choices}') c(value)
        WHERE c.value->'options' @> pg_catalog.jsonb_build_array(fields->'style_slug'))) THEN
      RAISE EXCEPTION 'builder_fighting_style_unavailable' USING ERRCODE='22023'; END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')||
      pg_catalog.jsonb_build_object(fields->>'feature_slug',CASE WHEN fields->'style_slug'='null'::jsonb THEN '[]'::jsonb
        ELSE pg_catalog.jsonb_build_array(fields->'style_slug') END),true);
  ELSE RAISE EXCEPTION 'builder_catalog_command_unavailable' USING ERRCODE='22023'; END IF;

  -- The current/selected controller graph must match the canonical race choices.
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(race_refs) p(value) JOIN public.content_versions v
      ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
      WHERE next_choices->>v.content_type_snapshot IS DISTINCT FROM v.slug_snapshot
        OR (v.content_type_snapshot='subrace' AND v.data_snapshot->>'parent_race' IS DISTINCT FROM next_choices->>'race'))
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(race_refs) p(value) JOIN public.content_versions v
      ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
      GROUP BY v.content_type_snapshot HAVING count(*)<>1)
    OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['race','subrace']) kind(name)
      WHERE next_choices ? kind.name AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(race_refs) p(value)
        JOIN public.content_versions v ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
        WHERE v.content_type_snapshot=kind.name AND v.slug_snapshot=next_choices->>kind.name)) THEN
    RAISE EXCEPTION 'builder_race_pin_mismatch' USING ERRCODE='23514'; END IF;
  -- Clear removed controller choices; descendant choices are cleared below after
  -- compiling the retained/selected dependency closure.
  SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected_ids
    FROM pg_catalog.jsonb_array_elements(before_race_refs) p(value) JOIN public.content_versions v
      ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE e.value->>'type'='choice' AND NOT race_refs @> pg_catalog.jsonb_build_array(p.value);
  next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')-affected_ids,true);

  SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected_ids
    FROM pg_catalog.jsonb_array_elements(prior_refs) p(value) JOIN public.content_versions v
      ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE e.value->>'type'='choice' AND p.value->>'choice_source' LIKE 'builder:racial-trait:%'
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(race_refs) root(value)
        WHERE root.value->>'id'=p.value#>>'{context,root_controller_ref_id}');
  next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')-affected_ids,true);

  expected:=cap.protected_graph;
  SELECT COALESCE(pg_catalog.jsonb_agg(p.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(expected->'refs') p(value)
    WHERE COALESCE(p.value->>'choice_source','') NOT LIKE 'builder:racial-trait:%'
      AND COALESCE(p.value->>'choice_source','') NOT LIKE 'builder:fighting-style:%'
      AND (prior_subclass IS NULL OR p.value->>'id'<>prior_subclass->>'id')
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
        WHERE g.value->>'controller_ref_id'=prior_subclass->>'id' AND g.value->>'id'=p.value->>'feature_grant_id');
  SELECT COALESCE(pg_catalog.jsonb_agg(g.value),'[]') INTO features FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
    WHERE prior_subclass IS NULL OR g.value->>'controller_ref_id'<>prior_subclass->>'id';
  SELECT COALESCE(pg_catalog.jsonb_agg(g.value),'[]') INTO grants FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') g(value)
    WHERE prior_subclass IS NULL OR g.value->>'controller_ref_id'<>prior_subclass->>'id';
  SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(expected->'spells') s(value)
    WHERE s.value->>'source'<>'racial_trait' AND NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') g(value)
        WHERE g.value->>'controller_ref_id'=prior_subclass->>'id' AND s.value->>'spell_grant_id'=g.value->>'id');

  -- Each race/subrace dependency is pinned from its immutable source snapshot.
  -- A selected trait choice can add further trait pins; breadth is bounded and
  -- repeated content identity stops cycles. Existing exact pins retain IDs.
  FOR root_pin IN SELECT value FROM pg_catalog.jsonb_array_elements(race_refs) LOOP
    SELECT pg_catalog.to_jsonb(v) INTO definition FROM public.content_versions v
      WHERE v.content_id=(root_pin->>'content_id')::uuid AND v.version=(root_pin->>'content_version')::integer;
    FOR slug IN SELECT pg_catalog.jsonb_array_elements_text(COALESCE(definition#>'{data_snapshot,traits}','[]')) LOOP
      queue:=queue||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',definition,'root',root_pin,'slug',slug));
    END LOOP;
  END LOOP;
  WHILE queue_index<pg_catalog.jsonb_array_length(queue) LOOP
    IF pg_catalog.jsonb_array_length(queue)>128 THEN RAISE EXCEPTION 'builder_trait_dependency_bound' USING ERRCODE='54000'; END IF;
    entry:=queue->queue_index; queue_index:=queue_index+1;
    dependency:=private.builder_catalog_dependency_v1(target,entry->'source','trait',entry->>'slug');
    IF dependency->>'content_id'=ANY(visited) THEN
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(trait_refs) p(value)
        WHERE p.value->'content_id'=dependency->'content_id' AND p.value->'content_version'<>dependency->'version') THEN
        RAISE EXCEPTION 'builder_trait_snapshot_conflict' USING ERRCODE='23514'; END IF;
      CONTINUE;
    END IF;
    visited:=array_append(visited,dependency->>'content_id'); root_pin:=entry->'root';
    pin:=private.builder_catalog_pin_v1(target,dependency,
      pg_catalog.jsonb_build_object('source','racial_trait','root_controller_ref_id',root_pin->>'id'),
      'builder:racial-trait:'||(dependency->>'slug_snapshot'),NULL,prior_refs);
    trait_refs:=trait_refs||pg_catalog.jsonb_build_array(pin); refs:=refs||pg_catalog.jsonb_build_array(pin);
    FOR choice IN SELECT value FROM pg_catalog.jsonb_array_elements(dependency->'effects_snapshot')
      WHERE value->>'type'='choice' AND value->>'grant_type'='trait' LOOP
      FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(next_choices#>ARRAY['resolved_choices',choice->>'choice_id'],'[]')) LOOP
        IF pg_catalog.jsonb_typeof(choice->'from')<>'array' OR NOT (choice->'from') @> pg_catalog.jsonb_build_array(chosen) THEN
          RAISE EXCEPTION 'builder_trait_choice_unavailable' USING ERRCODE='22023'; END IF;
        queue:=queue||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',dependency,'root',root_pin,'slug',chosen#>>'{}'));
      END LOOP;
    END LOOP;
  END LOOP;
  SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected_ids
    FROM pg_catalog.jsonb_array_elements(prior_refs) p(value) JOIN public.content_versions v
      ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE e.value->>'type'='choice' AND p.value->>'choice_source' LIKE 'builder:racial-trait:%'
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(trait_refs) n(value)
        WHERE n.value->'content_id'=p.value->'content_id' AND n.value->'content_version'=p.value->'content_version');
  next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')-affected_ids,true);

  -- Fighting styles are finite child feature choices on active pinned manifests.
  FOR source IN SELECT pg_catalog.to_jsonb(v) FROM public.character_feature_grants g JOIN public.content_versions v
    ON v.content_id=g.feature_content_id AND v.version=g.feature_version
    WHERE g.character_id=target AND g.controller_ref_id=(occurrence->>'controller_ref_id')::uuid
      AND g.unlock_level<=1 AND v.data_snapshot->>'feature_type'='fighting_style' LOOP
    values_list:=COALESCE(next_choices#>ARRAY['resolved_choices',source->>'slug_snapshot'],'[]');
    IF pg_catalog.jsonb_typeof(values_list)<>'array' OR pg_catalog.jsonb_array_length(values_list)>1 THEN
      RAISE EXCEPTION 'builder_fighting_style_unavailable' USING ERRCODE='22023'; END IF;
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(values_list) LOOP
      IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(source#>'{data_snapshot,choices}') c(value)
        WHERE c.value->'options' @> pg_catalog.jsonb_build_array(chosen)) THEN
        RAISE EXCEPTION 'builder_fighting_style_unavailable' USING ERRCODE='22023'; END IF;
      dependency:=private.builder_catalog_dependency_v1(target,source,'feature',chosen#>>'{}');
      IF COALESCE(dependency#>>'{data_snapshot,feature_type}','') NOT IN ('fighting_style','passive')
        OR dependency#>>'{data_snapshot,class}' IS DISTINCT FROM selected_class_slug THEN
        RAISE EXCEPTION 'builder_fighting_style_unavailable' USING ERRCODE='22023'; END IF;
      pin:=private.builder_catalog_pin_v1(target,dependency,
        pg_catalog.jsonb_build_object('source','fighting_style','class',selected_class_slug,'feature',source->>'slug_snapshot'),
        'builder:fighting-style:'||(source->>'slug_snapshot'),NULL,prior_refs);
      refs:=refs||pg_catalog.jsonb_build_array(pin);
    END LOOP;
  END LOOP;

  -- Complete subclass manifests retain all frozen grants, activating level-one
  -- projections only. Class-origin identity/history is never reallocated.
  IF subclass_pin IS NOT NULL THEN
    refs:=refs||pg_catalog.jsonb_build_array(subclass_pin);
    SELECT pg_catalog.to_jsonb(v) INTO definition FROM public.content_versions v
      WHERE v.content_id=(subclass_pin->>'content_id')::uuid AND v.version=(subclass_pin->>'content_version')::integer;
    IF definition#>>'{data_snapshot,parent_class}' IS DISTINCT FROM selected_class_slug THEN
      RAISE EXCEPTION 'builder_subclass_parent_mismatch' USING ERRCODE='23514'; END IF;
    FOR tier IN SELECT value FROM pg_catalog.jsonb_array_elements(definition#>'{data_snapshot,levels}') ORDER BY (value->>'level')::integer LOOP
      IF tier->>'level' !~ '^([1-9]|1[0-9]|20)$' OR pg_catalog.jsonb_typeof(tier->'features')<>'array' THEN
        RAISE EXCEPTION 'builder_subclass_manifest_unavailable' USING ERRCODE='22023'; END IF;
      unlock_level:=(tier->>'level')::integer;
      FOR slug IN SELECT pg_catalog.jsonb_array_elements_text(tier->'features') LOOP
        IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(features) g(value)
          WHERE g.value->>'controller_ref_id'=subclass_pin->>'id' AND g.value->>'feature_slug'=slug) THEN CONTINUE; END IF;
        dependency:=private.builder_catalog_dependency_v1(target,definition,'feature',slug);
        SELECT g.value INTO existing FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'feature_grants') g(value)
          WHERE g.value->>'controller_ref_id'=subclass_pin->>'id' AND g.value->>'feature_slug'=slug
            AND g.value->>'feature_content_id'=dependency->>'content_id' AND g.value->'feature_version'=dependency->'version'
            AND g.value->>'unlock_level'=unlock_level::text;
        IF existing IS NULL THEN
          feature_row.id:=pg_catalog.gen_random_uuid(); feature_row.character_id:=target;
          feature_row.controller_ref_id:=(subclass_pin->>'id')::uuid; feature_row.controller_type:='subclass';
          feature_row.controller_slug:=definition->>'slug_snapshot'; feature_row.feature_slug:=slug;
          feature_row.feature_content_id:=(dependency->>'content_id')::uuid; feature_row.feature_version:=(dependency->>'version')::integer;
          feature_row.unlock_level:=unlock_level; feature_row.created_at:=pg_catalog.transaction_timestamp(); existing:=pg_catalog.to_jsonb(feature_row);
        END IF;
        features:=features||pg_catalog.jsonb_build_array(existing);
        IF unlock_level<=1 THEN
          pin:=private.builder_catalog_pin_v1(target,dependency,pg_catalog.jsonb_build_object('source','class_feature',
            'controller_type','subclass','controller_slug',definition->>'slug_snapshot','feature_slug',slug,'feature_level',unlock_level),
            'auto:feature-grant:'||(existing->>'id'),(existing->>'id')::uuid,prior_refs);
          refs:=refs||pg_catalog.jsonb_build_array(pin);
        END IF;
      END LOOP;
    END LOOP;
    ordinal:=0;
    FOR tier IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(definition#>'{data_snapshot,spellcastingExtra}','[]')) LOOP
      ordinal:=ordinal+1;
      IF pg_catalog.jsonb_typeof(tier)='object' THEN
        IF tier->>'level' !~ '^([1-9]|1[0-9]|20)$' OR pg_catalog.jsonb_typeof(tier->'spells')<>'array' THEN
          RAISE EXCEPTION 'builder_subclass_spell_manifest_unavailable' USING ERRCODE='22023'; END IF;
        unlock_level:=(tier->>'level')::integer; values_list:=tier->'spells';
      ELSIF pg_catalog.jsonb_typeof(tier)='array' THEN unlock_level:=ordinal; values_list:=tier;
      ELSIF pg_catalog.jsonb_typeof(tier)='string' THEN unlock_level:=ordinal; values_list:=pg_catalog.jsonb_build_array(tier);
      ELSE RAISE EXCEPTION 'builder_subclass_spell_manifest_unavailable' USING ERRCODE='22023'; END IF;
      IF unlock_level NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'builder_subclass_spell_manifest_unavailable' USING ERRCODE='22023'; END IF;
      FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(values_list) LOOP
        IF pg_catalog.jsonb_typeof(chosen)<>'string' THEN RAISE EXCEPTION 'builder_subclass_spell_manifest_unavailable' USING ERRCODE='22023'; END IF;
        slug:=chosen#>>'{}';
        IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(grants) g(value)
          WHERE g.value->>'controller_ref_id'=subclass_pin->>'id' AND g.value->>'spell_slug'=slug) THEN CONTINUE; END IF;
        dependency:=private.builder_catalog_dependency_v1(target,definition,'spell',slug);
        SELECT g.value INTO existing FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'spell_grants') g(value)
          WHERE g.value->>'controller_ref_id'=subclass_pin->>'id' AND g.value->>'spell_slug'=slug
            AND g.value->>'spell_content_id'=dependency->>'content_id' AND g.value->'spell_version'=dependency->'version'
            AND g.value->>'unlock_level'=unlock_level::text;
        IF existing IS NULL THEN
          spell_grant_row.id:=pg_catalog.gen_random_uuid(); spell_grant_row.character_id:=target;
          spell_grant_row.controller_ref_id:=(subclass_pin->>'id')::uuid; spell_grant_row.controller_type:='subclass';
          spell_grant_row.controller_slug:=definition->>'slug_snapshot'; spell_grant_row.class_slug:=selected_class_slug;
          spell_grant_row.spell_slug:=slug; spell_grant_row.spell_content_id:=(dependency->>'content_id')::uuid;
          spell_grant_row.spell_version:=(dependency->>'version')::integer; spell_grant_row.spell_name:=dependency->>'name_snapshot';
          spell_grant_row.unlock_level:=unlock_level; spell_grant_row.created_at:=pg_catalog.transaction_timestamp(); existing:=pg_catalog.to_jsonb(spell_grant_row);
        END IF;
        grants:=grants||pg_catalog.jsonb_build_array(existing);
      END LOOP;
    END LOOP;
  END IF;
  -- Retired subclass-owned choices are not carried into a replacement subclass.
  SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected_ids
    FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') p(value)
    JOIN public.content_versions v ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE e.value->>'type'='choice' AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(refs) n(value)
      WHERE n.value->'content_id'=p.value->'content_id' AND n.value->'content_version'=p.value->'content_version');
  next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')-affected_ids,true);
  FOR grant_value IN SELECT DISTINCT ON (g.value->>'spell_content_id',g.value->>'class_slug') g.value
    FROM pg_catalog.jsonb_array_elements(grants) g(value) WHERE (g.value->>'unlock_level')::integer<=1
    ORDER BY g.value->>'spell_content_id',g.value->>'class_slug',(g.value->>'unlock_level')::integer,g.value->>'controller_ref_id',g.value->>'id' LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(spells) s(value)
      WHERE s.value->'content_id'=grant_value->'spell_content_id' AND s.value->'class_slug'=grant_value->'class_slug') THEN CONTINUE; END IF;
    SELECT s.value INTO existing FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'spells') s(value)
      WHERE s.value->'spell_grant_id'=grant_value->'id';
    IF existing IS NULL THEN
      spell_row.id:=pg_catalog.gen_random_uuid(); spell_row.character_id:=target; spell_row.content_id:=(grant_value->>'spell_content_id')::uuid;
      spell_row.content_version:=(grant_value->>'spell_version')::integer; spell_row.name:=grant_value->>'spell_name';
      spell_row.class_slug:=grant_value->>'class_slug'; spell_row.is_known:=false; spell_row.is_prepared:=true;
      spell_row.always_prepared:=true; spell_row.in_spellbook:=false; spell_row.source:='feature'; spell_row.custom_data:=NULL;
      spell_row.created_at:=pg_catalog.transaction_timestamp(); spell_row.spell_grant_id:=(grant_value->>'id')::uuid; existing:=pg_catalog.to_jsonb(spell_row);
    END IF;
    spells:=spells||pg_catalog.jsonb_build_array(existing);
  END LOOP;

  -- Racial spells have deliberately separate provenance and grouping. They do
  -- not forge a class/subclass grant owner or enter class spell-grant tables.
  FOR pin IN SELECT value FROM pg_catalog.jsonb_array_elements(trait_refs||race_refs) LOOP
    SELECT pg_catalog.to_jsonb(v) INTO definition FROM public.content_versions v
      WHERE v.content_id=(pin->>'content_id')::uuid AND v.version=(pin->>'content_version')::integer;
    IF definition->>'content_type_snapshot' IN ('race','subrace') THEN root_pin:=pin;
    ELSE SELECT value INTO root_pin FROM pg_catalog.jsonb_array_elements(race_refs)
      WHERE value->>'id'=pin#>>'{context,root_controller_ref_id}'; END IF;
    SELECT v.slug_snapshot INTO root_slug FROM public.content_versions v
      WHERE v.content_id=(root_pin->>'content_id')::uuid AND v.version=(root_pin->>'content_version')::integer;
    group_slug:='race:'||root_slug;
    SELECT e.value->>'value' INTO casting_ability FROM pg_catalog.jsonb_array_elements(definition->'effects_snapshot') e(value)
      WHERE e.value->>'type'='grant' AND e.value->>'stat'='spellcasting_ability' LIMIT 1;
    values_list:='[]';
    FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(definition->'effects_snapshot') LOOP
      IF entry->>'type'='grant' AND entry->>'stat'='spell' THEN
        values_list:=values_list||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('slug',entry->>'value','choice_id',NULL));
      ELSIF entry->>'type'='choice' AND entry->>'grant_type'='spell' THEN
        FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(next_choices#>ARRAY['resolved_choices',entry->>'choice_id'],'[]')) LOOP
          IF pg_catalog.jsonb_typeof(entry->'from')<>'array' OR NOT (entry->'from') @> pg_catalog.jsonb_build_array(chosen) THEN
            RAISE EXCEPTION 'builder_racial_spell_choice_unavailable' USING ERRCODE='22023'; END IF;
          values_list:=values_list||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('slug',chosen#>>'{}','choice_id',entry->>'choice_id'));
        END LOOP;
      END IF;
    END LOOP;
    FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(values_list) LOOP
      IF casting_ability NOT IN ('strength','dexterity','constitution','intelligence','wisdom','charisma') OR casting_ability IS NULL THEN
        RAISE EXCEPTION 'builder_racial_spell_ability_unavailable' USING ERRCODE='22023'; END IF;
      dependency:=private.builder_catalog_dependency_v1(target,definition,'spell',entry->>'slug');
      IF dependency#>'{data_snapshot,level}' IS DISTINCT FROM '0'::jsonb THEN
        RAISE EXCEPTION 'builder_racial_spell_level_unavailable' USING ERRCODE='22023'; END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(spells) s(value)
        WHERE s.value->'content_id'=dependency->'content_id' AND s.value->>'class_slug'=group_slug) THEN CONTINUE; END IF;
      source:=pg_catalog.jsonb_build_object('builder_source_pin_id',pin->>'id','builder_root_ref_id',root_pin->>'id',
        'builder_choice_id',entry->'choice_id','spellcasting_ability',casting_ability);
      SELECT s.value INTO existing FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'spells') s(value)
        WHERE s.value->>'source'='racial_trait' AND s.value->'content_id'=dependency->'content_id'
          AND s.value->'content_version'=dependency->'version' AND s.value->>'class_slug'=group_slug AND s.value->'custom_data'=source;
      IF existing IS NULL THEN
        spell_row.id:=pg_catalog.gen_random_uuid(); spell_row.character_id:=target; spell_row.content_id:=(dependency->>'content_id')::uuid;
        spell_row.content_version:=(dependency->>'version')::integer; spell_row.name:=dependency->>'name_snapshot'; spell_row.class_slug:=group_slug;
        spell_row.is_known:=true; spell_row.is_prepared:=true; spell_row.always_prepared:=true; spell_row.in_spellbook:=false;
        spell_row.source:='racial_trait'; spell_row.custom_data:=source; spell_row.created_at:=pg_catalog.transaction_timestamp();
        spell_row.spell_grant_id:=NULL; existing:=pg_catalog.to_jsonb(spell_row);
      END IF;
      spells:=spells||pg_catalog.jsonb_build_array(existing);
    END LOOP;
  END LOOP;

  next_occurrence:=occurrence||pg_catalog.jsonb_build_object('subclass_ref_id',subclass_pin->'id');
  expected:=expected||pg_catalog.jsonb_build_object('refs',refs,'feature_grants',features,'spell_grants',grants,'spells',spells,
    'occurrences',pg_catalog.jsonb_build_array(next_occurrence));
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    IF pg_catalog.jsonb_array_length(expected->domain)>4096 OR EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->domain) p(value) GROUP BY value->>'id' HAVING count(*)<>1) THEN
      RAISE EXCEPTION 'builder_catalog_graph_bound' USING ERRCODE='54000'; END IF;
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO entry
      FROM pg_catalog.jsonb_array_elements(expected->domain);
    expected:=pg_catalog.jsonb_set(expected,ARRAY[domain],entry);
  END LOOP;
  IF pg_catalog.octet_length(expected::text)>8388608 THEN RAISE EXCEPTION 'builder_catalog_graph_bound' USING ERRCODE='54000'; END IF;
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->'classes'
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;

  -- Delete only sealed removed rows, then set the choices that activate the new
  -- graph. Any failure aborts these changes together with their receipt.
  DELETE FROM public.character_spells r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spells') p(value) WHERE p.value->>'id'=r.id::text);
  DELETE FROM public.character_content_refs r WHERE r.character_id=target
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'refs') p(value) WHERE p.value->>'id'=r.id::text)
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(race_refs) p(value) WHERE p.value->>'id'=r.id::text)
    AND NOT EXISTS(SELECT 1 FROM public.content_versions v WHERE v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot='background');
  DELETE FROM public.character_feature_grants r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') p(value) WHERE p.value->>'id'=r.id::text);
  DELETE FROM public.character_spell_grants r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') p(value) WHERE p.value->>'id'=r.id::text);
  UPDATE public.characters SET choices=next_choices WHERE id=target;
  FOR pin IN SELECT value FROM pg_catalog.jsonb_array_elements(race_refs) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_content_refs WHERE id=(pin->>'id')::uuid) THEN
      ref_row:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,pin);
      INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
        VALUES(ref_row.id,ref_row.character_id,ref_row.content_id,ref_row.content_version,ref_row.context,ref_row.choice_source,ref_row.created_at,ref_row.feature_grant_id);
    END IF;
  END LOOP;
  -- Controllers precede grant manifests; active derived feature refs follow them.
  FOR pin IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'refs') p(value)
    WHERE value->'feature_grant_id'='null'::jsonb LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_content_refs WHERE id=(pin->>'id')::uuid) THEN
      ref_row:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,pin);
      INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
        VALUES(ref_row.id,ref_row.character_id,ref_row.content_id,ref_row.content_version,ref_row.context,ref_row.choice_source,ref_row.created_at,ref_row.feature_grant_id);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_feature_grants WHERE id=(entry->>'id')::uuid) THEN
      feature_row:=pg_catalog.jsonb_populate_record(NULL::public.character_feature_grants,entry);
      INSERT INTO public.character_feature_grants(id,character_id,controller_ref_id,controller_type,controller_slug,feature_slug,feature_content_id,feature_version,unlock_level,created_at)
        VALUES(feature_row.id,feature_row.character_id,feature_row.controller_ref_id,feature_row.controller_type,feature_row.controller_slug,feature_row.feature_slug,
          feature_row.feature_content_id,feature_row.feature_version,feature_row.unlock_level,feature_row.created_at);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_spell_grants WHERE id=(entry->>'id')::uuid) THEN
      spell_grant_row:=pg_catalog.jsonb_populate_record(NULL::public.character_spell_grants,entry);
      INSERT INTO public.character_spell_grants(id,character_id,controller_ref_id,controller_type,controller_slug,class_slug,spell_slug,spell_content_id,spell_version,spell_name,unlock_level,created_at)
        VALUES(spell_grant_row.id,spell_grant_row.character_id,spell_grant_row.controller_ref_id,spell_grant_row.controller_type,spell_grant_row.controller_slug,
          spell_grant_row.class_slug,spell_grant_row.spell_slug,spell_grant_row.spell_content_id,spell_grant_row.spell_version,spell_grant_row.spell_name,spell_grant_row.unlock_level,spell_grant_row.created_at);
    END IF;
  END LOOP;
  FOR pin IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'refs') WHERE value->'feature_grant_id'<>'null'::jsonb LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_content_refs WHERE id=(pin->>'id')::uuid) THEN
      ref_row:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,pin);
      INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
        VALUES(ref_row.id,ref_row.character_id,ref_row.content_id,ref_row.content_version,ref_row.context,ref_row.choice_source,ref_row.created_at,ref_row.feature_grant_id);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'spells') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_spells WHERE id=(entry->>'id')::uuid) THEN
      spell_row:=pg_catalog.jsonb_populate_record(NULL::public.character_spells,entry);
      INSERT INTO public.character_spells(id,character_id,content_id,content_version,name,class_slug,is_known,is_prepared,always_prepared,in_spellbook,source,custom_data,created_at,spell_grant_id)
        VALUES(spell_row.id,spell_row.character_id,spell_row.content_id,spell_row.content_version,spell_row.name,spell_row.class_slug,spell_row.is_known,
          spell_row.is_prepared,spell_row.always_prepared,spell_row.in_spellbook,spell_row.source,spell_row.custom_data,spell_row.created_at,spell_row.spell_grant_id);
    END IF;
  END LOOP;
  IF next_occurrence IS DISTINCT FROM occurrence THEN
    PERFORM private.apply_builder_subclass_link_v1(target,(occurrence->>'id')::uuid,(next_occurrence->>'subclass_ref_id')::uuid);
  END IF;
END $$;

ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) RENAME TO character_builder_command_before_catalog_v1;
REVOKE ALL ON FUNCTION public.character_builder_command_before_catalog_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; command text; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; receipt jsonb;
BEGIN
  command:=p_request->>'command';
  IF command IS NULL OR command NOT IN ('select_race','select_subrace','clear_race','clear_subrace','race_choice','class_choice','fighting_style','select_subclass','save_details') THEN
    RETURN public.character_builder_command_before_catalog_v1(p_context,p_request);
  END IF;
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb OR pg_catalog.octet_length(p_request::text)>524288
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'operation_id')
    OR pg_catalog.jsonb_typeof(p_request->'command')<>'string' OR pg_catalog.jsonb_typeof(p_request->'fields')<>'object' THEN
    RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,command,true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN
      RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,command);
  IF command='save_details' THEN PERFORM private.apply_builder_details_v1(target,p_request->'fields');
  ELSE PERFORM private.apply_builder_catalog_command_v1(target,command,p_request->'fields'); END IF;
  saved:=private.finish_builder_step_v1(p_context,target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command',command,'fields',p_request->'fields',
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;

CREATE OR REPLACE FUNCTION private.apply_builder_step_order_v1(target uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap jsonb; ordering private.character_projection_order_v1%ROWTYPE; parent public.characters%ROWTYPE;
  next_pins uuid[]; next_inventory uuid[]; next_spells uuid[]; next_features uuid[]; next_grants uuid[];
BEGIN
  cap:=private.read_builder_capability_v1(target);
  IF cap IS NULL THEN RAISE EXCEPTION 'builder_order_capability_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=(cap->>'actor_id')::uuid;
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=target FOR UPDATE;
  IF NOT FOUND OR ordering.producer_revision<>parent.action_revision
    OR (pg_catalog.to_jsonb(ordering)-'producer_revision') IS DISTINCT FROM ((cap->'before_order')-'producer_revision') THEN
    RAISE EXCEPTION 'builder_order_before_changed' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_pins FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(ordering.pins) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_content_refs ref WHERE ref.id=value AND ref.character_id=target)
    UNION ALL SELECT ref.id,pg_catalog.cardinality(ordering.pins)+row_number() OVER(ORDER BY ref.created_at,ref.id)
      FROM public.character_content_refs ref WHERE ref.character_id=target AND NOT ref.id=ANY(ordering.pins)) r;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_inventory FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(ordering.inventory) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_inventory item WHERE item.id=value AND item.character_id=target)
    UNION ALL SELECT item.id,pg_catalog.cardinality(ordering.inventory)+row_number() OVER(ORDER BY item.sort_order,item.created_at,item.id)
      FROM public.character_inventory item WHERE item.character_id=target AND NOT item.id=ANY(ordering.inventory)) r;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_spells FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(ordering.spells) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_spells item WHERE item.id=value AND item.character_id=target)
    UNION ALL SELECT item.id,pg_catalog.cardinality(ordering.spells)+row_number() OVER(ORDER BY item.created_at,item.id)
      FROM public.character_spells item WHERE item.character_id=target AND NOT item.id=ANY(ordering.spells)) r;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_features FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(ordering.feature_grants) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_feature_grants item WHERE item.id=value AND item.character_id=target)
    UNION ALL SELECT item.id,pg_catalog.cardinality(ordering.feature_grants)+row_number() OVER(ORDER BY item.created_at,item.id)
      FROM public.character_feature_grants item WHERE item.character_id=target AND NOT item.id=ANY(ordering.feature_grants)) r;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_grants FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(ordering.spell_grants) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_spell_grants item WHERE item.id=value AND item.character_id=target)
    UNION ALL SELECT item.id,pg_catalog.cardinality(ordering.spell_grants)+row_number() OVER(ORDER BY item.created_at,item.id)
      FROM public.character_spell_grants item WHERE item.character_id=target AND NOT item.id=ANY(ordering.spell_grants)) r;
  IF cap->>'command'<>'award_equipment' AND next_inventory IS DISTINCT FROM ordering.inventory THEN
    RAISE EXCEPTION 'builder_inventory_changed' USING ERRCODE='23514'; END IF;
  UPDATE private.character_projection_order_v1 SET pins=next_pins,inventory=next_inventory,spells=next_spells,
    feature_grants=next_features,spell_grants=next_grants WHERE character_id=target;
END $$;
GRANT UPDATE(spells,feature_grants,spell_grants) ON private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;

CREATE OR REPLACE FUNCTION private.finish_builder_step_v1(context jsonb,target uuid) RETURNS public.characters
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(context,target);
  PERFORM private.assert_builder_catalog_graph_v1(target,true);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND OR parent.name IS DISTINCT FROM cap.expected_name
    OR (pg_catalog.to_jsonb(parent)-ARRAY['name','choices','base_stats','state','action_revision'])
      IS DISTINCT FROM (cap.before_parent-ARRAY['name','choices','base_stats','state','action_revision'])
    OR cap.command<>'save_abilities' AND pg_catalog.to_jsonb(parent.base_stats) IS DISTINCT FROM cap.before_parent->'base_stats'
    OR cap.command<>'award_equipment' AND pg_catalog.to_jsonb(parent.state) IS DISTINCT FROM cap.before_parent->'state'
    OR cap.command<>'award_equipment' AND (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=target)
      IS DISTINCT FROM cap.before_inventory THEN
    RAISE EXCEPTION 'builder_protected_state_changed' USING ERRCODE='23514'; END IF;
  PERFORM private.apply_builder_step_order_v1(target);
  DELETE FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  RETURN parent;
END $$;

DO $closure$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.assert_builder_catalog_graph_v1(uuid,boolean)','private.builder_catalog_dependency_v1(uuid,jsonb,text,text)',
    'private.builder_catalog_pin_v1(uuid,jsonb,jsonb,text,uuid,jsonb)','private.guard_builder_catalog_projection_v1()',
    'private.builder_catalog_occurrence_transition_v1(jsonb,jsonb)','private.apply_builder_catalog_command_v1(uuid,text,jsonb)',
    'private.apply_builder_details_v1(uuid,jsonb)',
    'private.materialize_feature_grants_for_ref(uuid)','private.materialize_spell_grants_for_ref(uuid)',
    'public.character_builder_command_v1(jsonb,jsonb)'
  ] LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner',signature);
  END LOOP;
END $closure$;
GRANT EXECUTE ON FUNCTION private.builder_catalog_occurrence_transition_v1(jsonb,jsonb) TO inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','public.character_builder_command_before_catalog_v1(jsonb,jsonb)','EXECUTE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_catalog_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;

