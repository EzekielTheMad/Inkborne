-- Disposable local profile only, after builder Expertise. Finite acquisition,
-- immutable role interpretation, and per-controller draft edits. The genuine
-- bootstrap/first-add origin journal is retained unchanged; no global gate opens.
BEGIN;
DO $preflight$
DECLARE item record;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_multiclass_installation_unavailable' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','18863da6716ad4e18aa59c4a596d3a52','v'),
    ('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)','c2d24db409de1cb538f340d0742f5bd8','v'),
    ('private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)','e966ea6eedd01aaa9e50bdc2473fcf1d','v'),
    ('private.builder_progression_hp_v1(uuid,uuid,integer,integer,text,jsonb,uuid,uuid)','4803b744e2949ff80a417c913caeaa60','v'),
    ('private.check_builder_progression_history_v1()','c02f97eb255eca8000d47dd0c11cae23','v'),
    ('public.character_builder_command_v1(jsonb,jsonb)','9d91c12b2e40509260cc5edb48e71b6f','v'),
    ('private.normalize_builder_expertise_v1(uuid,jsonb,jsonb,text)','c93df6c7614780951cb7e3d50d5babaa','s')
  ) wanted(signature,body_md5,volatility) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(item.signature)
      AND p.proowner='postgres'::pg_catalog.regrole AND p.prosecdef AND p.provolatile::text=item.volatility
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
      AND pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n'))=item.body_md5) THEN
      RAISE EXCEPTION 'builder_multiclass_preimage_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $preflight$;

