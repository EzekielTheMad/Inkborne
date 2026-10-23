-- Local integration companion AFTER multiclass and class-feature choices.
-- Also safe after the Favored Enemy companion: it leaves these two bodies intact.
-- Fresh profiles install this companion too; no historical receipt/data rewrite.
BEGIN;
DO $repair$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; needle text; revised text;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_multiclass_integration_unavailable' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','8175fff619fa2ba56962e30fcb04a843','d55825fd6cf14472f9154a363991b62a','subclass'),
    ('private.prepare_builder_acquisition_v1(uuid,uuid,jsonb)','f08844d4d198b17b4f83353cfe9c2bab','b4b2431d112729471e6731dbc7477449','cas')
  ) expected(signature,before_md5,after_md5,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
      OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.before_md5 THEN
      RAISE EXCEPTION 'builder_multiclass_integration_preimage_changed' USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
    IF item.kind='subclass' THEN
      needle:='  -- Retired subclass-owned choices are not carried into a replacement subclass.';
      revised:=$pending$  -- Resolve new subclass grant activity against its pending exact occurrence.
  next_occurrence:=occurrence||pg_catalog.jsonb_build_object('subclass_ref_id',subclass_pin->'id');
  expected:=pg_catalog.jsonb_set(expected,'{occurrences}',(SELECT COALESCE(pg_catalog.jsonb_agg(
    CASE WHEN value->'id'=occurrence->'id' THEN next_occurrence ELSE value END ORDER BY (value->>'id')::uuid),'[]')
    FROM pg_catalog.jsonb_array_elements(expected->'occurrences')));
$pending$||needle;
    ELSE
      -- An application CAS refusal is permanent for this intent. Serialization
      -- failure incorrectly invites transaction retry before the user can reload.
      needle:='RAISE EXCEPTION ''builder_stale_action_revision'' USING ERRCODE=''40001'';';
      revised:='RAISE EXCEPTION ''builder_stale_action_revision'' USING ERRCODE=''22023'';';
    END IF;
    needle:=pg_catalog.replace(needle,E'\r\n',E'\n'); revised:=pg_catalog.replace(revised,E'\r\n',E'\n');
    IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
      RAISE EXCEPTION 'builder_multiclass_integration_fragment_changed' USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(source,needle,revised);
    IF pg_catalog.md5(replacement)<>item.after_md5 THEN
      RAISE EXCEPTION 'builder_multiclass_integration_postimage_changed' USING ERRCODE='42501'; END IF;
    EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
      OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
      OR repaired.provolatile IS DISTINCT FROM original.provolatile OR repaired.prosrc IS DISTINCT FROM replacement THEN
      RAISE EXCEPTION 'builder_multiclass_integration_closure_failed' USING ERRCODE='42501'; END IF;
  END LOOP;
END $repair$;
COMMIT;
