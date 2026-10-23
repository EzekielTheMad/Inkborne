-- Disposable native profile, after multiclass integration and Favored Enemy.
-- Bonus choices are owned by active immutable feature versions. All writes use
-- the existing authenticated admission, sealed graph and accepted receipts.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_bonus_spells_v1(uuid,jsonb,jsonb,text,text)') IS NOT NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_bonus_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

-- Source manifests reserve Magical Secrets' entire allowance, including a
-- chosen cantrip. Lore's additional secrets explicitly have counts_known=false.
CREATE FUNCTION private.builder_bonus_known_reserve_v1(target uuid,class_definition jsonb,class_level integer) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE feature_slug text; feature_definition jsonb; choice jsonb; reserve integer:=0;
BEGIN
  FOR feature_slug IN SELECT DISTINCT f.value#>>'{}'
    FROM pg_catalog.jsonb_array_elements(class_definition#>'{data_snapshot,levels}') l(value)
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(l.value->'features') f(value)
    WHERE (l.value->>'level')::integer<=class_level LOOP
    feature_definition:=private.builder_catalog_dependency_v1(target,class_definition,'feature',feature_slug);
    FOR choice IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(feature_definition#>'{data_snapshot,bonus_spells}','[]')) LOOP
      IF choice->'counts_known'='true'::jsonb THEN reserve:=reserve+(choice->>'choose')::integer; END IF;
    END LOOP;
  END LOOP;
  RETURN reserve;
END $$;

-- Lore grants three new proficiencies. Re-selecting an existing proficiency
-- must not spend one of those choices; later background/skill edits prune it.
CREATE FUNCTION private.normalize_builder_lore_skills_v1(target uuid,pending_choices jsonb,active_refs jsonb,strict_choice_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE definitions jsonb; lore jsonb; lore_choices jsonb; current_choice jsonb; effect jsonb; chosen jsonb; source_definition jsonb;
  selected jsonb; accepted jsonb; occupied text[]:='{}'; skill text; field text; key text; sources_count integer;
BEGIN
  SELECT COALESCE(pg_catalog.jsonb_agg(private.builder_role_definition_v1(target,r.value,pg_catalog.to_jsonb(v))),'[]') INTO definitions
    FROM pg_catalog.jsonb_array_elements(active_refs) r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer;
  SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO sources_count,lore FROM pg_catalog.jsonb_array_elements(definitions)
    WHERE value->>'content_type_snapshot'='feature' AND value->>'slug_snapshot'='bonus-proficiencies'
      AND value#>>'{data_snapshot,class}'='bard' AND value#>>'{data_snapshot,subclass}'='lore';
  IF sources_count=0 THEN
    -- The source's finite choice ID equals its real SRD feature slug.
    IF pending_choices#>'{resolved_choices,bonus-proficiencies}' IS NOT NULL THEN
      pending_choices:=pg_catalog.jsonb_set(pending_choices,'{resolved_choices}',(pending_choices->'resolved_choices')-'bonus-proficiencies'); END IF;
    RETURN pending_choices;
  ELSIF sources_count<>1 THEN RAISE EXCEPTION 'builder_lore_source_ambiguous' USING ERRCODE='23514'; END IF;
  SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO sources_count,current_choice FROM pg_catalog.jsonb_array_elements(lore->'effects_snapshot')
    WHERE value->>'type'='choice' AND value->>'grant_type'='proficiency';
  IF sources_count<>1 OR current_choice->'choose'<>'3'::jsonb OR pg_catalog.jsonb_typeof(current_choice->'from')<>'array' THEN
    RAISE EXCEPTION 'builder_lore_manifest_unavailable' USING ERRCODE='23514'; END IF;
  key:=current_choice->>'choice_id'; lore_choices:=COALESCE(pending_choices->'resolved_choices','{}');
  FOR source_definition IN SELECT value FROM pg_catalog.jsonb_array_elements(definitions) LOOP
    FOREACH field IN ARRAY CASE WHEN source_definition->>'content_type_snapshot'='class'
      THEN ARRAY['skills','toolProfs','starting_proficiencies'] ELSE ARRAY['skills','toolProfs'] END LOOP
      FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(source_definition#>ARRAY['data_snapshot',field],'[]')) LOOP
        skill:=private.builder_expertise_proficiency_v1(chosen#>>'{}'); IF skill IS NOT NULL THEN occupied:=array_append(occupied,skill); END IF;
      END LOOP;
    END LOOP;
    FOR effect IN SELECT value FROM pg_catalog.jsonb_array_elements(source_definition->'effects_snapshot') LOOP
      IF effect->>'type'='grant' AND effect->>'value' IN ('proficient','expertise') THEN
        skill:=private.builder_expertise_proficiency_v1(effect->>'stat'); IF skill IS NOT NULL THEN occupied:=array_append(occupied,skill); END IF;
      ELSIF effect->>'type'='choice' AND effect->>'grant_type' IN ('skill','proficiency','tool') AND effect->>'choice_id'<>key
        AND pg_catalog.jsonb_typeof(effect->'from')='array' THEN
        selected:=lore_choices->(effect->>'choice_id');
        IF pg_catalog.jsonb_typeof(selected)='array' AND pg_catalog.jsonb_array_length(selected)<=(effect->>'choose')::integer
          AND (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(selected))=pg_catalog.jsonb_array_length(selected)
          AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selected) s(value) WHERE NOT (effect->'from') @> pg_catalog.jsonb_build_array(s.value)) THEN
          FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(selected) LOOP
            skill:=private.builder_expertise_proficiency_v1(chosen#>>'{}'); IF skill IS NOT NULL THEN occupied:=array_append(occupied,skill); END IF;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  selected:=COALESCE(lore_choices->key,'[]'); accepted:='[]';
  IF pg_catalog.jsonb_typeof(selected)='array' THEN
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(selected) LOOP
      skill:=private.builder_expertise_proficiency_v1(chosen#>>'{}');
      IF skill IS NOT NULL AND NOT skill=ANY(occupied) AND (current_choice->'from') @> pg_catalog.jsonb_build_array(chosen)
        AND NOT accepted @> pg_catalog.jsonb_build_array(chosen) AND pg_catalog.jsonb_array_length(accepted)<3 THEN
        accepted:=accepted||pg_catalog.jsonb_build_array(chosen); END IF;
    END LOOP;
  END IF;
  IF strict_choice_id=key AND accepted IS DISTINCT FROM selected THEN RAISE EXCEPTION 'builder_lore_skill_already_proficient' USING ERRCODE='22023'; END IF;
  IF lore_choices ? key THEN pending_choices:=pg_catalog.jsonb_set(pending_choices,ARRAY['resolved_choices',key],accepted); END IF;
  RETURN pending_choices;
END $$;

CREATE FUNCTION private.prepare_builder_bonus_spells_v1(target uuid,pending_choices jsonb,graph jsonb,
  strict_feature_slug text,strict_choice_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; refs jsonb; spells jsonb; sources jsonb; definitions jsonb:='[]';
  bonus_source jsonb; choice jsonb; entry jsonb; definition jsonb; picked jsonb; accepted jsonb; normalized jsonb:='{}';
  selections jsonb; source_ref jsonb; class_ref jsonb; class_definition jsonb; class_slug text; class_level integer; max_level integer;
  current_spells jsonb; key text; active_count integer; is_strict boolean; valid boolean; spell_level integer; mode text;
  selected public.content_versions%ROWTYPE; physical public.character_spells%ROWTYPE; existing jsonb; pin jsonb; request jsonb;
  used text[]:='{}'; use_key text; fixed_tier jsonb; fixed_slug jsonb; prior_requested jsonb; controller_id text;
  wizard_level integer; prepared_limit integer; prepared_count integer; scores jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(pending_choices) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(graph->'refs') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(graph->'spells') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(graph->'refs')>4096 OR pg_catalog.octet_length(graph::text)>8388608 THEN
    RAISE EXCEPTION 'builder_bonus_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  selections:=COALESCE(pending_choices->'bonus_spells','{}');
  IF pg_catalog.jsonb_typeof(selections) IS DISTINCT FROM 'object' OR pg_catalog.octet_length(selections::text)>131072 THEN
    RAISE EXCEPTION 'builder_bonus_selection_unavailable' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value)
    WHERE COALESCE(r.value->>'choice_source','') NOT LIKE 'builder:bonus-spell:%';
  SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(graph->'spells') s(value)
    WHERE s.value->>'source'<>'bonus';
  -- Undo only the previous signature annotation. The ordinary saved selection
  -- retains whether the owner prepared the spell independently of Signature.
  current_spells:='[]';
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(spells) LOOP
    IF entry#>'{custom_data,builder_bonus_signature}' IS NOT NULL THEN
      SELECT p.value INTO prior_requested FROM pg_catalog.jsonb_array_elements(COALESCE(
        pending_choices#>ARRAY['class_spell_selections',entry->>'class_slug'],'[]')) p(value)
        WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version';
      entry:=entry||pg_catalog.jsonb_build_object('always_prepared',false,'is_prepared',COALESCE(prior_requested->'prepared','false'::jsonb),
        'custom_data',(entry->'custom_data')-'builder_bonus_signature');
    END IF;
    current_spells:=current_spells||pg_catalog.jsonb_build_array(entry);
  END LOOP;
  spells:=current_spells;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)||pg_catalog.jsonb_build_object('_source_ref',r.value)),'[]') INTO sources
    FROM pg_catalog.jsonb_array_elements(refs) r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE v.content_type_snapshot='feature' AND (v.data_snapshot ? 'bonus_spells' OR v.data_snapshot ? 'bonus_spell_grants');
  FOR bonus_source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources) LOOP
    class_slug:=bonus_source#>>'{data_snapshot,class}';
    SELECT count(*),max((c.value->>'level')::integer) INTO active_count,class_level
      FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value) WHERE c.value->>'slug'=class_slug;
    IF active_count<>1 OR class_level<COALESCE((bonus_source#>>'{data_snapshot,level}')::integer,1) THEN CONTINUE; END IF;
    FOR choice IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(bonus_source#>'{data_snapshot,bonus_spells}','[]')) LOOP
      IF NOT private.builder_exact_keys_v1(choice,ARRAY['choice_id','choose','min_spell_level','max_spell_level','list_class','ritual_only','spellbook_only','counts_known','always_prepared','mode'])
        OR COALESCE(choice->>'choice_id','') !~ '^[a-z][a-z0-9-]{0,199}$' OR COALESCE(choice->>'choose','') !~ '^[1-3]$'
        OR COALESCE(choice->>'min_spell_level','') !~ '^[0-9]$' OR COALESCE(choice->>'max_spell_level','') !~ '^([0-9]|class)$'
        OR pg_catalog.jsonb_typeof(choice->'list_class') NOT IN ('string','null')
        OR pg_catalog.jsonb_typeof(choice->'ritual_only')<>'boolean' OR pg_catalog.jsonb_typeof(choice->'spellbook_only')<>'boolean'
        OR pg_catalog.jsonb_typeof(choice->'counts_known')<>'boolean' OR pg_catalog.jsonb_typeof(choice->'always_prepared')<>'boolean'
        OR choice->>'mode' NOT IN ('known','ritual','arcanum','mastery','signature') THEN
        RAISE EXCEPTION 'builder_bonus_manifest_unavailable' USING ERRCODE='23514'; END IF;
      definitions:=definitions||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',bonus_source,'choice',choice));
    END LOOP;
    -- Fixed Circle spells are not user-supplied selections and have independent
    -- per-terrain level gates. They are rebuilt from the selected terrain pin.
    FOR fixed_tier IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(bonus_source#>'{data_snapshot,bonus_spell_grants}','[]')) LOOP
      IF (fixed_tier->>'class_level')::integer>class_level THEN CONTINUE; END IF;
      accepted:='[]';
      FOR fixed_slug IN SELECT value FROM pg_catalog.jsonb_array_elements(fixed_tier->'spells') LOOP
        definition:=private.builder_catalog_dependency_v1(target,bonus_source,'spell',fixed_slug#>>'{}');
        accepted:=accepted||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('content_id',definition->'content_id','content_version',definition->'version'));
      END LOOP;
      choice:=pg_catalog.jsonb_build_object('choice_id',(bonus_source->>'slug_snapshot')||'-'||(fixed_tier->>'class_level'),'choose',pg_catalog.jsonb_array_length(accepted),
        'min_spell_level',0,'max_spell_level',9,'list_class',NULL,'ritual_only',false,'spellbook_only',false,'counts_known',false,'always_prepared',true,'mode','fixed');
      definitions:=definitions||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',bonus_source,'choice',choice,'fixed',accepted));
    END LOOP;
  END LOOP;
  IF strict_choice_id IS NOT NULL AND (SELECT count(*) FROM pg_catalog.jsonb_array_elements(definitions) d(value)
    WHERE d.value#>>'{choice,choice_id}'=strict_choice_id AND d.value#>>'{source,slug_snapshot}'=strict_feature_slug AND NOT d.value ? 'fixed')<>1 THEN
    RAISE EXCEPTION 'builder_bonus_source_unavailable' USING ERRCODE='22023'; END IF;
  FOR request IN SELECT value FROM pg_catalog.jsonb_array_elements(definitions) ORDER BY value#>>'{choice,choice_id}' LOOP
    bonus_source:=request->'source'; source_ref:=bonus_source->'_source_ref'; choice:=request->'choice'; key:=choice->>'choice_id'; mode:=choice->>'mode';
    is_strict:=key=strict_choice_id; class_slug:=bonus_source#>>'{data_snapshot,class}';
    IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(definitions) d(value) WHERE d.value#>>'{choice,choice_id}'=key)<>1 THEN
      RAISE EXCEPTION 'builder_bonus_source_ambiguous' USING ERRCODE='23514'; END IF;
    SELECT (c.value->>'level')::integer INTO class_level FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value) WHERE c.value->>'slug'=class_slug;
    SELECT r.value,pg_catalog.to_jsonb(v) INTO class_ref,class_definition FROM pg_catalog.jsonb_array_elements(refs) r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
      WHERE v.content_type_snapshot='class' AND v.slug_snapshot=class_slug;
    controller_id:=class_ref->>'id';
    IF controller_id IS NULL THEN RAISE EXCEPTION 'builder_bonus_class_unavailable' USING ERRCODE='23514'; END IF;
    IF choice->>'max_spell_level'='class' THEN
      SELECT COALESCE(max(position::integer),0) INTO max_level FROM pg_catalog.jsonb_array_elements(class_definition#>'{data_snapshot,levels}') l(value)
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(l.value#>'{spellcasting,spell_slots}') WITH ORDINALITY slots(value,position)
        WHERE l.value->>'level'=class_level::text AND (slots.value#>>'{}')::integer>0;
    ELSE max_level:=(choice->>'max_spell_level')::integer; END IF;
    picked:=COALESCE(request->'fixed',selections->key,'[]'); accepted:='[]';
    IF pg_catalog.jsonb_typeof(picked) IS DISTINCT FROM 'array' THEN
      IF is_strict THEN RAISE EXCEPTION 'builder_bonus_selection_unavailable' USING ERRCODE='22023'; END IF; picked:='[]'; END IF;
    FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(picked) LOOP
      valid:=private.builder_exact_keys_v1(entry,ARRAY['content_id','content_version']) AND private.builder_uuid_v1(entry->>'content_id')
        AND pg_catalog.jsonb_typeof(entry->'content_version')='number' AND COALESCE(entry->>'content_version','') ~ '^[1-9][0-9]{0,8}$'
        AND pg_catalog.jsonb_array_length(accepted)<(choice->>'choose')::integer;
      IF valid THEN
        SELECT v.* INTO selected FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id
          WHERE v.content_id=(entry->>'content_id')::uuid AND v.version=(entry->>'content_version')::integer AND NOT d.is_retired
            AND v.content_type_snapshot='spell' AND v.system_id_snapshot=(bonus_source->>'system_id_snapshot')::uuid
            AND (request ? 'fixed' OR d.version=v.version OR (choice->'spellbook_only'='true'::jsonb AND EXISTS(
              SELECT 1 FROM pg_catalog.jsonb_array_elements(spells) b(value) WHERE b.value->'content_id'=entry->'content_id'
                AND b.value->'content_version'=entry->'content_version' AND b.value->>'class_slug'=class_slug
                AND b.value->>'source'='selection' AND b.value->'in_spellbook'='true'::jsonb))
              OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') p(value)
              WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version'
                AND p.value#>>'{context,source_ref_id}'=source_ref->>'id' AND p.value#>>'{context,choice_id}'=key))
            AND private.character_can_access_content_version(target,v.content_id,v.version) FOR SHARE OF v,d;
        valid:=FOUND;
      END IF;
      IF valid THEN
        spell_level:=(selected.data_snapshot->>'level')::integer; use_key:=class_slug||':'||selected.content_id::text;
        valid:=spell_level BETWEEN (choice->>'min_spell_level')::integer AND max_level AND NOT use_key=ANY(used)
          AND pg_catalog.jsonb_typeof(selected.data_snapshot->'classes')='array'
          AND pg_catalog.jsonb_array_length(selected.data_snapshot->'classes')>0
          AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(selected.data_snapshot->'classes') listed(value)
            WHERE pg_catalog.jsonb_typeof(listed.value)<>'string' OR length(listed.value#>>'{}')=0)
          AND (choice->'list_class'='null'::jsonb OR COALESCE(selected.data_snapshot->'classes','[]') @> pg_catalog.jsonb_build_array(choice->>'list_class'))
          AND (choice->'ritual_only'='false'::jsonb OR selected.data_snapshot->'ritual'='true'::jsonb);
        SELECT s.value INTO existing FROM pg_catalog.jsonb_array_elements(spells) s(value)
          WHERE s.value->'content_id'=entry->'content_id' AND s.value->'content_version'=entry->'content_version' AND s.value->>'class_slug'=class_slug;
        IF choice->'spellbook_only'='true'::jsonb THEN
          valid:=valid AND existing->>'source'='selection' AND existing->'in_spellbook'='true'::jsonb;
        ELSIF mode<>'fixed' AND existing IS NOT NULL THEN valid:=false;
        END IF;
      END IF;
      IF valid IS NOT TRUE THEN
        IF is_strict THEN RAISE EXCEPTION 'builder_bonus_spell_unavailable' USING ERRCODE='22023'; END IF; CONTINUE; END IF;
      used:=array_append(used,use_key); accepted:=accepted||pg_catalog.jsonb_build_array(entry);
      pin:=private.builder_catalog_pin_v1(target,pg_catalog.to_jsonb(selected),pg_catalog.jsonb_build_object('source','bonus_spell','source_ref_id',source_ref->>'id',
        'choice_id',key,'class',class_slug,'mode',mode),'builder:bonus-spell:'||(source_ref->>'id')||':'||key||':'||selected.content_id::text||':'||selected.version::text,NULL,cap.protected_graph->'refs');
      refs:=refs||pg_catalog.jsonb_build_array(pin);
      IF mode='mastery' THEN CONTINUE; END IF;
      IF mode='signature' THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN s.value->'id'=existing->'id' THEN s.value||pg_catalog.jsonb_build_object('is_prepared',true,'always_prepared',true,
          'custom_data',COALESCE(s.value->'custom_data','{}')||pg_catalog.jsonb_build_object('builder_bonus_signature',key)) ELSE s.value END),'[]') INTO spells
          FROM pg_catalog.jsonb_array_elements(spells) s(value);
        CONTINUE;
      END IF;
      IF mode='fixed' AND existing IS NOT NULL THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells) s(value) WHERE s.value->'id'<>existing->'id';
        SELECT COALESCE(pg_catalog.jsonb_agg(p.value),'[]') INTO current_spells FROM pg_catalog.jsonb_array_elements(COALESCE(
          pending_choices#>ARRAY['class_spell_selections',class_slug],'[]')) p(value) WHERE p.value->'content_id'<>entry->'content_id';
        pending_choices:=pg_catalog.jsonb_set(pending_choices,'{class_spell_selections}',COALESCE(pending_choices->'class_spell_selections','{}')||pg_catalog.jsonb_build_object(class_slug,current_spells),true);
      END IF;
      SELECT p.value INTO existing FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'spells') p(value)
        WHERE p.value->'content_id'=entry->'content_id' AND p.value->'content_version'=entry->'content_version' AND p.value->>'class_slug'=class_slug
          AND p.value->>'source'='bonus' AND p.value#>>'{custom_data,builder_bonus_choice_id}'=key
          AND p.value#>>'{custom_data,builder_bonus_source_ref_id}'=source_ref->>'id';
      IF existing IS NULL THEN
        physical.id:=pg_catalog.gen_random_uuid(); physical.character_id:=target; physical.content_id:=selected.content_id; physical.content_version:=selected.version;
        physical.name:=selected.name_snapshot; physical.class_slug:=class_slug; physical.is_known:=true;
        physical.is_prepared:=spell_level=0 OR choice->'always_prepared'='true'::jsonb; physical.always_prepared:=(choice->>'always_prepared')::boolean;
        physical.in_spellbook:=false; physical.source:='bonus'; physical.spell_grant_id:=NULL; physical.created_at:=pg_catalog.transaction_timestamp();
        physical.custom_data:=pg_catalog.jsonb_build_object('builder_class_controller_ref_id',controller_id,'builder_bonus_choice_id',key,
          'builder_bonus_source_ref_id',source_ref->>'id','builder_bonus_mode',mode);
        existing:=pg_catalog.to_jsonb(physical);
      END IF;
      spells:=spells||pg_catalog.jsonb_build_array(existing);
    END LOOP;
    IF mode<>'fixed' AND (selections ? key OR accepted<>'[]'::jsonb) THEN normalized:=normalized||pg_catalog.jsonb_build_object(key,accepted); END IF;
  END LOOP;
  -- A free Signature preparation cannot become an over-budget ordinary
  -- preparation when the feature is cleared or replaced. The UI preserves
  -- owner intent; this server check also closes forged ordinary submissions.
  SELECT (value->>'level')::integer INTO wizard_level FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') WHERE value->>'slug'='wizard';
  IF wizard_level IS NOT NULL THEN
    scores:=private.builder_progression_scores_v1(target,pending_choices);
    prepared_limit:=GREATEST(1,wizard_level+floor(((scores->>'intelligence')::numeric-10)/2)::integer); prepared_count:=0;
    FOR entry IN SELECT s.value FROM pg_catalog.jsonb_array_elements(spells) s(value) JOIN public.content_versions v
      ON v.content_id=(s.value->>'content_id')::uuid AND v.version=(s.value->>'content_version')::integer
      WHERE s.value->>'class_slug'='wizard' AND s.value->>'source'='selection' AND s.value->'is_prepared'='true'::jsonb
        AND s.value->'always_prepared'='false'::jsonb AND (v.data_snapshot->>'level')::integer>0 ORDER BY s.value->>'id' LOOP
      prepared_count:=prepared_count+1;
      IF prepared_count<=prepared_limit THEN CONTINUE; END IF;
      IF strict_choice_id IS NOT NULL THEN RAISE EXCEPTION 'builder_spell_selection_budget_exceeded' USING ERRCODE='22023'; END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN value->'id'=entry->'id' THEN value||'{"is_prepared":false}'::jsonb ELSE value END),'[]') INTO spells
        FROM pg_catalog.jsonb_array_elements(spells);
      SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN value->'content_id'=entry->'content_id' AND value->'content_version'=entry->'content_version'
        THEN value||'{"prepared":false}'::jsonb ELSE value END),'[]') INTO current_spells FROM pg_catalog.jsonb_array_elements(
          COALESCE(pending_choices#>'{class_spell_selections,wizard}','[]'));
      pending_choices:=pg_catalog.jsonb_set(pending_choices,'{class_spell_selections}',COALESCE(pending_choices->'class_spell_selections','{}')||
        pg_catalog.jsonb_build_object('wizard',current_spells),true);
    END LOOP;
  END IF;
  IF normalized<>'{}'::jsonb OR pending_choices ? 'bonus_spells' THEN pending_choices:=pg_catalog.jsonb_set(pending_choices,'{bonus_spells}',normalized,true); END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs);
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO spells FROM pg_catalog.jsonb_array_elements(spells);
  IF pg_catalog.jsonb_array_length(refs)>4096 OR pg_catalog.jsonb_array_length(spells)>400 OR pg_catalog.octet_length(refs::text)+pg_catalog.octet_length(spells::text)>8388608 THEN
    RAISE EXCEPTION 'builder_bonus_graph_bound' USING ERRCODE='54000'; END IF;
  RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph||pg_catalog.jsonb_build_object('refs',refs,'spells',spells));
END $$;

CREATE FUNCTION private.prepare_builder_bonus_command_v1(target uuid,fields jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; pending jsonb; compiled jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.command<>'select_bonus_spells' OR NOT private.builder_exact_keys_v1(fields,ARRAY['feature_slug','choice_id','spells'])
    OR COALESCE(fields->>'feature_slug','') !~ '^[a-z][a-z0-9-]{0,199}$' OR COALESCE(fields->>'choice_id','') !~ '^[a-z][a-z0-9-]{0,199}$'
    OR pg_catalog.jsonb_typeof(fields->'spells') IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(fields->'spells')>3 THEN
    RAISE EXCEPTION 'builder_bonus_selection_unavailable' USING ERRCODE='22023'; END IF;
  pending:=cap.before_parent->'choices';
  pending:=pg_catalog.jsonb_set(pending,'{bonus_spells}',COALESCE(pending->'bonus_spells','{}')||pg_catalog.jsonb_build_object(fields->>'choice_id',fields->'spells'),true);
  compiled:=private.prepare_builder_bonus_spells_v1(target,pending,cap.protected_graph,fields->>'feature_slug',fields->>'choice_id');
  pending:=compiled->'choices';
  UPDATE private.character_builder_capabilities_v1 SET expected_graph=compiled->'graph',expected_classes=pending->'classes',expected_choices=pending,
    expected_state=cap.before_parent->'state',expected_level=(cap.before_parent->>'level')::integer
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  PERFORM private.apply_builder_progression_graph_v1(target,pending,cap.before_parent->'state',(cap.before_parent->>'level')::integer);
END $$;

-- Planner hook and finite ordinary budget/Signature projection changes. Exact
-- source profiles prevent this companion from patching an unknown installation.
DO $profiles$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text; needle text; insertion text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)','518793720d6c4abe638edec0c36e9fe1','ac38f1a56f22097481aa51ea3472d592','normalizer'),
    ('private.builder_progression_class_spells_v1(uuid,jsonb,integer,jsonb,jsonb,text)','931cb3381da5db27c377bc9cafe1ecce','b2535515321b201f5288845e8b0956e8','budget'),
    ('private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)','d1bae62e2076a1b1202a9a0c5bb7657d','adbc4f82a2454cc5bd63a8f4a9cd0db7','apply')
  ) expected(signature,body_md5,next_md5,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
      OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.body_md5 THEN
      RAISE EXCEPTION 'builder_bonus_preimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
    IF item.kind='normalizer' THEN
      needle:='RETURN private.prepare_builder_favored_enemies_v1(target,pending_choices,graph||pg_catalog.jsonb_build_object(''refs'',refs),NULL);';
      insertion:='pending_choices:=private.normalize_builder_lore_skills_v1(target,pending_choices,refs||supplemental_refs,strict_choice_id); pending_choices:=private.normalize_builder_expertise_v1(target,pending_choices,refs||supplemental_refs,NULL); projected:=private.prepare_builder_favored_enemies_v1(target,pending_choices,graph||pg_catalog.jsonb_build_object(''refs'',refs),NULL); RETURN private.prepare_builder_bonus_spells_v1(target,projected->''choices'',projected->''graph'',NULL,NULL);';
    ELSIF item.kind='budget' THEN
      needle:='  IF wizard THEN known_limit:=6+2*(level-1); END IF;';
      insertion:=needle||E'\n  known_limit:=GREATEST(0,known_limit-private.builder_bonus_known_reserve_v1(target,definition,level));';
    ELSE
      needle:='in_spellbook=(entry->>''in_spellbook'')::boolean WHERE id=(entry->>''id'')::uuid AND character_id=target;';
      insertion:='in_spellbook=(entry->>''in_spellbook'')::boolean,always_prepared=(entry->>''always_prepared'')::boolean,custom_data=entry->''custom_data'' WHERE id=(entry->>''id'')::uuid AND character_id=target;';
    END IF;
    IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'builder_bonus_fragment_changed' USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(source,needle,insertion);
    IF item.kind='budget' THEN
      needle:='IF prepare THEN prepared_count:=prepared_count+1; END IF;';
      insertion:='IF prepare AND NOT (wizard AND level>=20 AND COALESCE(choices#>''{bonus_spells,signature-spell}'',''[]''::jsonb) @> pg_catalog.jsonb_build_array(entry-''prepared'')) THEN prepared_count:=prepared_count+1; END IF;';
      IF (length(replacement)-length(pg_catalog.replace(replacement,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'builder_bonus_preparation_fragment_changed' USING ERRCODE='42501'; END IF;
      replacement:=pg_catalog.replace(replacement,needle,insertion);
    END IF;
    IF pg_catalog.md5(replacement)<>item.next_md5 THEN RAISE EXCEPTION 'builder_bonus_postimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF repaired.prosrc IS DISTINCT FROM replacement OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
      OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef OR repaired.provolatile IS DISTINCT FROM original.provolatile THEN
      RAISE EXCEPTION 'builder_bonus_profile_closure_failed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $profiles$;

ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) RENAME TO character_builder_command_before_bonus_v1;
REVOKE ALL ON FUNCTION public.character_builder_command_before_bonus_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; operation uuid; parent public.characters%ROWTYPE; saved public.characters%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; receipt jsonb;
BEGIN
  IF p_request->>'command' IS DISTINCT FROM 'select_bonus_spells' THEN RETURN public.character_builder_command_before_bonus_v1(p_context,p_request); END IF;
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb OR pg_catalog.octet_length(p_request::text)>524288
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'operation_id')
    OR pg_catalog.jsonb_typeof(p_request->'fields') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,'select_bonus_spells',true);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,'select_bonus_spells');
  PERFORM private.prepare_builder_bonus_command_v1(target,p_request->'fields');
  saved:=private.finish_builder_step_v1(p_context,target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',parent.user_id,'command','select_bonus_spells','fields',p_request->'fields',
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  PERFORM private.lock_builder_character_rows_v1(p_context,target);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;
ALTER FUNCTION public.character_builder_command_v1(jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
ALTER FUNCTION private.builder_bonus_known_reserve_v1(uuid,jsonb,integer) OWNER TO postgres;
ALTER FUNCTION private.normalize_builder_lore_skills_v1(uuid,jsonb,jsonb,text) OWNER TO postgres;
ALTER FUNCTION private.prepare_builder_bonus_spells_v1(uuid,jsonb,jsonb,text,text) OWNER TO postgres;
ALTER FUNCTION private.prepare_builder_bonus_command_v1(uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.builder_bonus_known_reserve_v1(uuid,jsonb,integer),private.normalize_builder_lore_skills_v1(uuid,jsonb,jsonb,text),private.prepare_builder_bonus_spells_v1(uuid,jsonb,jsonb,text,text),
  private.prepare_builder_bonus_command_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE') OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid IN ('private.builder_bonus_known_reserve_v1(uuid,jsonb,integer)'::pg_catalog.regprocedure,'private.normalize_builder_lore_skills_v1(uuid,jsonb,jsonb,text)'::pg_catalog.regprocedure,
        'private.prepare_builder_bonus_spells_v1(uuid,jsonb,jsonb,text,text)'::pg_catalog.regprocedure,'private.prepare_builder_bonus_command_v1(uuid,jsonb)'::pg_catalog.regprocedure) AND a.grantee<>p.proowner)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_bonus_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
NOTIFY pgrst,'reload schema';
COMMIT;
