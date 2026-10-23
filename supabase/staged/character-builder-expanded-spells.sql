-- Disposable native companion, after character-builder-bonus-spells.sql.
-- Expanded spells extend an ordinary list. They never create free spell grants,
-- alter known-spell budgets, or reinterpret an older immutable subclass pin.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.builder_expanded_spell_slugs_v1(uuid,jsonb,jsonb,text,integer)') IS NOT NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_expanded_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

CREATE FUNCTION private.builder_expanded_spell_slugs_v1(target uuid,pending_choices jsonb,graph jsonb,class_slug text,class_level integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; class_choice jsonb; occurrence jsonb; controller jsonb; patron jsonb;
  tiers jsonb; tier jsonb; spell_slug jsonb; result jsonb:='[]'; seen_levels integer[]:='{}'; seen_slugs text[]:='{}'; unlock integer;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(graph->'refs') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(graph->'occurrences') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(graph->'refs')>4096 OR pg_catalog.octet_length(graph::text)>8388608 THEN
    RAISE EXCEPTION 'builder_expanded_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  IF class_slug<>'warlock' THEN RETURN result; END IF;
  SELECT c.value INTO class_choice FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value)
    WHERE c.value->>'slug'=class_slug;
  IF class_choice IS NULL THEN RETURN result; END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value) WHERE c.value->>'slug'=class_slug)<>1
    OR class_choice->>'level' IS DISTINCT FROM class_level::text THEN
    RAISE EXCEPTION 'builder_expanded_class_unavailable' USING ERRCODE='23514'; END IF;
  SELECT o.value INTO occurrence FROM pg_catalog.jsonb_array_elements(graph->'occurrences') o(value)
    WHERE o.value->>'id'=class_choice->>'occurrence_id' AND o.value->>'class_slug'=class_slug
      AND o.value->>'character_id'=target::text AND o.value->>'lifecycle'<>'ended';
  IF occurrence IS NULL OR occurrence->'subclass_ref_id'='null'::jsonb THEN RETURN result; END IF;
  SELECT pg_catalog.to_jsonb(v) INTO controller FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value)
    JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE r.value->>'id'=occurrence->>'controller_ref_id' AND r.value->>'character_id'=target::text
      AND v.content_type_snapshot='class' AND v.slug_snapshot=class_slug;
  SELECT pg_catalog.to_jsonb(v) INTO patron FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value)
    JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE r.value->>'id'=occurrence->>'subclass_ref_id' AND r.value->>'character_id'=target::text
      AND v.content_type_snapshot='subclass' AND v.slug_snapshot='fiend' AND v.data_snapshot->>'parent_class'='warlock'
      AND v.system_id_snapshot=(controller->>'system_id_snapshot')::uuid
      AND private.character_can_access_content_version(target,v.content_id,v.version);
  IF patron IS NULL OR class_choice->>'subclass' IS DISTINCT FROM 'fiend' OR NOT (patron->'data_snapshot') ? 'spellcastingExpanded' THEN RETURN result; END IF;
  tiers:=patron#>'{data_snapshot,spellcastingExpanded}';
  IF pg_catalog.jsonb_typeof(tiers) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(tiers) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'builder_expanded_manifest_unavailable' USING ERRCODE='23514'; END IF;
  FOR tier IN SELECT value FROM pg_catalog.jsonb_array_elements(tiers) LOOP
    IF NOT private.builder_exact_keys_v1(tier,ARRAY['level','spells']) OR pg_catalog.jsonb_typeof(tier->'level')<>'number'
      OR COALESCE(tier->>'level','') !~ '^([1-9]|1[0-9]|20)$' OR pg_catalog.jsonb_typeof(tier->'spells') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(tier->'spells') NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'builder_expanded_manifest_unavailable' USING ERRCODE='23514'; END IF;
    unlock:=(tier->>'level')::integer;
    IF unlock=ANY(seen_levels) THEN RAISE EXCEPTION 'builder_expanded_manifest_unavailable' USING ERRCODE='23514'; END IF;
    seen_levels:=array_append(seen_levels,unlock);
    FOR spell_slug IN SELECT value FROM pg_catalog.jsonb_array_elements(tier->'spells') LOOP
      IF pg_catalog.jsonb_typeof(spell_slug)<>'string' OR length(spell_slug#>>'{}') NOT BETWEEN 1 AND 200
        OR pg_catalog.btrim(spell_slug#>>'{}') IS DISTINCT FROM spell_slug#>>'{}' OR spell_slug#>>'{}'=ANY(seen_slugs) THEN
        RAISE EXCEPTION 'builder_expanded_manifest_unavailable' USING ERRCODE='23514'; END IF;
      seen_slugs:=array_append(seen_slugs,spell_slug#>>'{}');
      IF unlock<=class_level THEN result:=result||pg_catalog.jsonb_build_array(spell_slug); END IF;
    END LOOP;
  END LOOP;
  RETURN result;
END $$;

CREATE FUNCTION private.builder_expanded_spell_eligible_v1(target uuid,pending_choices jsonb,graph jsonb,class_slug text,class_level integer,spell_definition jsonb) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE earned jsonb; patron jsonb;
BEGIN
  earned:=private.builder_expanded_spell_slugs_v1(target,pending_choices,graph,class_slug,class_level);
  IF NOT earned @> pg_catalog.jsonb_build_array(spell_definition->>'slug_snapshot') THEN RETURN false; END IF;
  SELECT pg_catalog.to_jsonb(v) INTO patron FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value)
    JOIN pg_catalog.jsonb_array_elements(graph->'occurrences') o(value) ON o.value->>'id'=c.value->>'occurrence_id'
    JOIN pg_catalog.jsonb_array_elements(graph->'refs') r(value) ON r.value->'id'=o.value->'subclass_ref_id'
    JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE c.value->>'slug'=class_slug;
  RETURN spell_definition->>'content_type_snapshot'='spell'
    AND spell_definition->'system_id_snapshot'=patron->'system_id_snapshot'
    AND spell_definition->'scope_snapshot'=patron->'scope_snapshot'
    AND spell_definition->'source_snapshot'=patron->'source_snapshot'
    AND spell_definition->'owner_id_snapshot'=patron->'owner_id_snapshot';
END $$;

CREATE FUNCTION private.prepare_builder_expanded_spells_v1(target uuid,pending_choices jsonb,graph jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; before_level integer; after_level integer; before_slugs jsonb; after_slugs jsonb;
  spell_list jsonb; class_definition jsonb; spell_definition jsonb; entry jsonb; spells jsonb:='[]'; removed jsonb:='[]'; selections jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR pg_catalog.jsonb_typeof(graph->'spells') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'builder_expanded_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT (c.value->>'level')::integer INTO before_level FROM pg_catalog.jsonb_array_elements(cap.before_parent#>'{choices,classes}') c(value) WHERE c.value->>'slug'='warlock';
  SELECT (c.value->>'level')::integer INTO after_level FROM pg_catalog.jsonb_array_elements(pending_choices->'classes') c(value) WHERE c.value->>'slug'='warlock';
  IF before_level IS NULL THEN RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph); END IF;
  before_slugs:=private.builder_expanded_spell_slugs_v1(target,cap.before_parent->'choices',cap.protected_graph,'warlock',before_level);
  IF before_slugs='[]'::jsonb THEN RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph); END IF;
  after_slugs:=CASE WHEN after_level IS NULL THEN '[]'::jsonb ELSE private.builder_expanded_spell_slugs_v1(target,pending_choices,graph,'warlock',after_level) END;
  SELECT pg_catalog.to_jsonb(v) INTO class_definition FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') r(value)
    JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
    WHERE v.content_type_snapshot='class' AND v.slug_snapshot='warlock';
  spell_list:=COALESCE(class_definition#>'{data_snapshot,spellcastingList}',pg_catalog.jsonb_build_object('class','warlock','level',ARRAY[0,9]));
  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(graph->'spells') LOOP
    IF entry->>'class_slug'='warlock' AND entry->>'source'='selection' THEN
      SELECT pg_catalog.to_jsonb(v) INTO spell_definition FROM public.content_versions v
        WHERE v.content_id=(entry->>'content_id')::uuid AND v.version=(entry->>'content_version')::integer AND v.content_type_snapshot='spell';
      IF before_slugs @> pg_catalog.jsonb_build_array(spell_definition->>'slug_snapshot')
        AND NOT after_slugs @> pg_catalog.jsonb_build_array(spell_definition->>'slug_snapshot')
        AND NOT COALESCE(spell_definition#>'{data_snapshot,classes}','[]') @> pg_catalog.jsonb_build_array(spell_list->>'class') THEN
        removed:=removed||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('content_id',entry->'content_id','content_version',entry->'content_version'));
        CONTINUE;
      END IF;
    END IF;
    spells:=spells||pg_catalog.jsonb_build_array(entry);
  END LOOP;
  IF removed<>'[]'::jsonb AND pending_choices#>'{class_spell_selections,warlock}' IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(s.value),'[]') INTO selections FROM pg_catalog.jsonb_array_elements(pending_choices#>'{class_spell_selections,warlock}') s(value)
      WHERE NOT removed @> pg_catalog.jsonb_build_array(s.value-'prepared');
    pending_choices:=pg_catalog.jsonb_set(pending_choices,'{class_spell_selections,warlock}',selections);
  END IF;
  RETURN pg_catalog.jsonb_build_object('choices',pending_choices,'graph',graph||pg_catalog.jsonb_build_object('spells',spells));
END $$;

DO $profiles$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text; needle text; insertion text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.builder_progression_class_spells_v1(uuid,jsonb,integer,jsonb,jsonb,text)','b2535515321b201f5288845e8b0956e8','775ba0c2a3d98174e829174ed9319e8b','admission'),
    ('private.prepare_builder_bonus_spells_v1(uuid,jsonb,jsonb,text,text)','0a58bc2691fb4586a753ae2e8c7701b8','6dca5fc876104521adf8f9127e6ec294','normalizer')
  ) expected(signature,before_md5,after_md5,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
      OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.before_md5 THEN
      RAISE EXCEPTION 'builder_expanded_preimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
    IF item.kind='admission' THEN
      needle:='IF NOT COALESCE(selected.data_snapshot->''classes'',''[]'') @> pg_catalog.jsonb_build_array(spell_list->>''class'')';
      insertion:='IF NOT (COALESCE(selected.data_snapshot->''classes'',''[]'') @> pg_catalog.jsonb_build_array(spell_list->>''class'') OR private.builder_expanded_spell_eligible_v1(target,choices,(SELECT c.protected_graph FROM private.character_builder_capabilities_v1 c WHERE c.transaction_id=pg_catalog.pg_current_xact_id() AND c.character_id=target),class_slug,level,pg_catalog.to_jsonb(selected)))';
    ELSE
      needle:='RETURN pg_catalog.jsonb_build_object(''choices'',pending_choices,''graph'',graph||pg_catalog.jsonb_build_object(''refs'',refs,''spells'',spells));';
      insertion:='RETURN private.prepare_builder_expanded_spells_v1(target,pending_choices,graph||pg_catalog.jsonb_build_object(''refs'',refs,''spells'',spells));';
    END IF;
    IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'builder_expanded_fragment_changed' USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(source,needle,insertion);
    IF pg_catalog.md5(replacement)<>item.after_md5 THEN RAISE EXCEPTION 'builder_expanded_postimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF repaired.prosrc IS DISTINCT FROM replacement OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
      OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef OR repaired.provolatile IS DISTINCT FROM original.provolatile THEN
      RAISE EXCEPTION 'builder_expanded_profile_closure_failed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $profiles$;

ALTER FUNCTION private.builder_expanded_spell_slugs_v1(uuid,jsonb,jsonb,text,integer) OWNER TO postgres;
ALTER FUNCTION private.builder_expanded_spell_eligible_v1(uuid,jsonb,jsonb,text,integer,jsonb) OWNER TO postgres;
ALTER FUNCTION private.prepare_builder_expanded_spells_v1(uuid,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.builder_expanded_spell_slugs_v1(uuid,jsonb,jsonb,text,integer),private.builder_expanded_spell_eligible_v1(uuid,jsonb,jsonb,text,integer,jsonb),private.prepare_builder_expanded_spells_v1(uuid,jsonb,jsonb)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE') OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid IN ('private.builder_expanded_spell_slugs_v1(uuid,jsonb,jsonb,text,integer)'::pg_catalog.regprocedure,
        'private.builder_expanded_spell_eligible_v1(uuid,jsonb,jsonb,text,integer,jsonb)'::pg_catalog.regprocedure,
        'private.prepare_builder_expanded_spells_v1(uuid,jsonb,jsonb)'::pg_catalog.regprocedure) AND a.grantee<>p.proowner)
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'builder_expanded_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
NOTIFY pgrst,'reload schema';
COMMIT;
