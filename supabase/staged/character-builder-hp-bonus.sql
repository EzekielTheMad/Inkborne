-- STAGED ONLY: finite immutable subclass HP metadata parity for native builder
-- current-HP clamps. Install after character-builder-subclass-update.sql.
-- No saved pin/snapshot/catalog/history rewrite and no activation gate change.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.describe_builder_subclass_update_v1(uuid,uuid,integer)') IS NULL
    OR pg_catalog.to_regprocedure('private.prepare_builder_class_removal_v1(uuid,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_hp_bonus_installation_unavailable' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)')
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))='59eac94525f960c399a080e6c758cb12'
      AND proowner='postgres'::pg_catalog.regrole AND prosecdef AND provolatile='s' AND proconfig=ARRAY['search_path=""']::text[])
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid=pg_catalog.to_regprocedure('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)')
        AND (a.privilege_type<>'EXECUTE' OR a.grantee<>p.proowner)) THEN
    RAISE EXCEPTION 'builder_hp_bonus_dependency_changed' USING ERRCODE='42501'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION private.builder_multiclass_max_hp_v1(target uuid,choices jsonb,graph jsonb) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE original uuid:=(private.builder_original_occurrence_v1(target)->>'id')::uuid;
  parent public.characters%ROWTYPE; picked jsonb; occurrence jsonb; pin jsonb; subclass_pin jsonb;
  definition public.content_versions%ROWTYPE; subclass_definition public.content_versions%ROWTYPE;
  scores jsonb:=private.builder_progression_scores_v1(target,choices); con_mod integer; result integer:=0;
  class_level integer; selected_level integer; contribution integer; matches integer; classes integer; subclasses integer; die integer;
  subclass_gate integer; subclass_start integer;