CREATE TABLE private.character_builder_class_acquisitions_v1 (
  character_id uuid NOT NULL,occurrence_id uuid NOT NULL,controller_ref_id uuid NOT NULL,
  actor_id uuid NOT NULL,operation_id uuid NOT NULL,content_id uuid NOT NULL,content_version integer NOT NULL,
  acquired_character_level integer NOT NULL CHECK(acquired_character_level BETWEEN 2 AND 20),
  profile jsonb NOT NULL,created_at timestamptz NOT NULL,
  PRIMARY KEY(character_id,occurrence_id),UNIQUE(character_id,controller_ref_id),UNIQUE(actor_id,operation_id),
  FOREIGN KEY(actor_id,operation_id) REFERENCES private.character_builder_receipts_v1(actor_id,operation_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(content_id,content_version) REFERENCES public.content_versions(content_id,version),
  CHECK(pg_catalog.octet_length(profile::text)<=1048576)
);
ALTER TABLE private.character_builder_class_acquisitions_v1 OWNER TO postgres;
ALTER TABLE private.character_builder_class_acquisitions_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_builder_class_acquisitions_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_class_acquisition_internal ON private.character_builder_class_acquisitions_v1 TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON private.character_builder_class_acquisitions_v1 FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
CREATE TRIGGER builder_class_acquisition_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON private.character_builder_class_acquisitions_v1
  FOR EACH STATEMENT EXECUTE FUNCTION private.builder_progression_history_immutable_v1();

-- Identity is recovered from the authentic, consumed 0->1 acquisition and its
-- empty bootstrap, never from current class array order or a mutable marker.
CREATE FUNCTION private.builder_original_occurrence_v1(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; initial private.class_writer_acceptance_v1%ROWTYPE;
  bootstrap private.class_writer_acceptance_v1%ROWTYPE; origin private.character_class_origin_v1%ROWTYPE;
  occurrence jsonb; current_occurrence jsonb;
BEGIN
  SELECT * INTO parent FROM public.characters WHERE id=target;
  SELECT * INTO origin FROM private.character_class_origin_v1 WHERE character_id=target;
  IF parent.id IS NULL OR origin.character_id IS NULL OR origin.creation_provenance<>'new_character' OR origin.command_revision<>1 THEN
    RAISE EXCEPTION 'builder_genuine_first_class_required' USING ERRCODE='42501'; END IF;
  SELECT j.* INTO initial FROM private.class_writer_acceptance_v1 j
    JOIN private.character_class_commands_v1 c ON c.character_id=j.target_character_id AND c.receipt=j.receipt
    WHERE j.target_character_id=target AND j.verified_actor_id=parent.user_id AND j.acceptance_kind='class_transition'
      AND j.finalized AND j.revision_transition_consumed AND j.receipt#>>'{canonical_intent,command}'='add_class'
      AND j.receipt->>'before_class_revision'='0' AND j.receipt->>'after_class_revision'='1';
  IF NOT FOUND OR (SELECT count(*) FROM private.character_class_commands_v1 WHERE character_id=target)<>1
    OR initial.before_parent->'choices'<>'{}'::jsonb OR initial.before_parent->>'action_revision'<>'0'
    OR initial.before_origin->>'creation_operation_id' IS DISTINCT FROM origin.creation_operation_id::text
    OR initial.expected_graph->'origin' IS DISTINCT FROM (pg_catalog.to_jsonb(origin)||pg_catalog.jsonb_build_object('command_revision',origin.command_revision::text))
    OR pg_catalog.jsonb_array_length(initial.expected_graph->'occurrences')<>1
    OR pg_catalog.jsonb_array_length(initial.expected_graph#>'{parent,choices,classes}')<>1 THEN
    RAISE EXCEPTION 'builder_original_acquisition_invalid' USING ERRCODE='23514'; END IF;
  SELECT j.* INTO bootstrap FROM private.class_writer_acceptance_v1 j
    JOIN private.character_creation_commands_v1 c ON c.target_character_id=j.target_character_id AND c.receipt=j.receipt
    WHERE c.verified_actor_id=parent.user_id AND c.operation_id=origin.creation_operation_id
      AND j.verified_actor_id=parent.user_id AND j.acceptance_kind='bootstrap_new' AND j.finalized;
  IF NOT FOUND OR bootstrap.expected_graph->'parent' IS DISTINCT FROM initial.before_parent
    OR bootstrap.expected_graph->'origin' IS DISTINCT FROM initial.before_origin
    OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t
      WHERE t.acceptance_id IN (bootstrap.acceptance_id,initial.acceptance_id) AND NOT t.consumed)
    OR (SELECT count(*) FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=initial.acceptance_id)
      <>pg_catalog.jsonb_array_length(initial.planned_transitions)
    OR (SELECT count(*) FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=bootstrap.acceptance_id)
      <>pg_catalog.jsonb_array_length(bootstrap.planned_transitions) THEN
    RAISE EXCEPTION 'builder_original_bootstrap_invalid' USING ERRCODE='23514'; END IF;
  occurrence:=initial.expected_graph#>'{occurrences,0}';
  SELECT pg_catalog.to_jsonb(o) INTO current_occurrence FROM private.character_class_occurrences_v1 o WHERE o.character_id=target AND o.id=(occurrence->>'id')::uuid;
  IF current_occurrence IS NULL OR current_occurrence-'subclass_ref_id' IS DISTINCT FROM occurrence-'subclass_ref_id'
    OR NOT EXISTS(SELECT 1 FROM public.character_content_refs r JOIN pg_catalog.jsonb_array_elements(initial.expected_graph->'refs') p(value)
      ON p.value=pg_catalog.to_jsonb(r) WHERE r.id=(occurrence->>'controller_ref_id')::uuid AND r.character_id=target)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(parent.choices->'classes') c(value)
      WHERE c.value->>'occurrence_id'=occurrence->>'id' AND c.value->>'slug'=occurrence->>'class_slug') THEN
    RAISE EXCEPTION 'builder_original_identity_changed' USING ERRCODE='23514'; END IF;
  RETURN current_occurrence;
END $$;

CREATE FUNCTION private.builder_class_role_profile_v1(definition jsonb,role_name text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE effects jsonb:='[]'; effect jsonb; data jsonb; ability text; skill_choice boolean;
BEGIN
  IF role_name NOT IN ('original','secondary') OR definition->>'content_type_snapshot'<>'class'
    OR definition->>'source_snapshot'<>'srd' OR definition->>'scope_snapshot'<>'platform'
    OR definition->'owner_id_snapshot'<>'null'::jsonb
    OR definition->>'slug_snapshot' NOT IN ('barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard')
    OR pg_catalog.jsonb_typeof(definition->'effects_snapshot')<>'array'
    OR pg_catalog.jsonb_typeof(definition#>'{data_snapshot,multiclass,proficiencies_gained}')<>'array' THEN
    RAISE EXCEPTION 'builder_class_role_unsupported' USING ERRCODE='23514'; END IF;
  data:=definition->'data_snapshot';
  FOR effect IN SELECT value FROM pg_catalog.jsonb_array_elements(definition->'effects_snapshot') LOOP
    IF effect->>'type'='grant' AND (effect->>'stat' LIKE 'save_%' OR effect->>'stat' LIKE 'saving_throw_%') THEN
      ability:=CASE WHEN effect->>'stat' LIKE 'save_%' THEN substr(effect->>'stat',6) ELSE substr(effect->>'stat',14) END;
      IF effect IS DISTINCT FROM pg_catalog.jsonb_build_object('type','grant','stat',effect->>'stat','value','proficient')
        OR NOT COALESCE(data->'saving_throws','[]') @> pg_catalog.jsonb_build_array(ability) THEN
        RAISE EXCEPTION 'builder_class_role_save_ambiguous' USING ERRCODE='23514'; END IF;
      IF role_name='original' THEN effects:=effects||pg_catalog.jsonb_build_array(effect||pg_catalog.jsonb_build_object('stat','saving_throw_'||ability)); END IF;
    ELSIF role_name='secondary' AND effect->>'type'='choice' AND effect->>'grant_type' IN ('proficiency','skill','tool') THEN
      -- Multiclass skill and instrument allowances are smaller than starting
      -- allowances. Other starting-class proficiency choices are not acquired.
      skill_choice:=EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(effect->'from') v(value) WHERE v.value#>>'{}' LIKE 'skill-%');
      IF (skill_choice AND definition->>'slug_snapshot' IN ('bard','ranger','rogue'))
        OR (NOT skill_choice AND definition->>'slug_snapshot'='bard') THEN
        effects:=effects||pg_catalog.jsonb_build_array(effect||'{"choose":1}'::jsonb);
      END IF;
    ELSE effects:=effects||pg_catalog.jsonb_build_array(effect); END IF;
  END LOOP;
  IF role_name='secondary' THEN
    data:=data||pg_catalog.jsonb_build_object('saving_throws','[]'::jsonb,'skills','[]'::jsonb,'toolProfs',
      CASE WHEN definition->>'slug_snapshot'='rogue' THEN '["thieves-tools"]'::jsonb ELSE '[]'::jsonb END,
      'starting_proficiencies',data#>'{multiclass,proficiencies_gained}',
      'armorProfs',COALESCE(data#>'{armorProfs,secondary}','[]'),
      'weaponProfs',COALESCE(data#>'{weaponProfs,secondary}','[]'),'equipment','');
  END IF;
  RETURN pg_catalog.jsonb_build_object('profile_version',1,'producer_id','native-srd-builder-acquisition-v1','role',role_name,
    'content_id',definition->'content_id','content_version',definition->'version',
    'raw_effects',definition->'effects_snapshot','evaluation_effects',effects,'raw_data',definition->'data_snapshot','evaluation_data',data);
END $$;

-- Per-class levels are always resolved by exact occurrence/controller linkage.
CREATE FUNCTION private.builder_controller_level_v1(choices jsonb,graph jsonb,controller text) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result integer; matches integer;
BEGIN
  SELECT count(*),min((c.value->>'level')::integer) INTO matches,result
    FROM pg_catalog.jsonb_array_elements(choices->'classes') c(value)
    JOIN pg_catalog.jsonb_array_elements(graph->'occurrences') o(value) ON o.value->>'id'=c.value->>'occurrence_id'
    WHERE o.value->>'lifecycle'<>'ended' AND (o.value->>'controller_ref_id'=controller OR o.value->>'subclass_ref_id'=controller);
  IF matches<>1 OR result NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'builder_controller_level_unavailable' USING ERRCODE='23514'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION private.builder_acquisition_prerequisite_v1(target uuid,definition jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE scores jsonb:=private.character_ability_scores(target,NULL,NULL,NULL); slug text:=definition->>'slug_snapshot';
BEGIN
  -- This reviewed SRD interpretation also represents Fighter's OR prerequisite,
  -- which the historical API prerequisite array could not encode.
  RETURN CASE slug
    WHEN 'barbarian' THEN (scores->>'strength')::numeric>=13
    WHEN 'bard' THEN (scores->>'charisma')::numeric>=13
    WHEN 'cleric' THEN (scores->>'wisdom')::numeric>=13
    WHEN 'druid' THEN (scores->>'wisdom')::numeric>=13
    WHEN 'fighter' THEN (scores->>'strength')::numeric>=13 OR (scores->>'dexterity')::numeric>=13
    WHEN 'monk' THEN (scores->>'dexterity')::numeric>=13 AND (scores->>'wisdom')::numeric>=13
    WHEN 'paladin' THEN (scores->>'strength')::numeric>=13 AND (scores->>'charisma')::numeric>=13
    WHEN 'ranger' THEN (scores->>'dexterity')::numeric>=13 AND (scores->>'wisdom')::numeric>=13
    WHEN 'rogue' THEN (scores->>'dexterity')::numeric>=13
    WHEN 'sorcerer' THEN (scores->>'charisma')::numeric>=13
    WHEN 'warlock' THEN (scores->>'charisma')::numeric>=13
    WHEN 'wizard' THEN (scores->>'intelligence')::numeric>=13 ELSE false END;
END $$;

CREATE FUNCTION private.builder_class_roles_v1(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE original jsonb; parent public.characters%ROWTYPE; result jsonb:='[]'; row_value record; profile jsonb;
  retained private.character_builder_class_acquisitions_v1%ROWTYPE; history private.character_builder_progression_history_v1%ROWTYPE;
  role_name text; total integer;
BEGIN
  original:=private.builder_original_occurrence_v1(target);
  SELECT * INTO parent FROM public.characters WHERE id=target;
  SELECT sum((value->>'level')::integer) INTO total FROM pg_catalog.jsonb_array_elements(parent.choices->'classes');
  IF total<>parent.level OR pg_catalog.jsonb_array_length(parent.choices->'classes') NOT BETWEEN 1 AND 12
    OR (SELECT count(DISTINCT value->>'slug') FROM pg_catalog.jsonb_array_elements(parent.choices->'classes'))<>pg_catalog.jsonb_array_length(parent.choices->'classes')
    OR (SELECT count(DISTINCT value->>'occurrence_id') FROM pg_catalog.jsonb_array_elements(parent.choices->'classes'))<>pg_catalog.jsonb_array_length(parent.choices->'classes')
    OR (SELECT count(*) FROM private.character_class_occurrences_v1 WHERE character_id=target AND lifecycle<>'ended')
      <>pg_catalog.jsonb_array_length(parent.choices->'classes') THEN RAISE EXCEPTION 'builder_class_graph_mismatch' USING ERRCODE='23514'; END IF;
  FOR row_value IN SELECT pg_catalog.to_jsonb(o) AS occurrence,pg_catalog.to_jsonb(r) AS pin,pg_catalog.to_jsonb(v) AS definition
    FROM pg_catalog.jsonb_array_elements(parent.choices->'classes') c(value)
    JOIN private.character_class_occurrences_v1 o ON o.id=(c.value->>'occurrence_id')::uuid AND o.character_id=target AND o.class_slug=c.value->>'slug' AND o.lifecycle<>'ended'
    JOIN public.character_content_refs r ON r.id=o.controller_ref_id AND r.character_id=target AND r.content_id=o.content_id AND r.content_version=o.content_version
    JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot='class'
    ORDER BY r.id LOOP
    role_name:=CASE WHEN row_value.occurrence->'id'=original->'id' THEN 'original' ELSE 'secondary' END;
    profile:=private.builder_class_role_profile_v1(row_value.definition,role_name);
    IF role_name='secondary' THEN
      SELECT * INTO retained FROM private.character_builder_class_acquisitions_v1 WHERE character_id=target AND occurrence_id=(row_value.occurrence->>'id')::uuid;
      SELECT * INTO history FROM private.character_builder_progression_history_v1 WHERE actor_id=retained.actor_id AND operation_id=retained.operation_id;
      IF retained.character_id IS NULL OR retained.actor_id<>parent.user_id OR retained.profile IS DISTINCT FROM profile
        OR retained.controller_ref_id::text IS DISTINCT FROM row_value.pin->>'id'
        OR retained.content_id::text IS DISTINCT FROM row_value.pin->>'content_id' OR retained.content_version::text IS DISTINCT FROM row_value.pin->>'content_version'
        OR history.command<>'add_class' OR history.character_id<>target
        OR NOT history.after_graph->'occurrences' @> pg_catalog.jsonb_build_array(row_value.occurrence||'{"subclass_ref_id":null}'::jsonb)
        OR NOT EXISTS(SELECT 1 FROM private.character_builder_receipts_v1 b WHERE b.actor_id=retained.actor_id AND b.operation_id=retained.operation_id AND b.receipt=history.receipt)
        OR row_value.occurrence->>'lifecycle'<>'accepted' OR row_value.occurrence->>'acquisition_operation_id'<>retained.operation_id::text THEN
        RAISE EXCEPTION 'builder_secondary_acquisition_invalid' USING ERRCODE='23514'; END IF;
    END IF;
    result:=result||pg_catalog.jsonb_build_array((profile-ARRAY['profile_version','producer_id'])||pg_catalog.jsonb_build_object('occurrence_id',row_value.occurrence->'id',
      'controller_ref_id',row_value.pin->'id'));
  END LOOP;
  IF pg_catalog.jsonb_array_length(result)<>pg_catalog.jsonb_array_length(parent.choices->'classes') THEN
    RAISE EXCEPTION 'builder_class_graph_mismatch' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('status','available','contract_version',1,'character_id',target,'system_id',parent.system_id,
    'action_revision',parent.action_revision::text,'original_occurrence_id',original->'id',
    'source_order',(SELECT pins FROM private.character_projection_order_v1 WHERE character_id=target),'class_sources',result);
END $$;

CREATE FUNCTION public.character_builder_class_role_projection_v1(p_context jsonb,p_character_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM private.begin_builder_step_v1(p_context,p_character_id,'read_class_roles',true);
  result:=private.builder_class_roles_v1(p_character_id);
  PERFORM private.lock_builder_character_rows_v1(p_context,p_character_id);
  RETURN result;
END $$;

-- Occurrences are owned by the existing isolated origin role. This bridge can
-- insert only the exact new row sealed by the finite acquisition compiler.
CREATE FUNCTION private.apply_builder_new_occurrence_v1(target uuid,new_row jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap jsonb; occurrence private.character_class_occurrences_v1%ROWTYPE;
BEGIN
  cap:=private.read_builder_capability_v1(target);
  IF cap IS NULL OR cap->>'command'<>'add_class' OR NOT (cap#>'{expected_graph,occurrences}') @> pg_catalog.jsonb_build_array(new_row)
    OR (cap#>'{protected_graph,occurrences}') @> pg_catalog.jsonb_build_array(new_row)
    OR new_row->>'character_id' IS DISTINCT FROM target::text THEN RAISE EXCEPTION 'builder_acquisition_plan_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap->'context',target);
  occurrence:=pg_catalog.jsonb_populate_record(NULL::private.character_class_occurrences_v1,new_row);
  INSERT INTO private.character_class_occurrences_v1 SELECT occurrence.*;
END $$;
ALTER FUNCTION private.apply_builder_new_occurrence_v1(uuid,jsonb) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.apply_builder_new_occurrence_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.apply_builder_new_occurrence_v1(uuid,jsonb) TO postgres;

CREATE FUNCTION private.builder_role_definition_v1(target uuid,pin jsonb,definition jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE original jsonb; profile jsonb;
BEGIN
  IF definition->>'content_type_snapshot'<>'class' THEN RETURN definition; END IF;
  original:=private.builder_original_occurrence_v1(target);
  profile:=private.builder_class_role_profile_v1(definition,CASE WHEN pin->'id'=original->'controller_ref_id' THEN 'original' ELSE 'secondary' END);
  RETURN definition||pg_catalog.jsonb_build_object('data_snapshot',profile->'evaluation_data','effects_snapshot',profile->'evaluation_effects');
END $$;
CREATE FUNCTION private.builder_class_effects_v1(target uuid,pin jsonb,definition jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.builder_role_definition_v1(target,pin,definition)->'effects_snapshot'
$$;

CREATE FUNCTION private.builder_command_class_v1(target uuid,command text,fields jsonb) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result text; candidates text[];
BEGIN
  IF command IN ('select_subclass','set_class_level','save_hp_roll','select_class_spells') THEN result:=fields->>'class_slug';
  ELSIF command IN ('fighting_style','select_asi') THEN
    SELECT array_agg(DISTINCT o.class_slug) INTO candidates FROM public.character_feature_grants g
      JOIN private.character_class_occurrences_v1 o ON o.character_id=target AND o.lifecycle<>'ended'
        AND (g.controller_ref_id=o.controller_ref_id OR g.controller_ref_id=o.subclass_ref_id)
      WHERE g.character_id=target AND g.feature_slug=fields->>'feature_slug';
    IF cardinality(candidates)=1 THEN result:=candidates[1]; END IF;
  ELSIF command='class_choice' THEN
    SELECT array_agg(DISTINCT o.class_slug) INTO candidates FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      LEFT JOIN public.character_feature_grants g ON g.id=r.feature_grant_id
      JOIN private.character_class_occurrences_v1 o ON o.character_id=target AND o.lifecycle<>'ended'
        AND (r.id=o.controller_ref_id OR r.id=o.subclass_ref_id OR g.controller_ref_id=o.controller_ref_id OR g.controller_ref_id=o.subclass_ref_id)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(private.builder_class_effects_v1(target,pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v))) e(value)
      WHERE r.character_id=target AND e.value->>'type'='choice' AND e.value->>'choice_id'=fields->>'choice_id';
    IF cardinality(candidates)=1 THEN result:=candidates[1]; END IF;
  ELSE result:=private.builder_original_occurrence_v1(target)->>'class_slug'; END IF;
  IF result IS NULL OR NOT EXISTS(SELECT 1 FROM public.characters c CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(c.choices->'classes') picked(value)
    WHERE c.id=target AND picked.value->>'slug'=result) THEN RAISE EXCEPTION 'builder_command_class_unavailable' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION private.builder_multiclass_max_hp_v1(target uuid,choices jsonb,graph jsonb) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE original uuid:=(private.builder_original_occurrence_v1(target)->>'id')::uuid; selected record;
  scores jsonb:=private.builder_progression_scores_v1(target,choices); con_mod integer; result integer:=0; class_level integer; contribution integer;
BEGIN
  con_mod:=floor(((scores->>'constitution')::numeric-10)/2)::integer;
  FOR selected IN SELECT c.value AS picked,v.data_snapshot AS definition FROM pg_catalog.jsonb_array_elements(choices->'classes') c(value)
    JOIN pg_catalog.jsonb_array_elements(graph->'occurrences') o(value) ON o.value->>'id'=c.value->>'occurrence_id'
    JOIN public.content_versions v ON v.content_id=(o.value->>'content_id')::uuid AND v.version=(o.value->>'content_version')::integer LOOP
    FOR class_level IN 1..(selected.picked->>'level')::integer LOOP
      contribution:=CASE WHEN class_level=1 AND (selected.picked->>'occurrence_id')::uuid=original THEN (selected.definition->>'hit_die')::integer
        ELSE COALESCE((choices#>>ARRAY['hp_rolls',(selected.picked->>'slug')||'-'||class_level,'value'])::integer,(selected.definition->>'hit_die')::integer/2+1) END;
      result:=result+GREATEST(1,contribution+con_mod);
    END LOOP;
  END LOOP;
  RETURN result;
END $$;

CREATE FUNCTION private.prepare_builder_acquisition_v1(target uuid,operation uuid,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE; selected public.content_versions%ROWTYPE;
  descriptor jsonb; expected jsonb; next_choices jsonb; refs jsonb; features jsonb; grants jsonb; spells jsonb;
  occurrence private.character_class_occurrences_v1%ROWTYPE; pin public.character_content_refs%ROWTYPE;
  feature public.character_feature_grants%ROWTYPE; spell_grant public.character_spell_grants%ROWTYPE; spell public.character_spells%ROWTYPE;
  entry jsonb; active jsonb; current_class record; domain text; profile jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>'add_class' THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT private.builder_exact_keys_v1(fields,ARRAY['class_id','class_version','expected_action_revision'])
    OR NOT private.builder_uuid_v1(fields->>'class_id') OR pg_catalog.jsonb_typeof(fields->'class_version')<>'number'
    OR fields->>'class_version' !~ '^[1-9][0-9]{0,9}$' OR (fields->>'class_version')::numeric>2147483647
    OR pg_catalog.jsonb_typeof(fields->'expected_action_revision')<>'string' OR fields->>'expected_action_revision' !~ '^(0|[1-9][0-9]{0,18})$' THEN
    RAISE EXCEPTION 'builder_invalid_acquisition' USING ERRCODE='22023'; END IF;
  IF fields->>'expected_action_revision' IS DISTINCT FROM parent.action_revision::text THEN RAISE EXCEPTION 'builder_stale_action_revision' USING ERRCODE='40001'; END IF;
  IF parent.level>=20 THEN RAISE EXCEPTION 'builder_total_level_exceeded' USING ERRCODE='22023'; END IF;
  PERFORM private.builder_class_roles_v1(target);
  SELECT v.* INTO selected FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id AND d.version=v.version
    JOIN public.game_systems s ON s.id=v.system_id_snapshot AND s.slug='dnd-5e-2014' AND s.status='published'
    WHERE v.content_id=(fields->>'class_id')::uuid AND v.version=(fields->>'class_version')::integer AND NOT d.is_retired
      AND v.system_id_snapshot=parent.system_id AND v.content_type_snapshot='class'
      AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d,s;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_class_unavailable' USING ERRCODE='42501'; END IF;
  profile:=private.builder_class_role_profile_v1(pg_catalog.to_jsonb(selected),'secondary');
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(parent.choices->'classes') c(value) WHERE c.value->>'slug'=selected.slug_snapshot) THEN
    RAISE EXCEPTION 'builder_duplicate_class' USING ERRCODE='22023'; END IF;
  IF private.builder_acquisition_prerequisite_v1(target,pg_catalog.to_jsonb(selected)) IS NOT TRUE THEN
    RAISE EXCEPTION 'builder_multiclass_prerequisite_unmet' USING ERRCODE='22023'; END IF;
  FOR current_class IN SELECT pg_catalog.to_jsonb(v) AS definition FROM private.character_class_occurrences_v1 o
    JOIN public.content_versions v ON v.content_id=o.content_id AND v.version=o.content_version WHERE o.character_id=target AND o.lifecycle<>'ended' LOOP
    IF private.builder_acquisition_prerequisite_v1(target,current_class.definition) IS NOT TRUE THEN
      RAISE EXCEPTION 'builder_multiclass_prerequisite_unmet' USING ERRCODE='22023'; END IF;
  END LOOP;
  descriptor:=private.resolve_first_class_dependencies_v1(target,selected.content_id,selected.version);
  expected:=cap.protected_graph; refs:=expected->'refs'; features:=expected->'feature_grants'; grants:=expected->'spell_grants'; spells:=expected->'spells';
  occurrence.id:=pg_catalog.gen_random_uuid(); occurrence.character_id:=target; occurrence.system_id:=parent.system_id;
  occurrence.content_id:=selected.content_id; occurrence.content_version:=selected.version; occurrence.class_slug:=selected.slug_snapshot;
  occurrence.lifecycle:='accepted'; occurrence.selected_at:=pg_catalog.transaction_timestamp(); occurrence.acquired_character_level:=parent.level+1;
  occurrence.acquisition_operation_id:=operation; occurrence.accepted_at:=pg_catalog.transaction_timestamp(); occurrence.ended_at:=NULL;
  occurrence.controller_ref_id:=pg_catalog.gen_random_uuid(); occurrence.subclass_ref_id:=NULL;
  pin.id:=occurrence.controller_ref_id; pin.character_id:=target; pin.content_id:=selected.content_id; pin.content_version:=selected.version;
  pin.context:=pg_catalog.jsonb_build_object('source','class','level',1); pin.choice_source:='builder:class-acquisition:'||operation;
  pin.created_at:=pg_catalog.transaction_timestamp(); pin.feature_grant_id:=NULL; refs:=refs||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(pin));
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(descriptor->'feature_grants') LOOP
    feature.id:=pg_catalog.gen_random_uuid(); feature.character_id:=target; feature.controller_ref_id:=occurrence.controller_ref_id;
    feature.controller_type:='class'; feature.controller_slug:=selected.slug_snapshot; feature.feature_slug:=entry->>'feature_slug';
    feature.feature_content_id:=(entry->>'feature_content_id')::uuid; feature.feature_version:=(entry->>'feature_version')::integer;
    feature.unlock_level:=(entry->>'unlock_level')::integer; feature.created_at:=pg_catalog.transaction_timestamp();
    features:=features||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(feature));
    IF feature.unlock_level=1 THEN
      SELECT value INTO active FROM pg_catalog.jsonb_array_elements(descriptor->'active_feature_refs') WHERE value->>'feature_slug'=feature.feature_slug;
      IF active IS NULL THEN RAISE EXCEPTION 'builder_class_feature_descriptor_incomplete' USING ERRCODE='23514'; END IF;
      pin.id:=pg_catalog.gen_random_uuid(); pin.content_id:=feature.feature_content_id; pin.content_version:=feature.feature_version;
      pin.context:=active->'context'; pin.choice_source:='auto:feature-grant:'||feature.id; pin.feature_grant_id:=feature.id;
      refs:=refs||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(pin));
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(descriptor->'spell_grants') LOOP
    spell_grant.id:=pg_catalog.gen_random_uuid(); spell_grant.character_id:=target; spell_grant.controller_ref_id:=occurrence.controller_ref_id;
    spell_grant.controller_type:='class'; spell_grant.controller_slug:=selected.slug_snapshot; spell_grant.class_slug:=selected.slug_snapshot;
    spell_grant.spell_slug:=entry->>'spell_slug'; spell_grant.spell_content_id:=(entry->>'spell_content_id')::uuid;
    spell_grant.spell_version:=(entry->>'spell_version')::integer; spell_grant.spell_name:=entry->>'spell_name';
    spell_grant.unlock_level:=(entry->>'unlock_level')::integer; spell_grant.created_at:=pg_catalog.transaction_timestamp();
    grants:=grants||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(spell_grant));
    IF spell_grant.unlock_level=1 THEN
      spell.id:=pg_catalog.gen_random_uuid(); spell.character_id:=target; spell.content_id:=spell_grant.spell_content_id;
      spell.content_version:=spell_grant.spell_version; spell.name:=spell_grant.spell_name; spell.class_slug:=selected.slug_snapshot;
      spell.is_known:=false; spell.is_prepared:=true; spell.always_prepared:=true; spell.in_spellbook:=false; spell.source:='feature'; spell.custom_data:=NULL;
      spell.created_at:=pg_catalog.transaction_timestamp(); spell.spell_grant_id:=spell_grant.id; spells:=spells||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(spell));
    END IF;
  END LOOP;
  next_choices:=pg_catalog.jsonb_set(parent.choices,'{classes}',(parent.choices->'classes')||pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('slug',selected.slug_snapshot,'level',1,'occurrence_id',occurrence.id)));
  next_choices:=pg_catalog.jsonb_set(next_choices,'{hp_rolls}',COALESCE(next_choices->'hp_rolls','{}')||pg_catalog.jsonb_build_object(
    selected.slug_snapshot||'-1',pg_catalog.jsonb_build_object('method','average','value',(selected.data_snapshot->>'hit_die')::integer/2+1)),true);
  expected:=expected||pg_catalog.jsonb_build_object('refs',refs,'feature_grants',features,'spell_grants',grants,'spells',spells,
    'occurrences',(expected->'occurrences')||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(occurrence)));
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    IF pg_catalog.jsonb_array_length(expected->domain)>4096 THEN RAISE EXCEPTION 'builder_acquisition_graph_bound' USING ERRCODE='54000'; END IF;
    SELECT pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid) INTO entry FROM pg_catalog.jsonb_array_elements(expected->domain);
    expected:=pg_catalog.jsonb_set(expected,ARRAY[domain],entry);
  END LOOP;
  IF pg_catalog.octet_length(expected::text)>8388608 THEN RAISE EXCEPTION 'builder_acquisition_graph_bound' USING ERRCODE='54000'; END IF;
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->'classes',expected_choices=next_choices,
    expected_level=parent.level+1,expected_state=parent.state WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.apply_builder_progression_graph_v1(target,next_choices,parent.state,parent.level+1);
  INSERT INTO private.character_builder_class_acquisitions_v1(character_id,occurrence_id,controller_ref_id,actor_id,operation_id,content_id,content_version,acquired_character_level,profile,created_at)
    VALUES(target,occurrence.id,occurrence.controller_ref_id,parent.user_id,operation,selected.content_id,selected.version,parent.level+1,profile,pg_catalog.transaction_timestamp());
END $$;

-- One generic *sealed graph applicator*, not a generic caller plan: only the
-- existing finite compilers populate expected_graph. Retained rows are never
-- updated; controllers precede manifests, and manifests precede derived pins.
CREATE OR REPLACE FUNCTION private.apply_builder_progression_graph_v1(target uuid,choices jsonb,state jsonb,level integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; expected jsonb; entry jsonb; old_occurrence jsonb;
  pin public.character_content_refs%ROWTYPE; spell public.character_spells%ROWTYPE;
  feature public.character_feature_grants%ROWTYPE; spell_grant public.character_spell_grants%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.expected_choices IS DISTINCT FROM choices OR cap.expected_level IS DISTINCT FROM level
    OR cap.expected_state IS DISTINCT FROM state THEN RAISE EXCEPTION 'builder_progression_plan_required' USING ERRCODE='42501'; END IF;
  expected:=cap.expected_graph;
  DELETE FROM public.character_spells r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spells') p(value) WHERE p.value->>'id'=r.id::text);
  DELETE FROM public.character_content_refs r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM public.content_versions v WHERE v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot IN ('race','subrace','background'))
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'refs') p(value) WHERE p.value->>'id'=r.id::text);
  DELETE FROM public.character_feature_grants r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') p(value) WHERE p.value->>'id'=r.id::text);
  DELETE FROM public.character_spell_grants r WHERE r.character_id=target AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') p(value) WHERE p.value->>'id'=r.id::text);
  UPDATE public.characters SET choices=apply_builder_progression_graph_v1.choices,state=apply_builder_progression_graph_v1.state,
    level=apply_builder_progression_graph_v1.level WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'refs') WHERE value->'feature_grant_id'='null'::jsonb LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_content_refs r WHERE r.id=(entry->>'id')::uuid) THEN
      pin:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,entry);
      INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
        VALUES(pin.id,pin.character_id,pin.content_id,pin.content_version,pin.context,pin.choice_source,pin.created_at,pin.feature_grant_id);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_feature_grants r WHERE r.id=(entry->>'id')::uuid) THEN
      feature:=pg_catalog.jsonb_populate_record(NULL::public.character_feature_grants,entry);
      INSERT INTO public.character_feature_grants SELECT feature.*;
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_spell_grants r WHERE r.id=(entry->>'id')::uuid) THEN
      spell_grant:=pg_catalog.jsonb_populate_record(NULL::public.character_spell_grants,entry);
      INSERT INTO public.character_spell_grants SELECT spell_grant.*;
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'refs') WHERE value->'feature_grant_id'<>'null'::jsonb LOOP
    IF NOT EXISTS(SELECT 1 FROM public.character_content_refs r WHERE r.id=(entry->>'id')::uuid) THEN
      pin:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,entry);
      INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
        VALUES(pin.id,pin.character_id,pin.content_id,pin.content_version,pin.context,pin.choice_source,pin.created_at,pin.feature_grant_id);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'spells') LOOP
    SELECT * INTO spell FROM public.character_spells r WHERE r.id=(entry->>'id')::uuid;
    IF FOUND THEN
      IF pg_catalog.to_jsonb(spell) IS DISTINCT FROM entry THEN
        UPDATE public.character_spells SET is_known=(entry->>'is_known')::boolean,is_prepared=(entry->>'is_prepared')::boolean,
          in_spellbook=(entry->>'in_spellbook')::boolean WHERE id=(entry->>'id')::uuid AND character_id=target;
      END IF;
    ELSE
      spell:=pg_catalog.jsonb_populate_record(NULL::public.character_spells,entry);
      INSERT INTO public.character_spells(id,character_id,content_id,content_version,name,class_slug,is_known,is_prepared,always_prepared,in_spellbook,source,custom_data,created_at,spell_grant_id)
        VALUES(spell.id,spell.character_id,spell.content_id,spell.content_version,spell.name,spell.class_slug,spell.is_known,spell.is_prepared,
          spell.always_prepared,spell.in_spellbook,spell.source,spell.custom_data,spell.created_at,spell.spell_grant_id);
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'occurrences') LOOP
    SELECT value INTO old_occurrence FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'occurrences') WHERE value->'id'=entry->'id';
    IF old_occurrence IS NULL THEN PERFORM private.apply_builder_new_occurrence_v1(target,entry);
    ELSIF old_occurrence IS DISTINCT FROM entry THEN
      PERFORM private.apply_builder_subclass_link_v1(target,(old_occurrence->>'id')::uuid,(entry->>'subclass_ref_id')::uuid);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.builder_catalog_occurrence_transition_v1(before_row jsonb,after_row jsonb) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id()
    AND character_id=(COALESCE(before_row,after_row)->>'character_id')::uuid;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,cap.character_id);
  IF before_row IS NULL THEN
    RETURN cap.command='add_class' AND after_row IS NOT NULL AND after_row->>'lifecycle'='accepted'
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'occurrences') o(value) WHERE o.value->'id'=after_row->'id')
      AND (cap.expected_graph->'occurrences') @> pg_catalog.jsonb_build_array(after_row);
  END IF;
  RETURN cap.command IN ('select_subclass','set_class_level') AND after_row IS NOT NULL
    AND before_row->>'lifecycle'<>'ended' AND (before_row-'subclass_ref_id')=(after_row-'subclass_ref_id')
    AND (cap.protected_graph->'occurrences') @> pg_catalog.jsonb_build_array(before_row)
    AND (cap.expected_graph->'occurrences') @> pg_catalog.jsonb_build_array(after_row);
