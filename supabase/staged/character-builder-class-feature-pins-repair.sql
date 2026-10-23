-- Installed-old-helper repair, after class-feature choices, optionally after
-- the Favored Enemy tail profile. Fresh profiles use the corrected child stage.
-- Changes one closed routine; no character row or historical pin is rewritten.
BEGIN;
DO $repair$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; before_md5 text; after_md5 text; needle text; revised text;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_child_pin_repair_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(
    'private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)');
  IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}' THEN
    RAISE EXCEPTION 'builder_child_pin_repair_metadata_changed' USING ERRCODE='42501'; END IF;
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n'); before_md5:=pg_catalog.md5(source);
  after_md5:=CASE before_md5 WHEN '15ab056ef2de2f4857b578af584ec1b7' THEN '9d96150045a09c91a39eec343549964a'
    WHEN '8d3dfe19ebd128cb7e1b96ab7bcb6d7b' THEN '518793720d6c4abe638edec0c36e9fe1' ELSE NULL END;
  IF after_md5 IS NULL THEN RAISE EXCEPTION 'builder_child_pin_repair_preimage_changed' USING ERRCODE='42501'; END IF;
  needle:=$declarations_before$  count_sources integer; mode text; class_slug text; item record; is_strict boolean;$declarations_before$;
  revised:=$declarations_after$  count_sources integer; mode text; class_slug text; item record; is_strict boolean;
  child_context jsonb; legacy_source text; child_source text;$declarations_after$;
  needle:=pg_catalog.replace(needle,E'\r\n',E'\n'); revised:=pg_catalog.replace(revised,E'\r\n',E'\n');
  IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_child_pin_repair_fragment_changed' USING ERRCODE='42501'; END IF;
  source:=pg_catalog.replace(source,needle,revised);
  needle:=$child_pin_before$          pin:=private.builder_catalog_pin_v1(target,dependency,pg_catalog.jsonb_build_object('source','class_feature_choice',
            'class',class_slug,'feature',source->>'slug_snapshot','choice_id',choice->>'choice_id',
            'source_ref_id',source#>>'{_source_ref,id}'),
            'builder:feature-choice:'||(source#>>'{_source_ref,id}')||':'||(choice->>'choice_id'),NULL,cap.protected_graph->'refs');$child_pin_before$;
  revised:=$child_pin_after$          child_context:=pg_catalog.jsonb_build_object('source','class_feature_choice',
            'class',class_slug,'feature',source->>'slug_snapshot','choice_id',choice->>'choice_id',
            'source_ref_id',source#>>'{_source_ref,id}');
          legacy_source:='builder:feature-choice:'||(source#>>'{_source_ref,id}')||':'||(choice->>'choice_id');
          child_source:=legacy_source||':'||(dependency->>'content_id')||':'||(dependency->>'version');
          -- One old child may already own the historical unsuffixed tag.
          -- Retain that exact pin; each new sibling receives its own tag.
          IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(cap.protected_graph->'refs') prior(value)
            WHERE prior.value->>'character_id'=target::text AND prior.value->>'choice_source'=legacy_source
              AND prior.value->'content_id'=dependency->'content_id' AND prior.value->'content_version'=dependency->'version'
              AND prior.value->'context'=child_context AND prior.value->'feature_grant_id'='null'::jsonb) THEN
            child_source:=legacy_source;
          END IF;
          pin:=private.builder_catalog_pin_v1(target,dependency,child_context,child_source,NULL,cap.protected_graph->'refs');$child_pin_after$;
  needle:=pg_catalog.replace(needle,E'\r\n',E'\n'); revised:=pg_catalog.replace(revised,E'\r\n',E'\n');
  IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_child_pin_repair_fragment_changed' USING ERRCODE='42501'; END IF;
  source:=pg_catalog.replace(source,needle,revised);
  replacement:=source;
  IF pg_catalog.md5(replacement)<>after_md5 THEN RAISE EXCEPTION 'builder_child_pin_repair_postimage_changed' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
    OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
    OR repaired.provolatile IS DISTINCT FROM original.provolatile OR repaired.prosrc IS DISTINCT FROM replacement THEN
    RAISE EXCEPTION 'builder_child_pin_repair_closure_failed' USING ERRCODE='42501'; END IF;
END $repair$;
COMMIT;
