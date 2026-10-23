-- Disposable native companion after character-builder-expanded-spells.sql.
-- A secondary builder acquisition may end. Its original immutable acquisition,
-- accepted receipts, rolls and history remain; the starting class stays fixed.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_class_removal_v1(uuid,jsonb)') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_expanded_spells_v1(uuid,jsonb,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_class_removal_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

CREATE FUNCTION private.apply_builder_end_occurrence_v1(target uuid,after_row jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap jsonb;
BEGIN
  cap:=private.read_builder_capability_v1(target);
  IF cap IS NULL OR cap->>'command'<>'remove_class' OR after_row->>'character_id' IS DISTINCT FROM target::text
    OR after_row->>'lifecycle' IS DISTINCT FROM 'ended' OR after_row->'ended_at'='null'::jsonb
    OR NOT (cap#>'{expected_graph,occurrences}') @> pg_catalog.jsonb_build_array(after_row)
    OR after_row->'id'=private.builder_original_occurrence_v1(target)->'id' THEN
    RAISE EXCEPTION 'builder_class_removal_plan_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap->'context',target);
  UPDATE private.character_class_occurrences_v1 o SET lifecycle='ended',ended_at=(after_row->>'ended_at')::timestamptz
    WHERE o.id=(after_row->>'id')::uuid AND o.character_id=target
      AND (cap#>'{protected_graph,occurrences}') @> pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(o));
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_class_removal_occurrence_unavailable' USING ERRCODE='42501'; END IF;
END $$;
ALTER FUNCTION private.apply_builder_end_occurrence_v1(uuid,jsonb) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.apply_builder_end_occurrence_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.apply_builder_end_occurrence_v1(uuid,jsonb) TO postgres;

CREATE FUNCTION private.prepare_builder_class_removal_v1(target uuid,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE; original jsonb; occurrence jsonb;
  expected jsonb; refs jsonb; features jsonb; grants jsonb; spells jsonb; next_choices jsonb; next_state jsonb; compiled jsonb;
  controllers text[]; removed_features text[]; removed_grants text[]; removed_refs text[]; affected_choices text[]; prior_count integer;
  class_slug text; entry jsonb; item jsonb; current_class jsonb; normalized jsonb; new_spells jsonb; candidate jsonb; domain text; total_level integer;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>'remove_class' THEN RAISE EXCEPTION 'builder_class_removal_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  IF NOT private.builder_exact_keys_v1(fields,ARRAY['occurrence_id','expected_action_revision']) OR NOT private.builder_uuid_v1(fields->>'occurrence_id')
    OR pg_catalog.jsonb_typeof(fields->'expected_action_revision')<>'string' OR fields->>'expected_action_revision' !~ '^(0|[1-9][0-9]{0,18})$' THEN
    RAISE EXCEPTION 'builder_invalid_class_removal' USING ERRCODE='22023'; END IF;
  IF fields->>'expected_action_revision' IS DISTINCT FROM parent.action_revision::text THEN
    RAISE EXCEPTION 'builder_stale_action_revision' USING ERRCODE='22023'; END IF;
  PERFORM private.builder_class_roles_v1(target);
  original:=private.builder_original_occurrence_v1(target);
  IF fields->>'occurrence_id'=original->>'id' THEN RAISE EXCEPTION 'builder_starting_class_is_fixed' USING ERRCODE='22023'; END IF;
  SELECT o.value INTO occurrence FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'occurrences') o(value)
    WHERE o.value->>'id'=fields->>'occurrence_id' AND o.value->>'lifecycle'='accepted'
      AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(parent.choices->'classes') c(value) WHERE c.value->'occurrence_id'=o.value->'id');
  IF occurrence IS NULL THEN RAISE EXCEPTION 'builder_added_class_unavailable' USING ERRCODE='22023'; END IF;
  class_slug:=occurrence->>'class_slug'; controllers:=pg_catalog.array_remove(ARRAY[occurrence->>'controller_ref_id',occurrence->>'subclass_ref_id'],NULL);
  expected:=cap.protected_graph; next_choices:=parent.choices; next_state:=parent.state;
  SELECT COALESCE(array_agg(g.value->>'id'),'{}') INTO removed_features FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value)
    WHERE g.value->>'controller_ref_id'=ANY(controllers);
  SELECT COALESCE(array_agg(g.value->>'id'),'{}') INTO removed_grants FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') g(value)
    WHERE g.value->>'controller_ref_id'=ANY(controllers);
  SELECT COALESCE(array_agg(r.value->>'id'),'{}') INTO removed_refs FROM pg_catalog.jsonb_array_elements(expected->'refs') r(value)
    WHERE r.value->>'id'=ANY(controllers) OR r.value->>'feature_grant_id'=ANY(removed_features)
      OR r.value->>'choice_source'=ANY(SELECT 'choice:asi:'||pg_catalog.unnest(removed_features));
  -- Retire source-owned descendants without following catalog heads. Existing
  -- immutable child refs explicitly identify their source/controller/class.
  LOOP
    prior_count:=cardinality(removed_refs);
    SELECT COALESCE(array_agg(DISTINCT r.value->>'id'),'{}') INTO removed_refs FROM pg_catalog.jsonb_array_elements(expected->'refs') r(value)
      WHERE r.value->>'id'=ANY(removed_refs) OR r.value#>>'{context,source_ref_id}'=ANY(removed_refs)
        OR r.value#>>'{context,root_controller_ref_id}'=ANY(removed_refs)
        OR (r.value#>>'{context,class}'=class_slug AND r.value->>'choice_source' LIKE 'builder:%');
    EXIT WHEN cardinality(removed_refs)=prior_count;
  END LOOP;
  SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(expected->'refs') r(value) WHERE NOT r.value->>'id'=ANY(removed_refs);
  SELECT COALESCE(pg_catalog.jsonb_agg(g.value),'[]') INTO features FROM pg_catalog.jsonb_array_elements(expected->'feature_grants') g(value) WHERE NOT g.value->>'id'=ANY(removed_features);
  SELECT COALESCE(pg_catalog.jsonb_agg(g.value),'[]') INTO grants FROM pg_catalog.jsonb_array_elements(expected->'spell_grants') g(value) WHERE NOT g.value->>'id'=ANY(removed_grants);
  SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(expected->'spells') s(value)
    WHERE s.value->>'class_slug' IS DISTINCT FROM class_slug AND NOT COALESCE(s.value->>'spell_grant_id','')=ANY(removed_grants)
      AND NOT COALESCE(s.value#>>'{custom_data,builder_class_controller_ref_id}','')=ANY(controllers);
  SELECT COALESCE(pg_catalog.jsonb_agg(c.value ORDER BY c.position),'[]') INTO normalized
    FROM pg_catalog.jsonb_array_elements(next_choices->'classes') WITH ORDINALITY c(value,position) WHERE c.value->>'occurrence_id'<>fields->>'occurrence_id';
  next_choices:=pg_catalog.jsonb_set(next_choices,'{classes}',normalized);
  IF next_choices ? 'class_spell_selections' THEN next_choices:=pg_catalog.jsonb_set(next_choices,'{class_spell_selections}',(next_choices->'class_spell_selections')-class_slug); END IF;
  IF next_choices ? 'hp_rolls' THEN
    SELECT COALESCE(pg_catalog.jsonb_object_agg(h.key,h.value),'{}') INTO normalized FROM pg_catalog.jsonb_each(next_choices->'hp_rolls') h(key,value)
      WHERE h.key NOT LIKE class_slug||'-%';
    next_choices:=pg_catalog.jsonb_set(next_choices,'{hp_rolls}',normalized);
  END IF;
  SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO affected_choices
    FROM pg_catalog.jsonb_array_elements(expected->'refs') r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE r.value->>'id'=ANY(removed_refs) AND e.value->>'type'='choice' AND NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_array_elements(refs) kept(value) JOIN public.content_versions kv
        ON kv.content_id=(kept.value->>'content_id')::uuid AND kv.version=(kept.value->>'content_version')::integer
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(kv.effects_snapshot) ke(value)
      WHERE ke.value->>'type'='choice' AND ke.value->>'choice_id'=e.value->>'choice_id');
  IF next_choices ? 'resolved_choices' THEN next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',(next_choices->'resolved_choices')-affected_choices); END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN o.value->'id'=occurrence->'id'
    THEN o.value||pg_catalog.jsonb_build_object('lifecycle','ended','ended_at',pg_catalog.transaction_timestamp()) ELSE o.value END),'[]') INTO normalized
    FROM pg_catalog.jsonb_array_elements(expected->'occurrences') o(value);
  expected:=expected||pg_catalog.jsonb_build_object('refs',refs,'feature_grants',features,'spell_grants',grants,'spells',spells,'occurrences',normalized);
  IF next_choices ? 'asi_choices' THEN
    SELECT COALESCE(pg_catalog.jsonb_object_agg(a.key,a.value),'{}') INTO normalized FROM pg_catalog.jsonb_each(next_choices->'asi_choices') a(key,value)
      WHERE EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(features) g(value) WHERE g.value->>'feature_slug'=a.key
        AND (g.value->>'unlock_level')::integer<=private.builder_controller_level_v1(next_choices,expected,g.value->>'controller_ref_id'));
    next_choices:=pg_catalog.jsonb_set(next_choices,'{asi_choices}',normalized);
  END IF;
  -- Removing a class-owned ASI can reduce another class's preparation budget.
  -- Keep the same deterministic valid subset used for ordinary level decreases.
  FOR current_class IN SELECT value FROM pg_catalog.jsonb_array_elements(next_choices->'classes') LOOP
    normalized:='[]'; new_spells:='[]';
    FOR item IN SELECT s.value FROM pg_catalog.jsonb_array_elements(spells) s(value)
      WHERE s.value->>'source'='selection' AND s.value->>'class_slug'=current_class->>'slug' ORDER BY s.value->>'id' LOOP
      -- Physical Signature rows are always prepared; preserve the owner's
      -- independent ordinary preparation intent when retaining their book row.
      SELECT p.value INTO entry FROM pg_catalog.jsonb_array_elements(COALESCE(next_choices#>ARRAY['class_spell_selections',current_class->>'slug'],'[]')) p(value)
        WHERE p.value->'content_id'=item->'content_id' AND p.value->'content_version'=item->'content_version';
      candidate:=pg_catalog.jsonb_build_object('content_id',item->'content_id','content_version',item->'content_version',
        'prepared',COALESCE(entry->'prepared',item->'is_prepared'));
      BEGIN
        entry:=private.builder_progression_class_spells_v1(target,next_choices,(current_class->>'level')::integer,
          normalized||pg_catalog.jsonb_build_array(candidate),spells,current_class->>'slug');
        normalized:=normalized||pg_catalog.jsonb_build_array(candidate); new_spells:=entry;
      EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT IN ('builder_class_cannot_cast','builder_spell_not_on_current_list','builder_spell_selection_budget_exceeded') THEN RAISE; END IF;
        IF SQLERRM='builder_spell_selection_budget_exceeded' AND candidate->'prepared'='true'::jsonb THEN
          -- Losing an ASI may lower a retained preparation allowance. Keep
          -- learned/spellbook membership if simply unpreparing restores it.
          candidate:=candidate||'{"prepared":false}'::jsonb;
          BEGIN
            entry:=private.builder_progression_class_spells_v1(target,next_choices,(current_class->>'level')::integer,
              normalized||pg_catalog.jsonb_build_array(candidate),spells,current_class->>'slug');
            normalized:=normalized||pg_catalog.jsonb_build_array(candidate); new_spells:=entry;
          EXCEPTION WHEN SQLSTATE '22023' THEN
            IF SQLERRM NOT IN ('builder_class_cannot_cast','builder_spell_not_on_current_list','builder_spell_selection_budget_exceeded') THEN RAISE; END IF;
          END;
        END IF;
      END;
    END LOOP;
    SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells) s(value)
      WHERE NOT (s.value->>'source'='selection' AND s.value->>'class_slug'=current_class->>'slug');
    spells:=spells||new_spells;
    IF next_choices#>ARRAY['class_spell_selections',current_class->>'slug'] IS NOT NULL OR normalized<>'[]'::jsonb THEN
      next_choices:=pg_catalog.jsonb_set(next_choices,'{class_spell_selections}',COALESCE(next_choices->'class_spell_selections','{}')||
        pg_catalog.jsonb_build_object(current_class->>'slug',normalized),true);
    END IF;
  END LOOP;
  expected:=expected||pg_catalog.jsonb_build_object('spells',spells);
  compiled:=private.prepare_builder_class_feature_choices_v1(target,next_choices,expected,NULL,
    (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot IN ('race','subrace','background')));
  next_choices:=compiled->'choices'; expected:=compiled->'graph';
  SELECT sum((value->>'level')::integer) INTO total_level FROM pg_catalog.jsonb_array_elements(next_choices->'classes');
  IF total_level NOT BETWEEN 1 AND 20 OR pg_catalog.jsonb_array_length(next_choices->'classes')<1 THEN RAISE EXCEPTION 'builder_starting_class_is_fixed' USING ERRCODE='23514'; END IF;
  IF next_state ? 'current_hp' THEN next_state:=pg_catalog.jsonb_set(next_state,'{current_hp}',pg_catalog.to_jsonb(
    LEAST((next_state->>'current_hp')::integer,private.builder_multiclass_max_hp_v1(target,next_choices,expected)))); END IF;
  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO entry FROM pg_catalog.jsonb_array_elements(expected->domain);
    expected:=pg_catalog.jsonb_set(expected,ARRAY[domain],entry);
  END LOOP;
  IF pg_catalog.octet_length(expected::text)>8388608 THEN RAISE EXCEPTION 'builder_class_removal_graph_bound' USING ERRCODE='54000'; END IF;
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->'classes',expected_choices=next_choices,
    expected_state=next_state,expected_level=total_level WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.apply_builder_progression_graph_v1(target,next_choices,next_state,total_level);
END $$;

-- Exact finite profile amendments retain every original owner, ACL and guard.
DO $profiles$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text; needle text; insertion text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.builder_catalog_occurrence_transition_v1(jsonb,jsonb)','e326f50f3ad69f993346d59a9898718a','6977a2c9212efb25ef7fe3a5427394e3','transition'),
    ('private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)','adbc4f82a2454cc5bd63a8f4a9cd0db7','896866e89cf4c74a7a4098f053f5a1d8','apply'),
    ('private.builder_progression_asi_write_v1(jsonb,jsonb,text)','5530bf954f288cf28c8d843920a35f02','76adfc0fa084271823c745942fad96e2','asi'),
    ('private.check_builder_progression_history_v1()','a63b1f1ab2a1ddf44a264d548da9bdc2','6ad1b9d81d964bf801f9ccdf0b70b01c','history'),
    ('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)','97e29472187cb63fef0da670b6f4eea6','85949e80acdfdc30e918679efe1168ef','hp')
  ) wanted(signature,before_md5,after_md5,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
      OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR original.proacl::text IS DISTINCT FROM (CASE WHEN item.kind='transition'
        THEN '{postgres=X/postgres,inkborne_class_origin_owner=X/postgres}' ELSE '{postgres=X/postgres}' END)
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.before_md5 THEN
      RAISE EXCEPTION 'builder_class_removal_preimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
    IF item.kind='transition' THEN
      needle:=$transition$  IF before_row IS NULL THEN$transition$;
      insertion:=$transition$  IF cap.command='remove_class' THEN
    RETURN before_row IS NOT NULL AND after_row IS NOT NULL AND before_row->>'lifecycle'='accepted' AND after_row->>'lifecycle'='ended'
      AND after_row->'ended_at'=pg_catalog.to_jsonb(pg_catalog.transaction_timestamp())
      AND (before_row-ARRAY['lifecycle','ended_at'])=(after_row-ARRAY['lifecycle','ended_at'])
      AND before_row->'id'<>private.builder_original_occurrence_v1(cap.character_id)->'id'
      AND (cap.protected_graph->'occurrences') @> pg_catalog.jsonb_build_array(before_row)
      AND (cap.expected_graph->'occurrences') @> pg_catalog.jsonb_build_array(after_row)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.expected_classes) c(value) WHERE c.value->'occurrence_id'=before_row->'id');
  END IF;
  IF before_row IS NULL THEN$transition$;
    ELSIF item.kind='apply' THEN
      needle:=$apply$    ELSIF old_occurrence IS DISTINCT FROM entry THEN
      PERFORM private.apply_builder_subclass_link_v1(target,(old_occurrence->>'id')::uuid,(entry->>'subclass_ref_id')::uuid);$apply$;
      insertion:=$apply$    ELSIF old_occurrence IS DISTINCT FROM entry THEN
      IF cap.command='remove_class' AND entry->>'lifecycle'='ended' THEN PERFORM private.apply_builder_end_occurrence_v1(target,entry);
      ELSE PERFORM private.apply_builder_subclass_link_v1(target,(old_occurrence->>'id')::uuid,(entry->>'subclass_ref_id')::uuid); END IF;$apply$;
    ELSIF item.kind='asi' THEN
      needle:=$asi$cap.command NOT IN ('set_class_level','select_asi','select_subclass')$asi$;
      insertion:=$asi$cap.command NOT IN ('set_class_level','select_asi','select_subclass','remove_class')$asi$;
    ELSIF item.kind='history' THEN
      needle:=$history$SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.after_graph->'occurrences') a(value) WHERE (a.value-'subclass_ref_id')=(b.value-'subclass_ref_id')))$history$;
      insertion:=$history$SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.after_graph->'occurrences') a(value) WHERE (a.value-'subclass_ref_id')=(b.value-'subclass_ref_id')
        OR NEW.command='remove_class' AND b.value->>'id'=NEW.receipt#>>'{fields,occurrence_id}' AND b.value->>'lifecycle'='accepted'
          AND a.value->>'lifecycle'='ended' AND a.value->'ended_at'=pg_catalog.to_jsonb(NEW.created_at)
          AND (a.value-ARRAY['lifecycle','ended_at'])=(b.value-ARRAY['lifecycle','ended_at'])))
    OR NEW.command='remove_class' AND (SELECT count(*) FROM pg_catalog.jsonb_array_elements(NEW.before_graph->'occurrences') b(value)
      JOIN pg_catalog.jsonb_array_elements(NEW.after_graph->'occurrences') a(value) ON a.value->'id'=b.value->'id'
      WHERE a.value IS DISTINCT FROM b.value)<>1$history$;
    ELSE
      needle:=$hp$FROM private.character_builder_progression_history_v1 h WHERE h.character_id=target AND h.after_parent#>ARRAY['choices','hp_rolls',key] IS NOT NULL$hp$;
      insertion:=$hp$FROM private.character_builder_progression_history_v1 h WHERE h.character_id=target AND h.after_parent#>ARRAY['choices','hp_rolls',key] IS NOT NULL
          AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(h.after_parent#>'{choices,classes}') hc(value)
            WHERE hc.value->'occurrence_id'=occurrence->'id' AND hc.value->>'slug'=selected_class_slug)$hp$;
    END IF;
    needle:=pg_catalog.replace(needle,E'\r\n',E'\n'); insertion:=pg_catalog.replace(insertion,E'\r\n',E'\n');
    IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'builder_class_removal_fragment_changed: %',item.kind USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(source,needle,insertion);
    IF pg_catalog.md5(replacement)<>item.after_md5 THEN RAISE EXCEPTION 'builder_class_removal_postimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF repaired.prosrc IS DISTINCT FROM replacement OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
      OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef OR repaired.provolatile IS DISTINCT FROM original.provolatile THEN
      RAISE EXCEPTION 'builder_class_removal_profile_closure_failed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $profiles$;