END $$;

CREATE OR REPLACE FUNCTION private.apply_builder_catalog_command_v1(target uuid,command text,fields jsonb) RETURNS void
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
  selected_index integer; selected_level integer; normalized jsonb; casting_ability text; root_slug text; group_slug text; keep boolean; domain text;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command IS DISTINCT FROM command THEN
    RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.builder_class_roles_v1(target);
  selected_class_slug:=private.builder_command_class_v1(target,command,fields);
  SELECT (ordinality-1)::integer,(value->>'level')::integer INTO selected_index,selected_level
    FROM pg_catalog.jsonb_array_elements(parent.choices->'classes') WITH ORDINALITY WHERE value->>'slug'=selected_class_slug;
  next_choices:=parent.choices;
  SELECT pg_catalog.to_jsonb(o) INTO occurrence FROM private.character_class_occurrences_v1 o
    WHERE o.character_id=target AND o.id=(parent.choices#>>ARRAY['classes',selected_index::text,'occurrence_id'])::uuid
      AND o.class_slug=selected_class_slug AND o.lifecycle<>'ended';
  IF occurrence IS NULL THEN RAISE EXCEPTION 'builder_class_occurrence_required' USING ERRCODE='42501'; END IF;
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
    WHERE v.content_type_snapshot='subclass' AND p.value->>'id'=occurrence->>'subclass_ref_id';
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(prior_refs) p(value) JOIN public.content_versions v
    ON v.content_id=(p.value->>'content_id')::uuid AND v.version=(p.value->>'content_version')::integer
    WHERE v.content_type_snapshot='subclass' AND p.value->>'id'=occurrence->>'subclass_ref_id')>1
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
        WHERE (l.value->>'level')::integer<=selected_level AND l.value->'subclass_level'='true'::jsonb)
      AND NOT EXISTS(SELECT 1 FROM public.character_feature_grants g JOIN public.content_versions v
        ON v.content_id=g.feature_content_id AND v.version=g.feature_version
        WHERE g.character_id=target AND g.controller_ref_id=(occurrence->>'controller_ref_id')::uuid
          AND g.unlock_level<=selected_level AND v.data_snapshot->>'feature_type'='subclass')) THEN
      RAISE EXCEPTION 'builder_subclass_not_available' USING ERRCODE='22023'; END IF;
    IF command='select_subclass' AND fields->'content_id'='null'::jsonb AND fields->'content_version'='null'::jsonb THEN
      subclass_pin:=NULL;
      next_choices:=pg_catalog.jsonb_set(next_choices,ARRAY['classes',selected_index::text],(next_choices#>ARRAY['classes',selected_index::text])-'subclass');
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
        next_choices:=pg_catalog.jsonb_set(next_choices,ARRAY['classes',selected_index::text,'subclass'],pg_catalog.to_jsonb(selected.slug_snapshot),true);
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
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(private.builder_class_effects_v1(target,pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v))) e(value)
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
      ON v.content_id=r.content_id AND v.version=r.content_version CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(private.builder_class_effects_v1(target,pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v))) e(value)
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
        AND g.feature_slug=fields->>'feature_slug' AND g.unlock_level<=selected_level AND v.data_snapshot->>'feature_type'='fighting_style';
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
      AND (COALESCE(p.value->>'choice_source','') NOT LIKE 'builder:fighting-style:%' OR p.value#>>'{context,class}' IS DISTINCT FROM selected_class_slug)
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
      AND g.unlock_level<=selected_level AND v.data_snapshot->>'feature_type'='fighting_style' LOOP
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
        IF unlock_level<=selected_level THEN
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
    FROM pg_catalog.jsonb_array_elements(grants) g(value) WHERE (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id')
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


  IF next_choices ? 'asi_choices' THEN
    SELECT COALESCE(pg_catalog.jsonb_object_agg(a.key,a.value),'{}') INTO normalized
      FROM pg_catalog.jsonb_each(next_choices->'asi_choices') a(key,value)
      WHERE EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(features) g(value)
        WHERE g.value->>'feature_slug'=a.key AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id'));
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',normalized,true);
    SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs) r(value)
      WHERE COALESCE(r.value->>'choice_source','') NOT LIKE 'choice:asi:%'
        OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(features) g(value)
          WHERE r.value->>'choice_source'='choice:asi:'||(g.value->>'id') AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id'));
  END IF;
  next_occurrence:=occurrence||pg_catalog.jsonb_build_object('subclass_ref_id',subclass_pin->'id');
  expected:=expected||pg_catalog.jsonb_build_object('refs',refs,'feature_grants',features,'spell_grants',grants,'spells',spells,
    'occurrences',(SELECT pg_catalog.jsonb_agg(CASE WHEN value->'id'=occurrence->'id' THEN next_occurrence ELSE value END ORDER BY (value->>'id')::uuid) FROM pg_catalog.jsonb_array_elements(expected->'occurrences')));
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    IF pg_catalog.jsonb_array_length(expected->domain)>4096 OR EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->domain) p(value) GROUP BY value->>'id' HAVING count(*)<>1) THEN
      RAISE EXCEPTION 'builder_catalog_graph_bound' USING ERRCODE='54000'; END IF;
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO entry
      FROM pg_catalog.jsonb_array_elements(expected->domain);
    expected:=pg_catalog.jsonb_set(expected,ARRAY[domain],entry);
  END LOOP;
  IF pg_catalog.octet_length(expected::text)>8388608 THEN RAISE EXCEPTION 'builder_catalog_graph_bound' USING ERRCODE='54000'; END IF;
  next_choices:=private.normalize_builder_expertise_v1(target,next_choices,
    refs||race_refs||(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot='background'),
    CASE WHEN command='class_choice' THEN fields->>'choice_id' ELSE NULL END);
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->'classes',expected_choices=next_choices
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