BEGIN
  SELECT * INTO parent FROM public.characters WHERE id=target;
  IF NOT FOUND OR original IS NULL OR pg_catalog.jsonb_typeof(choices->'classes') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(graph->'refs') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(graph->'occurrences') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(scores->'constitution') IS DISTINCT FROM 'number'
    OR scores->>'constitution' !~ '^-?[0-9]+$' THEN
    RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
  classes:=pg_catalog.jsonb_array_length(choices->'classes');
  IF classes NOT BETWEEN 1 AND 20
    OR (SELECT count(DISTINCT value->>'slug') FROM pg_catalog.jsonb_array_elements(choices->'classes'))<>classes
    OR (SELECT count(DISTINCT value->>'occurrence_id') FROM pg_catalog.jsonb_array_elements(choices->'classes'))<>classes
    OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(graph->'refs'))<>pg_catalog.jsonb_array_length(graph->'refs')
    OR (SELECT count(DISTINCT value->>'id') FROM pg_catalog.jsonb_array_elements(graph->'occurrences'))<>pg_catalog.jsonb_array_length(graph->'occurrences')
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(graph->'occurrences') WHERE value->>'lifecycle'<>'ended')<>classes
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(choices->'classes') WHERE value->>'occurrence_id'=original::text)<>1 THEN
    RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO subclasses FROM pg_catalog.jsonb_array_elements(choices->'classes') WHERE value ? 'subclass';
  -- Every root must belong to exactly one selected occurrence. A stray/duplicate
  -- subclass carrying a bonus cannot contribute, or silently disappear here.
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value)
      JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
      WHERE v.content_type_snapshot='class')<>classes
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(graph->'refs') r(value)
      JOIN public.content_versions v ON v.content_id=(r.value->>'content_id')::uuid AND v.version=(r.value->>'content_version')::integer
      WHERE v.content_type_snapshot='subclass')<>subclasses THEN
    RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
  con_mod:=floor(((scores->>'constitution')::numeric-10)/2)::integer;
  FOR picked IN SELECT value FROM pg_catalog.jsonb_array_elements(choices->'classes') LOOP
    IF NOT private.builder_uuid_v1(picked->>'occurrence_id') OR pg_catalog.jsonb_typeof(picked->'slug') IS DISTINCT FROM 'string'
      OR length(pg_catalog.btrim(picked->>'slug')) NOT BETWEEN 1 AND 200
      OR pg_catalog.jsonb_typeof(picked->'level') IS DISTINCT FROM 'number' OR picked->>'level' !~ '^[1-9][0-9]?$'
      OR (picked->>'level')::integer NOT BETWEEN 1 AND 20
      OR (picked ? 'subclass' AND (pg_catalog.jsonb_typeof(picked->'subclass') IS DISTINCT FROM 'string'
        OR length(pg_catalog.btrim(picked->>'subclass')) NOT BETWEEN 1 AND 200)) THEN
      RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
    selected_level:=(picked->>'level')::integer;
    SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,occurrence FROM pg_catalog.jsonb_array_elements(graph->'occurrences')
      WHERE value->>'id'=picked->>'occurrence_id' AND value->>'lifecycle'<>'ended';
    IF matches<>1 OR occurrence->>'character_id' IS DISTINCT FROM target::text
      OR occurrence->>'system_id' IS DISTINCT FROM parent.system_id::text OR occurrence->>'class_slug' IS DISTINCT FROM picked->>'slug' THEN
      RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
    SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,pin FROM pg_catalog.jsonb_array_elements(graph->'refs')
      WHERE value->'id'=occurrence->'controller_ref_id';
    IF matches<>1 OR pin->>'character_id' IS DISTINCT FROM target::text OR pin->'content_id' IS DISTINCT FROM occurrence->'content_id'
      OR pin->'content_version' IS DISTINCT FROM occurrence->'content_version' OR pin->'feature_grant_id' IS DISTINCT FROM 'null'::jsonb
      OR pin#>>'{context,source}' IS DISTINCT FROM 'class' THEN
      RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
    SELECT * INTO definition FROM public.content_versions WHERE content_id=(pin->>'content_id')::uuid AND version=(pin->>'content_version')::integer;
    IF NOT FOUND OR definition.content_type_snapshot<>'class' OR definition.slug_snapshot IS DISTINCT FROM picked->>'slug'
      OR definition.system_id_snapshot IS DISTINCT FROM parent.system_id OR pg_catalog.jsonb_typeof(definition.data_snapshot->'hit_die') IS DISTINCT FROM 'number'
      OR definition.data_snapshot->>'hit_die' NOT IN ('4','6','8','10','12') THEN
      RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
    die:=(definition.data_snapshot->>'hit_die')::integer;
    FOR class_level IN 1..selected_level LOOP
      contribution:=CASE WHEN class_level=1 AND (picked->>'occurrence_id')::uuid=original THEN die
        ELSE COALESCE((choices#>>ARRAY['hp_rolls',(picked->>'slug')||'-'||class_level,'value'])::integer,die/2+1) END;
      result:=result+GREATEST(1,contribution+con_mod);
    END LOOP;
    IF picked ? 'subclass' THEN
      SELECT count(*),pg_catalog.jsonb_agg(value)->0 INTO matches,subclass_pin FROM pg_catalog.jsonb_array_elements(graph->'refs')
        WHERE value->'id'=occurrence->'subclass_ref_id';
      IF matches<>1 OR subclass_pin->>'character_id' IS DISTINCT FROM target::text OR subclass_pin->'feature_grant_id' IS DISTINCT FROM 'null'::jsonb
        OR subclass_pin->'context' IS DISTINCT FROM pg_catalog.jsonb_build_object('source','subclass','class',picked->>'slug')
        OR subclass_pin->>'choice_source' IS DISTINCT FROM 'builder:subclass:'||(picked->>'occurrence_id') THEN
        RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
      SELECT * INTO subclass_definition FROM public.content_versions WHERE content_id=(subclass_pin->>'content_id')::uuid AND version=(subclass_pin->>'content_version')::integer;
      IF NOT FOUND OR subclass_definition.content_type_snapshot<>'subclass' OR subclass_definition.slug_snapshot IS DISTINCT FROM picked->>'subclass'
        OR subclass_definition.system_id_snapshot IS DISTINCT FROM parent.system_id
        OR subclass_definition.data_snapshot->>'parent_class' IS DISTINCT FROM picked->>'slug' THEN
        RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
      IF subclass_definition.data_snapshot ? 'hit_points_bonus_per_class_level' THEN
        IF subclass_definition.data_snapshot->'hit_points_bonus_per_class_level' IS DISTINCT FROM '1'::jsonb THEN
          RAISE EXCEPTION 'builder_hp_bonus_metadata_unavailable' USING ERRCODE='23514'; END IF;
        IF pg_catalog.jsonb_typeof(definition.data_snapshot->'levels') IS DISTINCT FROM 'array'
          OR pg_catalog.jsonb_typeof(subclass_definition.data_snapshot->'levels') IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
        IF pg_catalog.jsonb_array_length(definition.data_snapshot->'levels')=0
          OR pg_catalog.jsonb_array_length(subclass_definition.data_snapshot->'levels')=0
          OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(definition.data_snapshot->'levels') l(value)
            WHERE pg_catalog.jsonb_typeof(l.value->'level') IS DISTINCT FROM 'number' OR l.value->>'level' !~ '^([1-9]|1[0-9]|20)$'
              OR (l.value ? 'subclass_level' AND pg_catalog.jsonb_typeof(l.value->'subclass_level') IS DISTINCT FROM 'boolean'))
          OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(subclass_definition.data_snapshot->'levels') l(value)
            WHERE pg_catalog.jsonb_typeof(l.value->'level') IS DISTINCT FROM 'number' OR l.value->>'level' !~ '^([1-9]|1[0-9]|20)$')
          OR (SELECT count(DISTINCT value->'level') FROM pg_catalog.jsonb_array_elements(definition.data_snapshot->'levels'))<>pg_catalog.jsonb_array_length(definition.data_snapshot->'levels')
          OR (SELECT count(DISTINCT value->'level') FROM pg_catalog.jsonb_array_elements(subclass_definition.data_snapshot->'levels'))<>pg_catalog.jsonb_array_length(subclass_definition.data_snapshot->'levels')
          OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(definition.data_snapshot->'levels') WHERE value->'level'=pg_catalog.to_jsonb(selected_level)) THEN
          RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
        SELECT min((value->>'level')::integer) INTO subclass_gate FROM pg_catalog.jsonb_array_elements(definition.data_snapshot->'levels')
          WHERE value->'subclass_level'='true'::jsonb;
        SELECT min((value->>'level')::integer) INTO subclass_start FROM pg_catalog.jsonb_array_elements(subclass_definition.data_snapshot->'levels');
        IF subclass_gate IS NULL OR selected_level<subclass_gate OR selected_level<subclass_start THEN
          RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
        -- The bonus increases the maximum after the ordinary minimum gain per
        -- level. It follows the owning class level, including secondary L1.
        result:=result+selected_level;
      END IF;
    ELSIF occurrence->'subclass_ref_id' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF (SELECT sum((value->>'level')::integer) FROM pg_catalog.jsonb_array_elements(choices->'classes')) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'builder_hp_bonus_graph_unavailable' USING ERRCODE='23514'; END IF;
  RETURN result;
END $$;

DO $closed$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid='private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)'::pg_catalog.regprocedure
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))='6f4e810b99cfd755babcc0fc058c2431'
      AND proowner='postgres'::pg_catalog.regrole AND prosecdef AND provolatile='s' AND proconfig=ARRAY['search_path=""']::text[])
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE p.oid='private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)'::pg_catalog.regprocedure AND (a.privilege_type<>'EXECUTE' OR a.grantee<>p.proowner))
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_hp_bonus_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
