-- Installed-old-profile repair only. Fresh profiles use the corrected main
-- multiclass stage; this changes one exact routine body and no character rows.
BEGIN;
DO $repair$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; needle text; revised text;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_acquisition_repair_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('private.prepare_builder_acquisition_v1(uuid,uuid,jsonb)');
  IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole OR NOT original.prosecdef OR original.provolatile<>'v'
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
    OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>'4dba9fc24df5d0dae2bb553d7b364915' THEN
    RAISE EXCEPTION 'builder_acquisition_repair_preimage_changed' USING ERRCODE='42501'; END IF;
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  needle:='SELECT pg_catalog.jsonb_agg(value ORDER BY (value->>''id'')::uuid) INTO entry FROM pg_catalog.jsonb_array_elements(expected->domain);';
  revised:='SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>''id'')::uuid),''[]'') INTO entry FROM pg_catalog.jsonb_array_elements(expected->domain);';
  IF (length(source)-length(pg_catalog.replace(source,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'builder_acquisition_repair_fragment_changed' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(source,needle,revised);
  IF pg_catalog.md5(replacement)<>'ed2c8225db562571db783f688b59ba3b' THEN
    RAISE EXCEPTION 'builder_acquisition_repair_postimage_changed' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
    OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
    OR repaired.provolatile IS DISTINCT FROM original.provolatile OR repaired.prosrc IS DISTINCT FROM replacement THEN
    RAISE EXCEPTION 'builder_acquisition_repair_closure_failed' USING ERRCODE='42501'; END IF;
END $repair$;
COMMIT;