CREATE OR REPLACE FUNCTION private.prepare_builder_progression_v1(target uuid,operation uuid,command text,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
  controller jsonb; class_version jsonb; occurrence jsonb; expected jsonb; refs jsonb; spells jsonb; next_choices jsonb; next_state jsonb;
  current_class jsonb; selected_index integer; old_class_level integer; total_level integer; original_id uuid; selected_controller text; chosen_level integer; selected_class_slug text; die integer; hp jsonb; key text; item jsonb; picked jsonb; definition jsonb; pin jsonb; grant_value jsonb;
  normalized jsonb; allocations jsonb; points integer; scores jsonb; feat public.content_versions%ROWTYPE; prereq record; count_grants integer;
  selected_grant jsonb; feature_source text; source jsonb; spell public.character_spells%ROWTYPE; new_spells jsonb; selected_subclass jsonb;
  subclass_gate integer; removed_subclass uuid; affected text[]; domain text; con_mod integer; max_hp integer:=0; contribution integer;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>command THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters c WHERE c.id=target AND c.user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.builder_class_roles_v1(target);
  original_id:=(private.builder_original_occurrence_v1(target)->>'id')::uuid;
  selected_class_slug:=private.builder_command_class_v1(target,command,fields);
  SELECT (ordinality-1)::integer,(value->>'level')::integer INTO selected_index,chosen_level
    FROM pg_catalog.jsonb_array_elements(parent.choices->'classes') WITH ORDINALITY WHERE value->>'slug'=selected_class_slug;
  old_class_level:=chosen_level;
  SELECT value INTO occurrence FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'occurrences')
    WHERE value->>'id'=parent.choices#>>ARRAY['classes',selected_index::text,'occurrence_id'];
  IF occurrence IS NULL OR occurrence->>'lifecycle'='ended' THEN
    RAISE EXCEPTION 'builder_draft_occurrence_required' USING ERRCODE='42501'; END IF;
  selected_controller:=occurrence->>'controller_ref_id';
  SELECT pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v) INTO controller,class_version FROM public.character_content_refs r JOIN public.content_versions v
    ON v.content_id=r.content_id AND v.version=r.content_version WHERE r.id=(occurrence->>'controller_ref_id')::uuid AND r.character_id=target;
  IF class_version->>'slug_snapshot' IS DISTINCT FROM selected_class_slug THEN RAISE EXCEPTION 'builder_class_pin_unavailable' USING ERRCODE='23514'; END IF;
  die:=(class_version#>>'{data_snapshot,hit_die}')::integer;
  next_choices:=pg_catalog.jsonb_set(parent.choices,'{resolved_choices}',COALESCE(parent.choices->'resolved_choices','{}'),true);
  next_state:=parent.state; expected:=cap.protected_graph; refs:=expected->'refs'; spells:=expected->'spells';
  IF command='set_class_level' THEN
    IF NOT (private.builder_exact_keys_v1(fields,ARRAY['class_slug','level']) OR private.builder_exact_keys_v1(fields,ARRAY['class_slug','level','hp_roll']))
      OR fields->>'class_slug' IS DISTINCT FROM selected_class_slug OR pg_catalog.jsonb_typeof(fields->'level')<>'number'
      OR fields->>'level' !~ '^([1-9]|1[0-9]|20)$' THEN RAISE EXCEPTION 'builder_invalid_class_level' USING ERRCODE='22023'; END IF;
    chosen_level:=(fields->>'level')::integer;
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(class_version#>'{data_snapshot,levels}') WHERE value->>'level'=chosen_level::text) THEN
      RAISE EXCEPTION 'builder_class_level_unavailable' USING ERRCODE='22023'; END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,ARRAY['classes',selected_index::text,'level'],pg_catalog.to_jsonb(chosen_level));
    SELECT COALESCE(pg_catalog.jsonb_object_agg(h.key_name,h.value_data),'{}') INTO normalized FROM pg_catalog.jsonb_each(COALESCE(parent.choices->'hp_rolls','{}')) h(key_name,value_data) WHERE h.key_name NOT LIKE selected_class_slug||'-%';
    FOR points IN (CASE WHEN (occurrence->>'id')::uuid=original_id THEN 2 ELSE 1 END)..chosen_level LOOP
      key:=selected_class_slug||'-'||points;
      hp:=parent.choices#>ARRAY['hp_rolls',key];
      IF hp IS NULL THEN SELECT h.after_parent#>ARRAY['choices','hp_rolls',key] INTO hp
        FROM private.character_builder_progression_history_v1 h WHERE h.character_id=target AND h.after_parent#>ARRAY['choices','hp_rolls',key] IS NOT NULL
        ORDER BY h.created_at DESC,h.operation_id DESC LIMIT 1; END IF;
      hp:=COALESCE(hp,pg_catalog.jsonb_build_object('method','average','value',die/2+1));
      normalized:=normalized||pg_catalog.jsonb_build_object(key,hp);
    END LOOP;
    IF fields ? 'hp_roll' AND fields->'hp_roll'<>'null'::jsonb THEN
      IF chosen_level<=old_class_level OR NOT private.builder_exact_keys_v1(fields->'hp_roll',ARRAY['method','value']) THEN
        RAISE EXCEPTION 'builder_invalid_hp_selection' USING ERRCODE='22023'; END IF;
      hp:=private.builder_progression_hp_v1(target,(occurrence->>'id')::uuid,chosen_level,die,
        fields#>>'{hp_roll,method}',fields#>'{hp_roll,value}',cap.actor_id,operation);
      normalized:=normalized||pg_catalog.jsonb_build_object(selected_class_slug||'-'||chosen_level,hp);
    END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{hp_rolls}',normalized,true);
    -- Downgrades retire a now-unearned subclass selection and all its physical
    -- projections; the previous immutable source rows remain in history.
    SELECT min((l.value->>'level')::integer) INTO subclass_gate FROM pg_catalog.jsonb_array_elements(class_version#>'{data_snapshot,levels}') l(value)
      WHERE l.value->'subclass_level'='true'::jsonb;
    IF occurrence->'subclass_ref_id'<>'null'::jsonb AND chosen_level<COALESCE(subclass_gate,20) THEN
      removed_subclass:=(occurrence->>'subclass_ref_id')::uuid;
      next_choices:=pg_catalog.jsonb_set(next_choices,ARRAY['classes',selected_index::text],(next_choices#>ARRAY['classes',selected_index::text])-'subclass');
      expected:=pg_catalog.jsonb_set(expected,'{occurrences}',(SELECT pg_catalog.jsonb_agg(CASE WHEN value->'id'=occurrence->'id' THEN occurrence||'{"subclass_ref_id":null}'::jsonb ELSE value END ORDER BY (value->>'id')::uuid) FROM pg_catalog.jsonb_array_elements(expected->'occurrences')));
      SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO item FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') WHERE value->>'controller_ref_id'<>removed_subclass::text;
      expected:=pg_catalog.jsonb_set(expected,'{feature_grants}',item);
      SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO item FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') WHERE value->>'controller_ref_id'<>removed_subclass::text;
      expected:=pg_catalog.jsonb_set(expected,'{spell_grants}',item);
    END IF;
    SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') r(value)
      JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE e.value->>'type'='choice' AND (r.value->>'id'=removed_subclass::text OR EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'feature_grants') g(value)
          WHERE g.value->'id'=r.value->'feature_grant_id' AND ((g.value->>'controller_ref_id'=selected_controller AND (g.value->>'unlock_level')::integer>chosen_level) OR g.value->>'controller_ref_id'=removed_subclass::text)));
    next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',(next_choices->'resolved_choices')-affected,true);
    SELECT COALESCE(pg_catalog.jsonb_object_agg(a.key,a.value),'{}') INTO normalized FROM pg_catalog.jsonb_each(COALESCE(next_choices->'asi_choices','{}')) a(key,value)
      WHERE EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
        WHERE g.value->>'feature_slug'=a.key AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id'));
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',normalized,true);
  ELSIF command='save_hp_roll' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['class_slug','level','method','value']) OR fields->>'class_slug' IS DISTINCT FROM selected_class_slug
      OR pg_catalog.jsonb_typeof(fields->'level')<>'number' OR fields->>'level' !~ '^([1-9]|1[0-9]|20)$'
      OR ((fields->>'level')::integer=1 AND (occurrence->>'id')::uuid=original_id)
      OR (fields->>'level')::integer>chosen_level THEN RAISE EXCEPTION 'builder_invalid_hp_selection' USING ERRCODE='22023'; END IF;
    hp:=private.builder_progression_hp_v1(target,(occurrence->>'id')::uuid,(fields->>'level')::integer,die,fields->>'method',fields->'value',cap.actor_id,operation);
    next_choices:=pg_catalog.jsonb_set(next_choices,'{hp_rolls}',COALESCE(next_choices->'hp_rolls','{}')||pg_catalog.jsonb_build_object(selected_class_slug||'-'||(fields->>'level'),hp),true);
  ELSIF command='select_asi' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['feature_slug','choice']) OR pg_catalog.jsonb_typeof(fields->'feature_slug')<>'string'
      OR pg_catalog.jsonb_typeof(fields->'choice')<>'object' THEN RAISE EXCEPTION 'builder_invalid_asi' USING ERRCODE='22023'; END IF;
    SELECT count(*),pg_catalog.jsonb_agg(g.value)->0 INTO count_grants,selected_grant FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
      JOIN public.content_versions v ON v.content_id=(g.value->>'feature_content_id')::uuid AND v.version=(g.value->>'feature_version')::integer
      WHERE (g.value->>'controller_ref_id'=selected_controller OR g.value->>'controller_ref_id'=occurrence->>'subclass_ref_id') AND g.value->>'feature_slug'=fields->>'feature_slug' AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id') AND v.data_snapshot->>'feature_type'='asi';
    IF count_grants<>1 THEN RAISE EXCEPTION 'builder_earned_asi_required' USING ERRCODE='22023'; END IF;
    feature_source:='choice:asi:'||(selected_grant->>'id');
    SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs) WHERE value->>'choice_source' IS DISTINCT FROM feature_source;
    IF fields#>>'{choice,mode}'='asi' THEN
      allocations:=fields#>'{choice,allocations}';
      IF NOT private.builder_exact_keys_v1(fields->'choice',ARRAY['mode','allocations']) OR pg_catalog.jsonb_typeof(allocations)<>'array'
        OR pg_catalog.jsonb_array_length(allocations) NOT BETWEEN 1 AND 2 OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(allocations) a(value)
          WHERE NOT private.builder_exact_keys_v1(a.value,ARRAY['ability','amount']) OR pg_catalog.jsonb_typeof(a.value->'ability') IS DISTINCT FROM 'string' OR a.value->>'ability' NOT IN ('strength','dexterity','constitution','intelligence','wisdom','charisma')
            OR a.value->'amount' NOT IN ('1'::jsonb,'2'::jsonb))
        OR (SELECT count(DISTINCT value->>'ability') FROM pg_catalog.jsonb_array_elements(allocations))<>pg_catalog.jsonb_array_length(allocations)
        OR (SELECT sum((value->>'amount')::integer) FROM pg_catalog.jsonb_array_elements(allocations))<>2 THEN
        RAISE EXCEPTION 'builder_invalid_asi_allocations' USING ERRCODE='22023'; END IF;
      scores:=private.character_ability_scores(target,NULL,fields->>'feature_slug',feature_source);
      IF EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['strength','dexterity','constitution','intelligence','wisdom','charisma']) a(name)
        WHERE pg_catalog.jsonb_typeof(parent.base_stats->a.name) IS DISTINCT FROM 'number') THEN
        RAISE EXCEPTION 'builder_complete_base_scores_required' USING ERRCODE='22023'; END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(allocations) a(value)
        WHERE (scores->>(a.value->>'ability'))::numeric+(a.value->>'amount')::integer>20) THEN
        RAISE EXCEPTION 'builder_asi_cap_exceeded' USING ERRCODE='22023'; END IF;
      SELECT pg_catalog.jsonb_agg(value ORDER BY value->>'ability') INTO allocations FROM pg_catalog.jsonb_array_elements(allocations);
      normalized:=pg_catalog.jsonb_build_object('mode','asi','allocations',allocations);
    ELSIF fields#>>'{choice,mode}'='feat' THEN
      IF NOT private.builder_exact_keys_v1(fields->'choice',ARRAY['mode','feat_id','feat_version']) OR NOT private.builder_uuid_v1(fields#>>'{choice,feat_id}')
        OR pg_catalog.jsonb_typeof(fields#>'{choice,feat_version}')<>'number' OR fields#>>'{choice,feat_version}' !~ '^[1-9][0-9]{0,9}$' THEN
        RAISE EXCEPTION 'builder_invalid_feat' USING ERRCODE='22023'; END IF;
      SELECT v.* INTO feat FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id AND d.version=v.version
        WHERE v.content_id=(fields#>>'{choice,feat_id}')::uuid AND v.version=(fields#>>'{choice,feat_version}')::integer AND NOT d.is_retired
          AND v.system_id_snapshot=parent.system_id AND v.content_type_snapshot='feat' AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
      IF NOT FOUND THEN RAISE EXCEPTION 'builder_feat_unavailable' USING ERRCODE='42501'; END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(COALESCE(next_choices->'asi_choices','{}')) a(key,value)
        WHERE a.key<>fields->>'feature_slug' AND a.value->>'featId'=feat.content_id::text) THEN
        RAISE EXCEPTION 'builder_duplicate_feat' USING ERRCODE='22023'; END IF;
      SELECT * INTO prereq FROM private.feat_prerequisite_status(target,feat.data_snapshot,feat.content_id,feature_source);
      IF prereq.prerequisite_met IS NOT TRUE THEN RAISE EXCEPTION 'builder_feat_prerequisite_unmet' USING ERRCODE='22023'; END IF;
      scores:=private.character_ability_scores(target,feat.content_id,fields->>'feature_slug',feature_source);
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(feat.data_snapshot->'prerequisites','[]')) p(value)
        WHERE (scores->>(p.value->>'stat'))::numeric<(p.value->>'value')::numeric) THEN
        RAISE EXCEPTION 'builder_feat_prerequisite_unmet' USING ERRCODE='22023'; END IF;
      normalized:=pg_catalog.jsonb_build_object('mode','feat','featId',feat.content_id,'featVersion',feat.version,'featName',feat.name_snapshot);
      pin:=private.builder_catalog_pin_v1(target,pg_catalog.to_jsonb(feat),pg_catalog.jsonb_build_object('source','asi_feat','feature_slug',selected_grant->>'feature_slug',
        'feature_grant_id',selected_grant->>'id','feature_level',selected_grant->'unlock_level','controller_type',selected_grant->>'controller_type','controller_slug',selected_grant->>'controller_slug'),
        feature_source,NULL,cap.protected_graph->'refs');
      refs:=refs||pg_catalog.jsonb_build_array(pin);
    ELSE RAISE EXCEPTION 'builder_invalid_asi' USING ERRCODE='22023'; END IF;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',COALESCE(next_choices->'asi_choices','{}')||pg_catalog.jsonb_build_object(fields->>'feature_slug',normalized),true);
  ELSIF command='select_class_spells' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['class_slug','spells']) OR fields->>'class_slug' IS DISTINCT FROM selected_class_slug THEN
      RAISE EXCEPTION 'builder_invalid_spell_selection' USING ERRCODE='22023'; END IF;
    new_spells:=private.builder_progression_class_spells_v1(target,next_choices,chosen_level,fields->'spells',spells,selected_class_slug);
    SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells)
      WHERE NOT (value->>'class_slug'=selected_class_slug AND value->>'source'='selection');
    spells:=spells||new_spells;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{class_spell_selections}',COALESCE(next_choices->'class_spell_selections','{}')||
      pg_catalog.jsonb_build_object(selected_class_slug,fields->'spells'),true);
  ELSE RAISE EXCEPTION 'builder_progression_command_unavailable' USING ERRCODE='22023'; END IF;

  -- Activate only grant-backed immutable manifests earned at this exact level.
  SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs) r(value)
    WHERE r.value->>'id' IS DISTINCT FROM removed_subclass::text
      AND (r.value->'feature_grant_id'='null'::jsonb OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
        WHERE g.value->'id'=r.value->'feature_grant_id' AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id')))
      AND (COALESCE(r.value->>'choice_source','') NOT LIKE 'choice:asi:%' OR EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
          WHERE r.value->>'choice_source'='choice:asi:'||(g.value->>'id') AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id')))
      AND (COALESCE(r.value->>'choice_source','') NOT LIKE 'builder:fighting-style:%' OR EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
          WHERE g.value->>'feature_slug'=r.value#>>'{context,feature}' AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id')));
  FOR grant_value IN SELECT value FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') WHERE (value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,value->>'controller_ref_id') LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(refs) r(value) WHERE r.value->'feature_grant_id'=grant_value->'id') THEN CONTINUE; END IF;
    SELECT pg_catalog.to_jsonb(v) INTO definition FROM public.content_versions v
      WHERE v.content_id=(grant_value->>'feature_content_id')::uuid AND v.version=(grant_value->>'feature_version')::integer;
    pin:=private.builder_catalog_pin_v1(target,definition,pg_catalog.jsonb_build_object('source','class_feature','controller_type',grant_value->>'controller_type',
      'controller_slug',grant_value->>'controller_slug','feature_slug',grant_value->>'feature_slug','feature_level',grant_value->'unlock_level'),
      'auto:feature-grant:'||(grant_value->>'id'),(grant_value->>'id')::uuid,cap.protected_graph->'refs');
    refs:=refs||pg_catalog.jsonb_build_array(pin);
  END LOOP;
  SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells) s(value)
    WHERE s.value->>'source'<>'feature' OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') g(value)
      WHERE g.value->'id'=s.value->'spell_grant_id' AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id'));
  FOR grant_value IN SELECT DISTINCT ON (value->>'spell_content_id',value->>'class_slug') value FROM pg_catalog.jsonb_array_elements(expected->'spell_grants')
    WHERE (value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,value->>'controller_ref_id') ORDER BY value->>'spell_content_id',value->>'class_slug',(value->>'unlock_level')::integer,value->>'controller_ref_id',value->>'id' LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(spells) s(value) WHERE s.value->'content_id'=grant_value->'spell_content_id' AND s.value->'class_slug'=grant_value->'class_slug') THEN CONTINUE; END IF;
    spell.id:=pg_catalog.gen_random_uuid(); spell.character_id:=target; spell.content_id:=(grant_value->>'spell_content_id')::uuid;
    spell.content_version:=(grant_value->>'spell_version')::integer; spell.name:=grant_value->>'spell_name'; spell.class_slug:=grant_value->>'class_slug';
    spell.is_known:=false; spell.is_prepared:=true; spell.always_prepared:=true; spell.in_spellbook:=false; spell.source:='feature'; spell.custom_data:=NULL;
    spell.created_at:=pg_catalog.transaction_timestamp(); spell.spell_grant_id:=(grant_value->>'id')::uuid; spells:=spells||pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(spell));
  END LOOP;
  IF command IN ('set_class_level','select_asi') THEN
    FOR current_class IN SELECT value FROM pg_catalog.jsonb_array_elements(next_choices->'classes') LOOP
      selected_class_slug:=current_class->>'slug'; chosen_level:=(current_class->>'level')::integer;
    -- Capacity reductions keep a deterministic valid subset. Retired draft
    -- acquisitions and selections remain in the accepted history.
    normalized:='[]'; new_spells:='[]';
    FOR item IN SELECT s.value FROM pg_catalog.jsonb_array_elements(spells) s(value)
      WHERE s.value->>'source'='selection' AND s.value->>'class_slug'=selected_class_slug ORDER BY s.value->>'id' LOOP
      picked:=pg_catalog.jsonb_build_object('content_id',item->'content_id','content_version',item->'content_version','prepared',item->'is_prepared');
      BEGIN
        source:=private.builder_progression_class_spells_v1(target,next_choices,chosen_level,normalized||pg_catalog.jsonb_build_array(picked),spells,selected_class_slug);
        normalized:=normalized||pg_catalog.jsonb_build_array(picked); new_spells:=source;
      EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT IN ('builder_class_cannot_cast','builder_spell_not_on_current_list','builder_spell_selection_budget_exceeded') THEN RAISE; END IF;
      END;
    END LOOP;
    SELECT COALESCE(pg_catalog.jsonb_agg(value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells)
      WHERE NOT (value->>'source'='selection' AND value->>'class_slug'=selected_class_slug);
    spells:=spells||new_spells;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{class_spell_selections}',COALESCE(next_choices->'class_spell_selections','{}')||
      pg_catalog.jsonb_build_object(selected_class_slug,normalized),true);
    END LOOP;
  END IF;
  expected:=expected||pg_catalog.jsonb_build_object('refs',refs,'spells',spells);
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO item FROM pg_catalog.jsonb_array_elements(expected->domain);
    expected:=pg_catalog.jsonb_set(expected,ARRAY[domain],item);
  END LOOP;
  -- The draft can contain a stored current HP value. Clamp it to the same
  -- per-level die-plus-CON formula used by computeMaxHp, preserving missing HP.
  SELECT sum((value->>'level')::integer) INTO total_level FROM pg_catalog.jsonb_array_elements(next_choices->'classes');
  IF total_level NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'builder_total_level_exceeded' USING ERRCODE='22023'; END IF;
  IF next_state ? 'current_hp' THEN
    max_hp:=private.builder_multiclass_max_hp_v1(target,next_choices,expected);
    next_state:=pg_catalog.jsonb_set(next_state,'{current_hp}',pg_catalog.to_jsonb(LEAST((next_state->>'current_hp')::integer,max_hp)));
  END IF;
  IF pg_catalog.octet_length(expected::text)>8388608 THEN RAISE EXCEPTION 'builder_progression_graph_bound' USING ERRCODE='54000'; END IF;
  next_choices:=private.normalize_builder_expertise_v1(target,next_choices,
    refs||(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot IN ('race','subrace','background')),NULL);
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->'classes',expected_choices=next_choices,
    expected_level=total_level,expected_state=next_state WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.apply_builder_progression_graph_v1(target,next_choices,next_state,total_level);
