-- Disposable-profile companion, after progression and race-score repair.
-- Expertise uses genuine active immutable pins and existing finite commands.
-- No original-class proof, readiness gate, finisher, grant lineage or history
-- is created or relaxed. Existing pinned narrative-only versions stay unchanged.
BEGIN;

DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)') IS NULL
    OR pg_catalog.to_regprocedure('private.normalize_builder_expertise_v1(uuid,jsonb,jsonb,text)') IS NOT NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(
      'private.character_ability_scores_before_builder_progression_v1(uuid,uuid,text,text)')
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))='46503e95f31b45f99ec5541ce0192cf7') THEN
    RAISE EXCEPTION 'builder_expertise_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

-- The only accepted aliases are exact skill names. No arbitrary tool name or
-- stat suffix can become Expertise eligibility.
CREATE FUNCTION private.builder_expertise_proficiency_v1(value text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE
    WHEN value='thieves-tools' THEN value
    WHEN (CASE WHEN value LIKE 'skill-%' THEN pg_catalog.substr(value,7) ELSE value END) IN ('acrobatics','animal-handling','arcana','athletics','deception',
      'history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion',
      'religion','sleight-of-hand','stealth','survival')
      THEN CASE WHEN value LIKE 'skill-%' THEN value ELSE 'skill-'||value END
    ELSE NULL END
$$;

-- active_refs is compiled only by the existing server-side graph planners.
-- Joining each exact content_id/version reads snapshots, never mutable heads.
-- This helper changes only source-owned Expertise entries in resolved_choices.
CREATE FUNCTION private.normalize_builder_expertise_v1(target uuid,pending_choices jsonb,active_refs jsonb,strict_choice_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
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
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)),'[]') INTO sources
    FROM pg_catalog.jsonb_array_elements(active_refs) r(value) JOIN public.content_versions v
      ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer;
  IF pg_catalog.jsonb_array_length(sources)<>pg_catalog.jsonb_array_length(active_refs) THEN
    RAISE EXCEPTION 'builder_expertise_sources_unavailable' USING ERRCODE='23514'; END IF;
  choices_map:=COALESCE(pending_choices->'resolved_choices','{}');
  IF pg_catalog.jsonb_typeof(choices_map) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'builder_expertise_choices_unavailable' USING ERRCODE='23514'; END IF;

  FOR source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources) LOOP
    class_allowed:=source->>'content_type_snapshot'<>'class' OR COALESCE((
      pg_catalog.jsonb_typeof(pending_choices->'classes')='array'
      AND pg_catalog.jsonb_array_length(pending_choices->'classes')=1
      AND pending_choices#>>'{classes,0,slug}'=source->>'slug_snapshot'),false);
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

-- Profile three existing planners. Replacement counts and full body hashes
-- reject drift; pg_get_functiondef preserves owner/ACL and routine attributes.
DO $profiles$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; needle text; insertion text; definition text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','d66d7dc3f0cc06e8ccfd1c2d98aa12d5','18863da6716ad4e18aa59c4a596d3a52','catalog'),
    ('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)','96cf137a75a162e435e349de70323ca1','c2d24db409de1cb538f340d0742f5bd8','progression'),
    ('public.character_builder_command_before_catalog_v1(jsonb,jsonb)','2afef22d9ed582b85c56d7ad4735e7c7','8cceb057257f8ce9eed3af251c0c3cb6','background')
  ) wanted(signature,body_md5,next_md5,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole::oid
      OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR original.prosecdef IS DISTINCT FROM true OR original.provolatile<>'v'
      OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.body_md5 THEN
      RAISE EXCEPTION 'builder_expertise_preimage_changed' USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
    IF item.kind='catalog' THEN
      needle:='  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->''classes'',expected_choices=next_choices';
      insertion:=$catalog$  next_choices:=private.normalize_builder_expertise_v1(target,next_choices,
    refs||race_refs||(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot='background'),
    CASE WHEN command='class_choice' THEN fields->>'choice_id' ELSE NULL END);
$catalog$||needle;
    ELSIF item.kind='progression' THEN
      needle:='  UPDATE private.character_builder_capabilities_v1 SET expected_graph=expected,expected_classes=next_choices->''classes'',expected_choices=next_choices,';
      insertion:=$progression$  next_choices:=private.normalize_builder_expertise_v1(target,next_choices,
    refs||(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot IN ('race','subrace','background')),NULL);
$progression$||needle;
    ELSE
      needle:='  saved:=private.finish_builder_step_v1(p_context,target);';
      insertion:=$background$  IF command IN ('select_background','background_choice') THEN
    SELECT choices INTO next_choices FROM public.characters WHERE id=target AND user_id=actor;
    next_choices:=private.normalize_builder_expertise_v1(target,next_choices,
      (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)),'[]') FROM public.character_content_refs r WHERE r.character_id=target),NULL);
    UPDATE public.characters SET choices=next_choices WHERE id=target AND user_id=actor AND choices IS DISTINCT FROM next_choices;
  END IF;
$background$||needle;
    END IF;
    IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
      RAISE EXCEPTION 'builder_expertise_source_mismatch' USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(source,needle,insertion);
    IF pg_catalog.md5(replacement)<>item.next_md5 THEN
      RAISE EXCEPTION 'builder_expertise_postimage_changed' USING ERRCODE='42501'; END IF;
    definition:=pg_catalog.pg_get_functiondef(original.oid);
    EXECUTE pg_catalog.replace(definition,original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF NOT FOUND OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
      OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
      OR repaired.provolatile IS DISTINCT FROM original.provolatile OR repaired.prosrc IS DISTINCT FROM replacement
      OR pg_catalog.md5(pg_catalog.replace(repaired.prosrc,E'\r\n',E'\n'))<>item.next_md5 THEN
      RAISE EXCEPTION 'builder_expertise_profile_closure_failed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $profiles$;

ALTER FUNCTION private.builder_expertise_proficiency_v1(text) OWNER TO postgres;
ALTER FUNCTION private.normalize_builder_expertise_v1(uuid,jsonb,jsonb,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.builder_expertise_proficiency_v1(text),private.normalize_builder_expertise_v1(uuid,jsonb,jsonb,text)
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
      WHERE p.oid IN ('private.builder_expertise_proficiency_v1(text)'::pg_catalog.regprocedure,
        'private.normalize_builder_expertise_v1(uuid,jsonb,jsonb,text)'::pg_catalog.regprocedure) AND a.grantee<>p.proowner)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_expertise_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
