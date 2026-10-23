-- Disposable-profile companion AFTER character-builder-multiclass.sql.
-- Finite choices retain real source versions and accepted graph receipts.
-- No readiness gate, hosted object, original-class identity or receipt bypass.
BEGIN;

DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.builder_invocation_choice_v1(uuid,jsonb,jsonb,jsonb)') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.builder_feature_option_eligible_v1(uuid,jsonb,jsonb,jsonb,jsonb)') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_acquisition_v1(uuid,uuid,jsonb)') IS NULL
    OR pg_catalog.to_regprocedure('private.builder_class_roles_v1(uuid)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_feature_choice_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

CREATE FUNCTION private.builder_invocation_choice_v1(target uuid,pending_choices jsonb,graph jsonb,choice jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE class_source jsonb; row jsonb; capacity integer; class_level integer; count_sources integer;
BEGIN
  IF choice->>'grant_type' IS DISTINCT FROM 'invocation' THEN RETURN choice; END IF;
  IF choice->>'choice_id'<>'eldritch-invocations' OR pg_catalog.jsonb_typeof(choice->'from') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(pending_choices->'classes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'builder_invocation_source_unavailable' USING ERRCODE='22023'; END IF;
  SELECT count(*),COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v))->0,'null') INTO count_sources,class_source
    FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE r.value->>'character_id'=target::text AND v.content_type_snapshot='class' AND v.slug_snapshot='warlock';
  IF count_sources<>1 OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value)
    WHERE c.value->>'slug'='warlock')<>1 THEN
    RAISE EXCEPTION 'builder_invocation_source_unavailable' USING ERRCODE='22023'; END IF;
  SELECT (value->>'level')::integer INTO class_level FROM pg_catalog.jsonb_array_elements(pending_choices->'classes')
    WHERE value->>'slug'='warlock';
  SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO count_sources,row
    FROM pg_catalog.jsonb_array_elements(class_source#>'{data_snapshot,levels}')
    WHERE value->'level'=pg_catalog.to_jsonb(class_level);
  IF count_sources<>1 OR COALESCE(row#>>'{class_specific,invocations_known}','') !~ '^[0-8]$' THEN
    RAISE EXCEPTION 'builder_invocation_source_unavailable' USING ERRCODE='22023'; END IF;
  capacity:=(row#>>'{class_specific,invocations_known}')::integer;
  IF capacity<1 THEN RAISE EXCEPTION 'builder_invocation_source_unavailable' USING ERRCODE='22023'; END IF;
  RETURN choice||pg_catalog.jsonb_build_object('choose',capacity);
END $$;

CREATE FUNCTION private.builder_feature_option_eligible_v1(target uuid,pending_choices jsonb,graph jsonb,source jsonb,dependency jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE requirement jsonb; class_level integer; known boolean;
BEGIN
  IF dependency->>'content_type_snapshot'<>'feature'
    OR dependency#>>'{data_snapshot,class}' IS DISTINCT FROM source#>>'{data_snapshot,class}'
    OR dependency#>>'{data_snapshot,subclass}' IS DISTINCT FROM source#>>'{data_snapshot,subclass}' THEN RETURN false; END IF;
  IF dependency#>'{data_snapshot,selection_prerequisites}' IS NULL THEN RETURN true; END IF;
  IF pg_catalog.jsonb_typeof(dependency#>'{data_snapshot,selection_prerequisites}') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value)
    WHERE c.value->>'slug'=source#>>'{data_snapshot,class}')<>1 THEN RETURN false; END IF;
  SELECT (value->>'level')::integer INTO class_level FROM pg_catalog.jsonb_array_elements(pending_choices->'classes')
    WHERE value->>'slug'=source#>>'{data_snapshot,class}';
  FOR requirement IN SELECT value FROM pg_catalog.jsonb_array_elements(dependency#>'{data_snapshot,selection_prerequisites}') LOOP
    IF requirement->>'kind'='class_level' THEN
      IF NOT private.builder_exact_keys_v1(requirement,ARRAY['kind','minimum'])
        OR COALESCE(requirement->>'minimum','') !~ '^([1-9]|1[0-9]|20)$'
        OR (requirement->>'minimum')::integer>class_level THEN RETURN false; END IF;
    ELSIF requirement->>'kind'='spell' THEN
      IF NOT private.builder_exact_keys_v1(requirement,ARRAY['kind','slug']) THEN RETURN false; END IF;
      SELECT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(graph->'spells') s(value) JOIN public.content_versions v
        ON v.content_id=(s.value->>'content_id')::uuid AND v.version=(s.value->>'content_version')::integer
        WHERE s.value->>'character_id'=target::text AND s.value->'is_known'='true'::jsonb
          AND v.content_type_snapshot='spell' AND v.slug_snapshot=requirement->>'slug') INTO known;
      IF NOT known THEN RETURN false; END IF;
    ELSIF requirement->>'kind'='feature' THEN
      IF NOT private.builder_exact_keys_v1(requirement,ARRAY['kind','slug']) OR NOT EXISTS(
        SELECT 1 FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value) JOIN public.content_versions v
          ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
        WHERE r.value->>'character_id'=target::text AND v.content_type_snapshot='feature' AND v.slug_snapshot=requirement->>'slug'
          AND v.data_snapshot->>'class'=source#>>'{data_snapshot,class}') THEN RETURN false; END IF;
    ELSE RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

-- Rebuild only the reserved child pins owned by active exact source choices.
-- All other rows and frozen manifests are retained byte for byte. Child IDs
-- remain stable on replay, save, reload and unrelated class edits.
CREATE FUNCTION private.prepare_builder_class_feature_choices_v1(target uuid,pending_choices jsonb,graph jsonb,
  strict_choice_id text,supplemental_refs jsonb DEFAULT '[]')
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; refs jsonb; sources jsonb; definitions jsonb:='[]';
  source jsonb; entry jsonb; effect jsonb; choice jsonb; values_list jsonb; chosen jsonb; choices_map jsonb;
  claims jsonb:='[]'; accepted jsonb; style_keys jsonb; definition jsonb; dependency jsonb; pin jsonb; projected jsonb; prior_ids text[]:='{}'; active_ids text[]:='{}';
  count_sources integer; mode text; class_slug text; item record; is_strict boolean;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(pending_choices) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(graph->'refs') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(graph->'spells') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(supplemental_refs) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(graph->'refs')+pg_catalog.jsonb_array_length(supplemental_refs)>4096
    OR pg_catalog.octet_length(graph::text)+pg_catalog.octet_length(supplemental_refs::text)>8388608 THEN
    RAISE EXCEPTION 'builder_feature_choice_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  choices_map:=COALESCE(pending_choices->'resolved_choices','{}');
  IF pg_catalog.jsonb_typeof(choices_map) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'builder_feature_choice_unavailable' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(r.value),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value)
    WHERE COALESCE(r.value->>'choice_source','') NOT LIKE 'builder:feature-choice:%'
      AND COALESCE(r.value->>'choice_source','') NOT LIKE 'builder:fighting-style:%';
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)||pg_catalog.jsonb_build_object('_source_ref',r.value)),'[]') INTO sources
    FROM pg_catalog.jsonb_array_elements(refs||supplemental_refs) r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer;
  IF pg_catalog.jsonb_array_length(sources)<>pg_catalog.jsonb_array_length(refs||supplemental_refs)
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(refs||supplemental_refs) r(value)
      WHERE r.value->>'character_id' IS DISTINCT FROM target::text)
    OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(refs||supplemental_refs))
      <>pg_catalog.jsonb_array_length(refs||supplemental_refs) THEN
    RAISE EXCEPTION 'builder_feature_choice_sources_unavailable' USING ERRCODE='23514'; END IF;
  FOR source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources) LOOP
    FOR effect IN SELECT value FROM pg_catalog.jsonb_array_elements(source->'effects_snapshot') WHERE value->>'type'='choice' LOOP
      definitions:=definitions||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',source,'choice',effect));
    END LOOP;
    IF source->>'content_type_snapshot'='feature' AND source#>>'{data_snapshot,feature_type}'='fighting_style'
      AND pg_catalog.jsonb_typeof(source#>'{data_snapshot,choices}')='array'
      AND pg_catalog.jsonb_array_length(source#>'{data_snapshot,choices}')>0 THEN
      IF pg_catalog.jsonb_array_length(source#>'{data_snapshot,choices}')<>1
        OR source#>'{data_snapshot,choices,0,count}' IS DISTINCT FROM '1'::jsonb THEN
        RAISE EXCEPTION 'builder_style_source_unavailable' USING ERRCODE='23514'; END IF;
      effect:=pg_catalog.jsonb_build_object('type','choice','choice_id',source->>'slug_snapshot','choose',1,
        'from',source#>'{data_snapshot,choices,0,options}','grant_type','fighting_style');
      definitions:=definitions||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',source,'choice',effect));
    END IF;
  END LOOP;
  SELECT COALESCE(array_agg(DISTINCT e.value->>'choice_id'),'{}') INTO prior_ids
    FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
    WHERE e.value->>'type'='choice' AND e.value->>'grant_type' IN ('feature','invocation','favored_terrain');
  SELECT prior_ids||COALESCE(array_agg(DISTINCT v.slug_snapshot),'{}') INTO prior_ids
    FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE v.content_type_snapshot='feature' AND v.data_snapshot->>'feature_type'='fighting_style'
      AND pg_catalog.jsonb_typeof(v.data_snapshot->'choices')='array' AND pg_catalog.jsonb_array_length(v.data_snapshot->'choices')>0;

  -- Validate all claims before picking a winner. Duplicates across tiers are
  -- removed from every claim on pruning; traversal order never grants one.
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(definitions)
    WHERE value#>>'{choice,grant_type}' IN ('feature','invocation','favored_terrain','fighting_style') LOOP
    source:=entry->'source'; choice:=entry->'choice'; is_strict:=choice->>'choice_id'=strict_choice_id;
    active_ids:=array_append(active_ids,choice->>'choice_id');
    SELECT count(*) INTO count_sources FROM pg_catalog.jsonb_array_elements(definitions) d(value)
      WHERE d.value#>>'{choice,choice_id}'=choice->>'choice_id';
    IF source->>'content_type_snapshot'<>'feature' OR source#>'{_source_ref,feature_grant_id}'='null'::jsonb
      OR count_sources<>1 OR pg_catalog.jsonb_typeof(choice->'from') IS DISTINCT FROM 'array'
      OR COALESCE(choice->>'choose','') !~ '^[1-9][0-9]{0,2}$' THEN
      RAISE EXCEPTION 'builder_feature_choice_source_unavailable' USING ERRCODE='23514'; END IF;
    choice:=private.builder_invocation_choice_v1(target,pending_choices,graph,choice);
    values_list:=COALESCE(choices_map->(choice->>'choice_id'),'[]'); accepted:='[]';
    IF pg_catalog.jsonb_typeof(values_list) IS DISTINCT FROM 'array' THEN
      IF is_strict THEN RAISE EXCEPTION 'builder_feature_choice_unavailable' USING ERRCODE='22023'; END IF;
      values_list:='[]';
    END IF;
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(values_list) LOOP
      IF pg_catalog.jsonb_typeof(chosen)='string' AND (choice->'from') @> pg_catalog.jsonb_build_array(chosen)
        AND NOT accepted @> pg_catalog.jsonb_build_array(chosen) AND pg_catalog.jsonb_array_length(accepted)<(choice->>'choose')::integer THEN
        accepted:=accepted||pg_catalog.jsonb_build_array(chosen);
      END IF;
    END LOOP;
    IF is_strict AND accepted IS DISTINCT FROM values_list THEN
      RAISE EXCEPTION 'builder_feature_choice_unavailable' USING ERRCODE='22023'; END IF;
    style_keys:='{}';
    IF choice->>'grant_type'='fighting_style' THEN
      FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(accepted) LOOP
        dependency:=private.builder_catalog_dependency_v1(target,source,'feature',chosen#>>'{}');
        style_keys:=style_keys||pg_catalog.jsonb_build_object(chosen#>>'{}',pg_catalog.lower(dependency->>'name_snapshot'));
      END LOOP;
    END IF;
    claims:=claims||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source',source,'choice',choice,'selections',accepted,'style_keys',style_keys));
  END LOOP;
  choices_map:=choices_map-(SELECT COALESCE(array_agg(id),'{}') FROM unnest(prior_ids) AS id WHERE NOT id=ANY(active_ids));

  -- Ordinary feature picks precede invocations, so pact prerequisites use the
  -- newly accepted actual child pin, not a client-provided feature name.
  FOREACH mode IN ARRAY ARRAY['favored_terrain','fighting_style','feature','invocation'] LOOP
    FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(claims) WHERE value#>>'{choice,grant_type}'=mode
      ORDER BY value#>>'{choice,choice_id}' LOOP
      source:=entry->'source'; choice:=entry->'choice'; accepted:='[]'; is_strict:=choice->>'choice_id'=strict_choice_id;
      FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(entry->'selections') LOOP
        IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(claims) c(value)
          CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(c.value->'selections') s(value)
          WHERE c.value#>>'{choice,grant_type}'=mode AND (CASE WHEN mode='fighting_style'
            THEN c.value#>>ARRAY['style_keys',s.value#>>'{}']=entry#>>ARRAY['style_keys',chosen#>>'{}'] ELSE s.value=chosen END))<>1 THEN CONTINUE; END IF;
        IF mode='favored_terrain' THEN accepted:=accepted||pg_catalog.jsonb_build_array(chosen); CONTINUE; END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(source#>'{data_snapshot,choices}') c(value)
          WHERE c.value->'options' @> pg_catalog.jsonb_build_array(chosen)) THEN
          RAISE EXCEPTION 'builder_feature_choice_manifest_unavailable' USING ERRCODE='23514'; END IF;
        dependency:=private.builder_catalog_dependency_v1(target,source,'feature',chosen#>>'{}');
        projected:=graph||pg_catalog.jsonb_build_object('refs',refs);
        IF mode='fighting_style' THEN
          IF dependency#>>'{data_snapshot,class}' IS DISTINCT FROM source#>>'{data_snapshot,class}'
            OR COALESCE(dependency#>>'{data_snapshot,feature_type}','') NOT IN ('passive','fighting_style') THEN
            RAISE EXCEPTION 'builder_fighting_style_unavailable' USING ERRCODE='22023'; END IF;
        ELSIF NOT private.builder_feature_option_eligible_v1(target,pending_choices,projected,source,dependency) THEN CONTINUE; END IF;
        class_slug:=source#>>'{data_snapshot,class}';
        IF mode='fighting_style' THEN
          pin:=private.builder_catalog_pin_v1(target,dependency,pg_catalog.jsonb_build_object('source','fighting_style',
            'class',class_slug,'feature',source->>'slug_snapshot'),'builder:fighting-style:'||(source->>'slug_snapshot'),NULL,cap.protected_graph->'refs');
        ELSE
          pin:=private.builder_catalog_pin_v1(target,dependency,pg_catalog.jsonb_build_object('source','class_feature_choice',
            'class',class_slug,'feature',source->>'slug_snapshot','choice_id',choice->>'choice_id',
            'source_ref_id',source#>>'{_source_ref,id}'),
            'builder:feature-choice:'||(source#>>'{_source_ref,id}')||':'||(choice->>'choice_id'),NULL,cap.protected_graph->'refs');
        END IF;
        refs:=refs||pg_catalog.jsonb_build_array(pin); accepted:=accepted||pg_catalog.jsonb_build_array(chosen);
      END LOOP;
      IF is_strict AND accepted IS DISTINCT FROM entry->'selections' THEN
        RAISE EXCEPTION 'builder_feature_choice_prerequisite_unavailable' USING ERRCODE='22023'; END IF;
      IF choices_map ? (choice->>'choice_id') OR accepted<>'[]'::jsonb THEN
        choices_map:=pg_catalog.jsonb_set(choices_map,ARRAY[choice->>'choice_id'],accepted,true);
      END IF;
    END LOOP;
  END LOOP;
  IF pg_catalog.jsonb_array_length(refs)>4096 OR pg_catalog.octet_length(refs::text)>8388608
    OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(refs))<>pg_catalog.jsonb_array_length(refs) THEN
    RAISE EXCEPTION 'builder_feature_choice_graph_bound' USING ERRCODE='54000'; END IF;
  IF choices_map IS DISTINCT FROM COALESCE(pending_choices->'resolved_choices','{}') THEN
    pending_choices:=pg_catalog.jsonb_set(pending_choices,'{resolved_choices}',choices_map,true); END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO refs FROM pg_catalog.jsonb_array_elements(refs);
  RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph||pg_catalog.jsonb_build_object('refs',refs));
END $$;

-- The installation profile is restricted to the reviewed multiclass source.
-- Existing planner attributes and ACLs survive pg_get_functiondef replacement.
DO $profiles$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; needle text; insertion text; definition text; start_pos integer; end_pos integer;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','a42a35c4646b26a33ec91a3402dcfae4','8175fff619fa2ba56962e30fcb04a843','catalog'),
    ('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)','d0f8cb403bc4e03dfa0c7d80b61bd4c3','97e29472187cb63fef0da670b6f4eea6','progression'),
    ('private.prepare_builder_acquisition_v1(uuid,uuid,jsonb)','ed2c8225db562571db783f688b59ba3b','f08844d4d198b17b4f83353cfe9c2bab','acquisition')
  ) wanted(signature,body_md5,next_md5,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole::oid
      OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR original.prosecdef IS DISTINCT FROM true OR original.provolatile<>'v'
      OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.body_md5 THEN
      RAISE EXCEPTION 'builder_feature_choice_preimage_changed' USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
    IF item.kind='catalog' THEN
      needle:=$count$    IF choice_count<>1 OR choice->>'choose' !~ '^[1-9][0-9]{0,2}$'$count$;
      insertion:=$count$    IF command='class_choice' AND choice_count=1 THEN
      choice:=private.builder_invocation_choice_v1(target,next_choices,cap.protected_graph,choice);
    END IF;
$count$||needle;
      IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
        RAISE EXCEPTION 'builder_feature_choice_count_source_mismatch' USING ERRCODE='42501'; END IF;
      source:=pg_catalog.replace(source,needle,pg_catalog.replace(insertion,E'\r\n',E'\n'));
      needle:=$style$      WHERE g.character_id=target AND g.controller_ref_id=(occurrence->>'controller_ref_id')::uuid
        AND g.feature_slug=fields->>'feature_slug' AND g.unlock_level<=selected_level AND v.data_snapshot->>'feature_type'='fighting_style';$style$;
      insertion:=$style$      WHERE g.character_id=target AND (g.controller_ref_id=(occurrence->>'controller_ref_id')::uuid
          OR g.controller_ref_id=(occurrence->>'subclass_ref_id')::uuid)
        AND g.feature_slug=fields->>'feature_slug' AND g.unlock_level<=selected_level AND v.data_snapshot->>'feature_type'='fighting_style';$style$;
      needle:=pg_catalog.replace(needle,E'\r\n',E'\n'); insertion:=pg_catalog.replace(insertion,E'\r\n',E'\n');
      IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
        RAISE EXCEPTION 'builder_feature_choice_style_source_mismatch' USING ERRCODE='42501'; END IF;
      source:=pg_catalog.replace(source,needle,insertion);
      start_pos:=pg_catalog.strpos(source,'  -- Fighting styles are finite child feature choices on active pinned manifests.');
      end_pos:=pg_catalog.strpos(source,'  -- Complete subclass manifests retain all frozen grants, activating');
      IF start_pos<1 OR end_pos<=start_pos THEN RAISE EXCEPTION 'builder_feature_choice_style_block_mismatch' USING ERRCODE='42501'; END IF;
      source:=pg_catalog.left(source,start_pos-1)||pg_catalog.substr(source,end_pos);
      insertion:=$catalog$  normalized:=private.prepare_builder_class_feature_choices_v1(target,next_choices,expected,
    CASE WHEN command='class_choice' THEN fields->>'choice_id' WHEN command='fighting_style' THEN fields->>'feature_slug' ELSE NULL END,
    race_refs||(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot='background'));
  next_choices:=normalized->'choices'; expected:=normalized->'graph'; refs:=expected->'refs';
$catalog$;
    ELSIF item.kind='progression' THEN
      insertion:=$progression$  normalized:=private.prepare_builder_class_feature_choices_v1(target,next_choices,expected,NULL,
    (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot IN ('race','subrace','background')));
  next_choices:=normalized->'choices'; expected:=normalized->'graph'; refs:=expected->'refs';
$progression$;
    ELSE
      insertion:=$acquisition$  entry:=private.prepare_builder_class_feature_choices_v1(target,next_choices,expected,NULL,
    (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot IN ('race','subrace','background')));
  next_choices:=entry->'choices'; expected:=entry->'graph'; refs:=expected->'refs';
$acquisition$;
    END IF;
    needle:=$sort$  FOREACH domain IN ARRAY ARRAY['refs','feature_grants','spell_grants','spells','occurrences'] LOOP$sort$;
    IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
      RAISE EXCEPTION 'builder_feature_choice_planner_source_mismatch' USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(source,needle,pg_catalog.replace(insertion,E'\r\n',E'\n')||needle);
    IF pg_catalog.md5(replacement)<>item.next_md5 THEN
      RAISE EXCEPTION 'builder_feature_choice_postimage_changed' USING ERRCODE='42501'; END IF;
    definition:=pg_catalog.pg_get_functiondef(original.oid);
    EXECUTE pg_catalog.replace(definition,original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF NOT FOUND OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
      OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
      OR repaired.provolatile IS DISTINCT FROM original.provolatile OR repaired.prosrc IS DISTINCT FROM replacement THEN
      RAISE EXCEPTION 'builder_feature_choice_profile_closure_failed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $profiles$;

ALTER FUNCTION private.builder_invocation_choice_v1(uuid,jsonb,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION private.builder_feature_option_eligible_v1(uuid,jsonb,jsonb,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.builder_invocation_choice_v1(uuid,jsonb,jsonb,jsonb),
  private.builder_feature_option_eligible_v1(uuid,jsonb,jsonb,jsonb,jsonb),private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid IN ('private.builder_invocation_choice_v1(uuid,jsonb,jsonb,jsonb)'::pg_catalog.regprocedure,
        'private.builder_feature_option_eligible_v1(uuid,jsonb,jsonb,jsonb,jsonb)'::pg_catalog.regprocedure,
        'private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)'::pg_catalog.regprocedure) AND a.grantee<>p.proowner)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_feature_choice_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