END $$;

CREATE OR REPLACE FUNCTION private.builder_progression_class_spells_v1(target uuid,choices jsonb,level integer,requested jsonb,prior jsonb,selected_class_slug text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE class_slug text; controller jsonb; definition jsonb; row_config jsonb; known jsonb; spell_list jsonb;
  max_spell_level integer:=0; cantrip_limit integer; known_limit integer; prepared_limit integer; casting_ability text;
  scores jsonb; cantrips integer:=0; learned integer:=0; prepared_count integer:=0; entry jsonb; existing jsonb; result jsonb:='[]';
  selected public.content_versions%ROWTYPE; spell_row public.character_spells%ROWTYPE; spell_level integer; prepare boolean; wizard boolean; prepared_caster boolean;
BEGIN
  class_slug:=selected_class_slug;
  SELECT pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v) INTO controller,definition FROM public.character_content_refs r JOIN public.content_versions v
    ON v.content_id=r.content_id AND v.version=r.content_version WHERE r.character_id=target AND v.content_type_snapshot='class' AND v.slug_snapshot=class_slug;
  SELECT value->'spellcasting' INTO row_config FROM pg_catalog.jsonb_array_elements(definition#>'{data_snapshot,levels}') WHERE value->>'level'=level::text;
  IF row_config IS NULL OR row_config='null'::jsonb THEN
    IF requested<>'[]'::jsonb THEN RAISE EXCEPTION 'builder_class_cannot_cast' USING ERRCODE='22023'; END IF; RETURN result;
  END IF;
  SELECT COALESCE(max(position::integer),0) INTO max_spell_level
    FROM pg_catalog.jsonb_array_elements(row_config->'spell_slots') WITH ORDINALITY slots(value,position) WHERE (value#>>'{}')::integer>0;
  known:=definition#>'{data_snapshot,spellcastingKnown}'; spell_list:=COALESCE(definition#>'{data_snapshot,spellcastingList}',pg_catalog.jsonb_build_object('class',class_slug,'level',ARRAY[0,9]));
  cantrip_limit:=COALESCE((known#>>ARRAY['cantrips',(level-1)::text])::integer,0);
  prepared_caster:=known->'prepared'='true'::jsonb; wizard:=class_slug='wizard';
  IF known->'spells'='"all"'::jsonb OR known->'spells' IS NULL THEN known_limit:=200;
  ELSE known_limit:=COALESCE((known#>>ARRAY['spells',(level-1)::text])::integer,0); END IF;
  IF wizard THEN known_limit:=6+2*(level-1); END IF;
  casting_ability:=definition#>>'{data_snapshot,spellcasting,ability}';
  scores:=private.builder_progression_scores_v1(target,choices);
  IF prepared_caster THEN
    IF NOT scores ? casting_ability THEN RAISE EXCEPTION 'builder_casting_ability_unavailable' USING ERRCODE='22023'; END IF;
    prepared_limit:=GREATEST(1,CASE WHEN class_slug='paladin' THEN level/2 ELSE level END+floor(((scores->>casting_ability)::numeric-10)/2)::integer);
  ELSE prepared_limit:=0; END IF;
  IF pg_catalog.jsonb_typeof(requested)<>'array' OR pg_catalog.jsonb_array_length(requested)>200
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(requested) p(value) GROUP BY value->>'content_id' HAVING count(*)<>1) THEN
    RAISE EXCEPTION 'builder_invalid_spell_selection' USING ERRCODE='22023'; END IF;
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(requested) LOOP
    IF NOT private.builder_exact_keys_v1(entry,ARRAY['content_id','content_version','prepared'])
      OR NOT private.builder_uuid_v1(entry->>'content_id') OR pg_catalog.jsonb_typeof(entry->'content_version')<>'number'
      OR entry->>'content_version' !~ '^[1-9][0-9]{0,9}$' OR (entry->>'content_version')::numeric>2147483647
      OR pg_catalog.jsonb_typeof(entry->'prepared')<>'boolean' THEN RAISE EXCEPTION 'builder_invalid_spell_selection' USING ERRCODE='22023'; END IF;
    SELECT v.* INTO selected FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id
      WHERE v.content_id=(entry->>'content_id')::uuid AND v.version=(entry->>'content_version')::integer AND NOT d.is_retired
        AND v.content_type_snapshot='spell' AND v.system_id_snapshot=(definition->>'system_id_snapshot')::uuid
        AND (d.version=v.version OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(prior) p(value)
          WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version' AND p.value->>'class_slug'=class_slug))
        AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
    IF NOT FOUND THEN RAISE EXCEPTION 'builder_spell_unavailable' USING ERRCODE='42501'; END IF;
    spell_level:=(selected.data_snapshot->>'level')::integer; prepare:=(entry->>'prepared')::boolean;
    IF NOT COALESCE(selected.data_snapshot->'classes','[]') @> pg_catalog.jsonb_build_array(spell_list->>'class')
      OR spell_level>max_spell_level OR spell_level<(spell_list#>>'{level,0}')::integer OR spell_level>(spell_list#>>'{level,1}')::integer THEN
      RAISE EXCEPTION 'builder_spell_not_on_current_list' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(prior) p(value)
      WHERE p.value->'content_id'=entry->'content_id' AND p.value->>'class_slug'=class_slug AND p.value->>'source'<>'selection') THEN
      RAISE EXCEPTION 'builder_spell_already_granted' USING ERRCODE='22023'; END IF;
    IF spell_level=0 THEN cantrips:=cantrips+1; prepare:=true;
    ELSE learned:=learned+1; IF prepare THEN prepared_count:=prepared_count+1; END IF;
      IF NOT prepared_caster AND prepare THEN RAISE EXCEPTION 'builder_known_spell_preparation_unavailable' USING ERRCODE='22023'; END IF;
    END IF;
    SELECT p.value INTO existing FROM pg_catalog.jsonb_array_elements(prior) p(value)
      WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version'
        AND p.value->>'class_slug'=class_slug AND p.value->>'source'='selection'
        AND p.value#>>'{custom_data,builder_class_controller_ref_id}'=controller->>'id';
    IF existing IS NULL THEN
      spell_row.id:=pg_catalog.gen_random_uuid(); spell_row.character_id:=target; spell_row.content_id:=selected.content_id; spell_row.content_version:=selected.version;
      spell_row.name:=selected.name_snapshot; spell_row.class_slug:=class_slug; spell_row.is_known:=true; spell_row.is_prepared:=prepare;
      spell_row.always_prepared:=false; spell_row.in_spellbook:=wizard AND spell_level>0; spell_row.source:='selection';
      spell_row.custom_data:=pg_catalog.jsonb_build_object('builder_class_controller_ref_id',controller->>'id');
      spell_row.created_at:=pg_catalog.transaction_timestamp(); spell_row.spell_grant_id:=NULL; existing:=pg_catalog.to_jsonb(spell_row);
    ELSE existing:=existing||pg_catalog.jsonb_build_object('is_prepared',prepare); END IF;
    result:=result||pg_catalog.jsonb_build_array(existing);
  END LOOP;
  IF cantrips>cantrip_limit OR learned>known_limit OR prepared_count>prepared_limit THEN
    RAISE EXCEPTION 'builder_spell_selection_budget_exceeded' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION private.normalize_builder_expertise_v1(target uuid,pending_choices jsonb,active_refs jsonb,strict_choice_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE source jsonb; sources jsonb; effect jsonb; definitions jsonb:='[]'; definition jsonb; selections jsonb;
  eligible text[]:='{}'; fixed_expertise text[]:='{}'; proficiency text; field text; chosen jsonb;
  choices_map jsonb; normalized jsonb; claims jsonb:='[]'; accepted jsonb; choice_id text; class_allowed boolean;
  valid boolean; count_sources integer; strict_expertise boolean; item record;
BEGIN
  IF pg_catalog.jsonb_typeof(pending_choices) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(active_refs) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(active_refs)>4096
    OR pg_catalog.octet_length(active_refs::text)>8388608
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(active_refs) r(value)
      WHERE r.value->>'character_id' IS DISTINCT FROM target::text)
    OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(active_refs))<>pg_catalog.jsonb_array_length(active_refs) THEN
    RAISE EXCEPTION 'builder_expertise_sources_unavailable' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(private.builder_role_definition_v1(target,pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(v))),'[]') INTO sources
    FROM pg_catalog.jsonb_array_elements(active_refs) r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer;
  IF pg_catalog.jsonb_array_length(sources)<>pg_catalog.jsonb_array_length(active_refs) THEN
    RAISE EXCEPTION 'builder_expertise_sources_unavailable' USING ERRCODE='23514'; END IF;
  choices_map:=COALESCE(pending_choices->'resolved_choices','{}');
  IF pg_catalog.jsonb_typeof(choices_map) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'builder_expertise_choices_unavailable' USING ERRCODE='23514'; END IF;

  FOR source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources) LOOP
    class_allowed:=true;
    FOR effect IN SELECT value FROM pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(source->'effects_snapshot')='array' THEN source->'effects_snapshot' ELSE '[]' END) LOOP
      IF effect->>'type'='choice' THEN
        -- Include every active definition in uniqueness checks. A non-Expertise
        -- effect with the same ID cannot lend authority to an Expertise choice.
        definitions:=definitions||pg_catalog.jsonb_build_array(effect||pg_catalog.jsonb_build_object('_class_allowed',class_allowed));
      ELSIF effect->>'type'='grant' AND class_allowed THEN
        proficiency:=private.builder_expertise_proficiency_v1(effect->>'stat');
        IF proficiency IS NOT NULL AND effect->>'value'='proficient' THEN eligible:=array_append(eligible,proficiency);
        ELSIF proficiency IS NOT NULL AND effect->>'value'='expertise' THEN fixed_expertise:=array_append(fixed_expertise,proficiency); END IF;
      END IF;
    END LOOP;
    IF NOT class_allowed THEN CONTINUE; END IF;
    FOREACH field IN ARRAY CASE WHEN source->>'content_type_snapshot'='class'
      THEN ARRAY['skills','toolProfs','starting_proficiencies'] ELSE ARRAY['skills','toolProfs'] END LOOP
      FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(
        CASE WHEN pg_catalog.jsonb_typeof(source#>ARRAY['data_snapshot',field])='array'
          THEN source#>ARRAY['data_snapshot',field] ELSE '[]' END) LOOP
        IF pg_catalog.jsonb_typeof(chosen)='string' THEN
          proficiency:=private.builder_expertise_proficiency_v1(chosen#>>'{}');
          IF proficiency IS NOT NULL THEN eligible:=array_append(eligible,proficiency); END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- A saved proficiency choice is authority only when one active immutable
  -- source owns its ID and its complete saved selection is valid and finite.
  FOR definition IN SELECT value FROM pg_catalog.jsonb_array_elements(definitions)
    WHERE value->>'grant_type' IN ('proficiency','skill','tool') AND value->'_class_allowed'='true'::jsonb LOOP
    choice_id:=definition->>'choice_id'; selections:=choices_map->choice_id;
    SELECT count(*) INTO count_sources FROM pg_catalog.jsonb_array_elements(definitions) d(value) WHERE d.value->>'choice_id'=choice_id;
    IF count_sources<>1 OR COALESCE(definition->>'choose','') !~ '^[1-9][0-9]{0,2}$'
      OR pg_catalog.jsonb_typeof(definition->'from') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_typeof(selections) IS DISTINCT FROM 'array' THEN CONTINUE; END IF;
    IF pg_catalog.jsonb_array_length(selections)>(definition->>'choose')::integer
      OR (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(selections))<>pg_catalog.jsonb_array_length(selections)
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selections) s(value)
        WHERE pg_catalog.jsonb_typeof(s.value) IS DISTINCT FROM 'string' OR length(s.value#>>'{}') NOT BETWEEN 1 AND 300
          OR NOT (definition->'from') @> pg_catalog.jsonb_build_array(s.value)) THEN CONTINUE; END IF;
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(selections) LOOP
      proficiency:=private.builder_expertise_proficiency_v1(chosen#>>'{}');
      IF proficiency IS NOT NULL THEN eligible:=array_append(eligible,proficiency); END IF;
    END LOOP;
  END LOOP;

  -- Collect valid active Expertise claims before pruning. Duplicate values are
  -- removed from every source, so traversal order can never decide a winner.
  FOR definition IN SELECT value FROM pg_catalog.jsonb_array_elements(definitions) WHERE value->>'grant_type'='expertise' LOOP
    choice_id:=definition->>'choice_id'; selections:=choices_map->choice_id;
    strict_expertise:=strict_choice_id IS NOT NULL AND choice_id=strict_choice_id;
    IF choice_id IS NULL OR NOT choices_map ? choice_id THEN
      IF strict_expertise THEN RAISE EXCEPTION 'builder_expertise_unavailable' USING ERRCODE='22023'; END IF;
      CONTINUE;
    END IF;
    SELECT count(*) INTO count_sources FROM pg_catalog.jsonb_array_elements(definitions) d(value) WHERE d.value->>'choice_id'=choice_id;
    valid:=count_sources=1 AND definition->'_class_allowed'='true'::jsonb
      AND COALESCE(definition->>'choose','') ~ '^[1-9][0-9]{0,2}$'
      AND pg_catalog.jsonb_typeof(definition->'from')='array' AND pg_catalog.jsonb_typeof(selections)='array';
    IF valid THEN
      valid:=pg_catalog.jsonb_array_length(selections)<=(definition->>'choose')::integer
        AND (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(selections))=pg_catalog.jsonb_array_length(selections)
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selections) s(value)
          WHERE pg_catalog.jsonb_typeof(s.value) IS DISTINCT FROM 'string'
            OR private.builder_expertise_proficiency_v1(s.value#>>'{}') IS DISTINCT FROM s.value#>>'{}'
            OR NOT (definition->'from') @> pg_catalog.jsonb_build_array(s.value));
    END IF;
    IF valid IS NOT TRUE THEN
      IF strict_expertise THEN RAISE EXCEPTION 'builder_expertise_unavailable' USING ERRCODE='22023'; END IF;
      choices_map:=pg_catalog.jsonb_set(choices_map,ARRAY[choice_id],'[]'::jsonb,true);
      CONTINUE;
    END IF;
    claims:=claims||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('choice_id',choice_id,'selections',selections));
  END LOOP;
  normalized:=choices_map;
  FOR item IN SELECT value->>'choice_id' AS choice_id,value->'selections' AS selections FROM pg_catalog.jsonb_array_elements(claims) LOOP
    accepted:='[]';
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(item.selections) LOOP
      proficiency:=chosen#>>'{}';
      IF proficiency=ANY(eligible) AND NOT proficiency=ANY(fixed_expertise)
        AND (SELECT count(*) FROM pg_catalog.jsonb_array_elements(claims) c(value)
          CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(c.value->'selections') s(value) WHERE s.value=chosen)=1 THEN
        accepted:=accepted||pg_catalog.jsonb_build_array(chosen);
      END IF;
    END LOOP;
    IF strict_choice_id IS NOT NULL AND item.choice_id=strict_choice_id AND accepted IS DISTINCT FROM item.selections THEN
      RAISE EXCEPTION 'builder_expertise_unavailable' USING ERRCODE='22023'; END IF;
    normalized:=pg_catalog.jsonb_set(normalized,ARRAY[item.choice_id],accepted,true);
  END LOOP;
  IF normalized IS NOT DISTINCT FROM pending_choices->'resolved_choices' THEN RETURN pending_choices; END IF;
  IF normalized='{}'::jsonb AND NOT pending_choices ? 'resolved_choices' THEN RETURN pending_choices; END IF;
  RETURN pg_catalog.jsonb_set(pending_choices,'{resolved_choices}',normalized,true);
END $$;


ALTER TABLE private.character_builder_progression_history_v1 DROP CONSTRAINT character_builder_progression_history_v1_command_check;
ALTER TABLE private.character_builder_progression_history_v1 ADD CONSTRAINT character_builder_progression_history_v1_command_check
  CHECK(command IN ('add_class','set_class_level','save_hp_roll','select_asi','select_class_spells'));
ALTER TABLE private.character_builder_hp_draws_v1 DROP CONSTRAINT character_builder_hp_draws_v1_level_check;
ALTER TABLE private.character_builder_hp_draws_v1 ADD CONSTRAINT character_builder_hp_draws_v1_level_check CHECK(level BETWEEN 1 AND 20);
DO $occurrence_insert_profile$
DECLARE original pg_catalog.pg_proc%ROWTYPE; replacement text; needle text;
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid='private.class_origin_protected_row_guard_v1()'::pg_catalog.regprocedure;
  needle:='IF TG_TABLE_SCHEMA=''private'' AND TG_TABLE_NAME=''character_class_occurrences_v1'' AND TG_OP=''UPDATE''
    AND private.builder_catalog_occurrence_transition_v1(pg_catalog.to_jsonb(OLD),pg_catalog.to_jsonb(NEW)) THEN RETURN NEW; END IF;';
  IF original.proowner<>'inkborne_class_origin_owner'::pg_catalog.regrole OR NOT original.prosecdef
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR (length(original.prosrc)-length(pg_catalog.replace(original.prosrc,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_occurrence_insert_profile_changed' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(original.prosrc,needle,
    'IF TG_TABLE_SCHEMA=''private'' AND TG_TABLE_NAME=''character_class_occurrences_v1'' AND TG_OP IN (''INSERT'',''UPDATE'')
    AND private.builder_catalog_occurrence_transition_v1(CASE WHEN TG_OP=''UPDATE'' THEN pg_catalog.to_jsonb(OLD) END,pg_catalog.to_jsonb(NEW)) THEN RETURN NEW; END IF;');
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
END $occurrence_insert_profile$;

CREATE OR REPLACE FUNCTION private.builder_progression_hp_v1(target uuid,occurrence uuid,selected_level integer,die integer,method text,requested_value jsonb,actor uuid,operation uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE accepted integer; sample integer; draw private.character_builder_hp_draws_v1%ROWTYPE;
BEGIN
  IF selected_level NOT BETWEEN 1 AND 20 OR die NOT IN (4,6,8,10,12) OR method IS NULL OR method NOT IN ('average','manual','rolled') THEN
    RAISE EXCEPTION 'builder_invalid_hp_selection' USING ERRCODE='22023'; END IF;
  IF method='average' THEN
    accepted:=die/2+1;
    IF requested_value IS DISTINCT FROM 'null'::jsonb AND requested_value IS DISTINCT FROM pg_catalog.to_jsonb(accepted) THEN
      RAISE EXCEPTION 'builder_invalid_hp_average' USING ERRCODE='22023'; END IF;
  ELSIF method='manual' THEN
    IF pg_catalog.jsonb_typeof(requested_value)<>'number' OR requested_value#>>'{}' !~ '^[1-9][0-9]?$'
      OR (requested_value#>>'{}')::integer>die THEN RAISE EXCEPTION 'builder_invalid_hp_manual' USING ERRCODE='22023'; END IF;
    accepted:=(requested_value#>>'{}')::integer;
  ELSE
    IF requested_value IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'builder_hp_roll_is_server_generated' USING ERRCODE='22023'; END IF;
    SELECT * INTO draw FROM private.character_builder_hp_draws_v1 WHERE character_id=target AND occurrence_id=occurrence AND level=selected_level;
    IF FOUND THEN
      IF draw.die<>die OR draw.actor_id<>actor THEN RAISE EXCEPTION 'builder_hp_draw_identity_changed' USING ERRCODE='23514'; END IF;
      accepted:=draw.value;
    ELSE
      -- UUID v4 byte zero is an unmodified uniformly random byte. Rejection
      -- sampling avoids modulo bias; the accepted draw is retained permanently.
      LOOP
        sample:=pg_catalog.get_byte(pg_catalog.decode(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),'hex'),0);
        EXIT WHEN sample<256-mod(256,die);
      END LOOP;
      accepted:=1+mod(sample,die);
      INSERT INTO private.character_builder_hp_draws_v1(character_id,occurrence_id,level,actor_id,operation_id,die,value,created_at)
        VALUES(target,occurrence,selected_level,actor,operation,die,accepted,pg_catalog.transaction_timestamp());
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('method',method,'value',accepted);
END $$;

CREATE OR REPLACE FUNCTION private.check_builder_progression_history_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE current_parent jsonb; current_order jsonb; stored private.character_builder_receipts_v1%ROWTYPE; domain text; ids jsonb;
BEGIN
  SELECT pg_catalog.to_jsonb(c) INTO current_parent FROM public.characters c WHERE c.id=NEW.character_id AND c.user_id=NEW.actor_id;
  SELECT pg_catalog.to_jsonb(o) INTO current_order FROM private.character_projection_order_v1 o WHERE o.character_id=NEW.character_id;
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  IF NOT FOUND OR stored.character_id<>NEW.character_id OR stored.receipt IS DISTINCT FROM NEW.receipt
    OR stored.request->>'command' IS DISTINCT FROM NEW.command OR NEW.before_parent->>'user_id'<>NEW.actor_id::text
    OR current_parent IS DISTINCT FROM NEW.after_parent OR current_order IS DISTINCT FROM NEW.after_order
    OR private.builder_progression_full_graph_v1(NEW.character_id) IS DISTINCT FROM NEW.after_graph
    OR NEW.receipt->'saved_choices' IS DISTINCT FROM current_parent->'choices'
    OR NEW.receipt->>'action_revision' IS DISTINCT FROM current_parent->>'action_revision'
    OR NEW.after_graph->'origin' IS DISTINCT FROM NEW.before_graph->'origin'
    OR NEW.after_graph->'commands' IS DISTINCT FROM NEW.before_graph->'commands'
    OR pg_catalog.jsonb_array_length(NEW.after_graph->'occurrences')<>pg_catalog.jsonb_array_length(NEW.before_graph->'occurrences')+CASE WHEN NEW.command='add_class' THEN 1 ELSE 0 END
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.before_graph->'occurrences') b(value) WHERE NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.after_graph->'occurrences') a(value) WHERE (a.value-'subclass_ref_id')=(b.value-'subclass_ref_id')))
    OR current_order->>'producer_revision' IS DISTINCT FROM current_parent->>'action_revision' THEN
    RAISE EXCEPTION 'builder_progression_history_closure_failed' USING ERRCODE='23514'; END IF;
  FOREACH domain IN ARRAY ARRAY['refs','inventory','spells','feature_grants','spell_grants'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(value->'id' ORDER BY (value->>'id')::uuid),'[]') INTO ids FROM pg_catalog.jsonb_array_elements(NEW.after_graph->domain);
    IF ids IS DISTINCT FROM (SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value#>>'{}')::uuid),'[]')
      FROM pg_catalog.jsonb_array_elements(current_order->(CASE domain WHEN 'refs' THEN 'pins' ELSE domain END))) THEN
      RAISE EXCEPTION 'builder_progression_order_bijection_failed' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; command text; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; receipt jsonb; before_graph jsonb; after_graph jsonb; before_order jsonb; after_order jsonb;
BEGIN
  command:=p_request->>'command';
  IF command IS NULL OR command NOT IN ('add_class','set_class_level','save_hp_roll','select_asi','select_class_spells') THEN
    RETURN public.character_builder_command_before_progression_v1(p_context,p_request);
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
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,command);
  before_graph:=private.builder_progression_full_graph_v1(target);
  SELECT c.before_order INTO before_order FROM private.character_builder_capabilities_v1 c WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF command='add_class' THEN PERFORM private.prepare_builder_acquisition_v1(target,operation,p_request->'fields');
  ELSE PERFORM private.prepare_builder_progression_v1(target,operation,command,p_request->'fields'); END IF;
  saved:=private.finish_builder_step_v1(p_context,target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command',command,'fields',p_request->'fields',
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  after_graph:=private.builder_progression_full_graph_v1(target);
  SELECT pg_catalog.to_jsonb(o) INTO after_order FROM private.character_projection_order_v1 o WHERE o.character_id=target;
  INSERT INTO private.character_builder_progression_history_v1(actor_id,operation_id,character_id,command,before_parent,after_parent,
    before_graph,after_graph,before_order,after_order,receipt,created_at)
    VALUES(parent.user_id,operation,target,command,pg_catalog.to_jsonb(parent),pg_catalog.to_jsonb(saved),before_graph,after_graph,before_order,after_order,receipt,pg_catalog.transaction_timestamp());
  PERFORM private.lock_builder_character_rows_v1(p_context,target);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;

CREATE FUNCTION private.check_builder_acquisition_closure_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE history private.character_builder_progression_history_v1%ROWTYPE;
BEGIN
  SELECT * INTO history FROM private.character_builder_progression_history_v1 WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  IF NOT FOUND OR history.character_id<>NEW.character_id OR history.command<>'add_class'
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(history.after_graph->'occurrences') o(value)
      WHERE o.value->>'id'=NEW.occurrence_id::text AND o.value->>'controller_ref_id'=NEW.controller_ref_id::text
        AND o.value->>'content_id'=NEW.content_id::text AND o.value->>'content_version'=NEW.content_version::text
        AND o.value->>'acquired_character_level'=NEW.acquired_character_level::text
        AND o.value->>'acquisition_operation_id'=NEW.operation_id::text)
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(history.before_graph->'occurrences') o(value) WHERE o.value->>'id'=NEW.occurrence_id::text) THEN
    RAISE EXCEPTION 'builder_acquisition_history_closure_failed' USING ERRCODE='23514'; END IF;
  PERFORM private.builder_class_roles_v1(NEW.character_id);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER builder_acquisition_closure AFTER INSERT ON private.character_builder_class_acquisitions_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_builder_acquisition_closure_v1();

DO $closure$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.builder_original_occurrence_v1(uuid)','private.builder_class_role_profile_v1(jsonb,text)',
    'private.builder_controller_level_v1(jsonb,jsonb,text)','private.builder_acquisition_prerequisite_v1(uuid,jsonb)',
    'private.builder_class_roles_v1(uuid)','public.character_builder_class_role_projection_v1(jsonb,uuid)',
    'private.builder_role_definition_v1(uuid,jsonb,jsonb)','private.builder_class_effects_v1(uuid,jsonb,jsonb)',
    'private.builder_command_class_v1(uuid,text,jsonb)','private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)',
    'private.prepare_builder_acquisition_v1(uuid,uuid,jsonb)','private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)',
    'private.builder_catalog_occurrence_transition_v1(jsonb,jsonb)','private.apply_builder_catalog_command_v1(uuid,text,jsonb)',
    'private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)','private.builder_progression_class_spells_v1(uuid,jsonb,integer,jsonb,jsonb,text)',
    'private.normalize_builder_expertise_v1(uuid,jsonb,jsonb,text)','private.builder_progression_hp_v1(uuid,uuid,integer,integer,text,jsonb,uuid,uuid)',
    'private.check_builder_progression_history_v1()','public.character_builder_command_v1(jsonb,jsonb)','private.check_builder_acquisition_closure_v1()'
  ] LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner',signature);
  END LOOP;
END $closure$;
-- Reuse the original isolated role's existing journal SELECT visibility.
-- No new private journal/table privilege is added to postgres or callers.
ALTER FUNCTION private.builder_original_occurrence_v1(uuid) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.builder_original_occurrence_v1(uuid) FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.builder_original_occurrence_v1(uuid) TO postgres,inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION private.builder_catalog_occurrence_transition_v1(jsonb,jsonb) TO inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb),public.character_builder_class_role_projection_v1(jsonb,uuid) TO authenticated;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_class_role_projection_v1(jsonb,uuid)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_class_role_projection_v1(jsonb,uuid)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_multiclass_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