ALTER TABLE private.character_builder_progression_history_v1 DROP CONSTRAINT character_builder_progression_history_v1_command_check;
ALTER TABLE private.character_builder_progression_history_v1 ADD CONSTRAINT character_builder_progression_history_v1_command_check
  CHECK(command IN ('add_class','remove_class','set_class_level','save_hp_roll','select_asi','select_class_spells'));

ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) RENAME TO character_builder_command_before_removal_v1;
REVOKE ALL ON FUNCTION public.character_builder_command_before_removal_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; receipt jsonb; before_graph jsonb; after_graph jsonb; before_order jsonb; after_order jsonb;
BEGIN
  IF p_request->>'command' IS DISTINCT FROM 'remove_class' THEN RETURN public.character_builder_command_before_removal_v1(p_context,p_request); END IF;
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb OR pg_catalog.octet_length(p_request::text)>524288
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'operation_id')
    OR pg_catalog.jsonb_typeof(p_request->'fields')<>'object' THEN RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,'remove_class',true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,'remove_class');
  before_graph:=private.builder_progression_full_graph_v1(target);
  SELECT c.before_order INTO before_order FROM private.character_builder_capabilities_v1 c WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.prepare_builder_class_removal_v1(target,p_request->'fields');
  saved:=private.finish_builder_step_v1(p_context,target);
  PERFORM private.builder_class_roles_v1(target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command','remove_class','fields',p_request->'fields',
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  after_graph:=private.builder_progression_full_graph_v1(target);
  SELECT pg_catalog.to_jsonb(o) INTO after_order FROM private.character_projection_order_v1 o WHERE o.character_id=target;
  INSERT INTO private.character_builder_progression_history_v1(actor_id,operation_id,character_id,command,before_parent,after_parent,
    before_graph,after_graph,before_order,after_order,receipt,created_at)
    VALUES(parent.user_id,operation,target,'remove_class',pg_catalog.to_jsonb(parent),pg_catalog.to_jsonb(saved),before_graph,after_graph,before_order,after_order,receipt,pg_catalog.transaction_timestamp());
  PERFORM private.lock_builder_character_rows_v1(p_context,target);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;
ALTER FUNCTION private.prepare_builder_class_removal_v1(uuid,jsonb) OWNER TO postgres;
ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.prepare_builder_class_removal_v1(uuid,jsonb),public.character_builder_command_v1(jsonb,jsonb)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE') OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR pg_catalog.has_function_privilege('anon','private.prepare_builder_class_removal_v1(uuid,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','private.prepare_builder_class_removal_v1(uuid,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','private.prepare_builder_class_removal_v1(uuid,jsonb)','EXECUTE')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='private.apply_builder_end_occurrence_v1(uuid,jsonb)'::pg_catalog.regprocedure
      AND p.proowner='inkborne_class_origin_owner'::pg_catalog.regrole AND p.prosecdef AND p.proconfig=ARRAY['search_path=""']::text[])
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid='private.apply_builder_end_occurrence_v1(uuid,jsonb)'::pg_catalog.regprocedure
        AND (a.grantee NOT IN ('postgres'::pg_catalog.regrole,'inkborne_class_origin_owner'::pg_catalog.regrole) OR a.privilege_type<>'EXECUTE'))
    OR NOT pg_catalog.has_function_privilege('postgres','private.apply_builder_end_occurrence_v1(uuid,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_class_removal_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
NOTIFY pgrst,'reload schema';
COMMIT;
