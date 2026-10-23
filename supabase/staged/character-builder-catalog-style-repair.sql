-- One-function local repair for an already installed catalog stage.
-- Preserves characters, receipts, native ordering, ACLs and disabled gates.
-- Fresh installs use the corrected character-builder-catalog.sql instead.
BEGIN;
DO $repair$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  definition text; source text; replacement text;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_style_repair_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO original FROM pg_catalog.pg_proc
    WHERE oid=pg_catalog.to_regprocedure('private.apply_builder_catalog_command_v1(uuid,text,jsonb)');
  IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole::oid
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR original.prosecdef IS DISTINCT FROM true OR original.provolatile<>'v'
    OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>'5658c7e171bf5a0a9edaf0d0596b2ebe' THEN
    RAISE EXCEPTION 'builder_style_repair_preimage_changed' USING ERRCODE='42501'; END IF;
  source:=original.prosrc;
  replacement:=pg_catalog.replace(source,
    'IF dependency#>>''{data_snapshot,feature_type}''<>''fighting_style''',
    'IF COALESCE(dependency#>>''{data_snapshot,feature_type}'','''') NOT IN (''fighting_style'',''passive'')');
  IF replacement=source OR pg_catalog.md5(pg_catalog.replace(replacement,E'\r\n',E'\n'))<>'9b5b1df5a5c79769677119d418c3c51b' THEN
    RAISE EXCEPTION 'builder_style_repair_source_mismatch' USING ERRCODE='42501'; END IF;
  definition:=pg_catalog.pg_get_functiondef(original.oid);
  EXECUTE pg_catalog.replace(definition,source,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF NOT FOUND OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
    OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
    OR repaired.provolatile IS DISTINCT FROM original.provolatile
    OR pg_catalog.md5(pg_catalog.replace(repaired.prosrc,E'\r\n',E'\n'))<>'9b5b1df5a5c79769677119d418c3c51b'
    OR pg_catalog.has_function_privilege('anon',original.oid,'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated',original.oid,'EXECUTE')
    OR pg_catalog.has_function_privilege('service_role',original.oid,'EXECUTE') THEN
    RAISE EXCEPTION 'builder_style_repair_closure_failed' USING ERRCODE='42501'; END IF;
END $repair$;
COMMIT;
