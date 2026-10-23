-- Repair an already installed progression profile without changing draft data.
-- Fresh progression installs include this exact null-handling correction.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_asi_pruner_repair_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;
-- A missing ASI map is not an ASI object. Preserve it as absent rather than
-- silently adding an empty object after the trusted planner seals choices.
DO $asi_pruner_null_profile$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; definition text;
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc
    WHERE oid=pg_catalog.to_regprocedure('private.prune_inactive_asi_choices_before_choices()');
  IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole::oid
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR original.prosecdef IS DISTINCT FROM true OR original.provolatile<>'v'
    OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>'f5972f0b1a35e5e27f3112c072418a08' THEN
    RAISE EXCEPTION 'builder_asi_pruner_preimage_changed' USING ERRCODE='42501'; END IF;
  source:=original.prosrc;
  replacement:=pg_catalog.replace(source,
    'IF pg_catalog.jsonb_typeof(NEW.choices->''asi_choices'') <> ''object'' THEN',
    'IF pg_catalog.jsonb_typeof(NEW.choices->''asi_choices'') IS DISTINCT FROM ''object'' THEN');
  IF replacement=source OR pg_catalog.md5(pg_catalog.replace(replacement,E'\r\n',E'\n'))<>'8a2ec6e2c40616af169619a897fa190b' THEN
    RAISE EXCEPTION 'builder_asi_pruner_source_mismatch' USING ERRCODE='42501'; END IF;
  definition:=pg_catalog.pg_get_functiondef(original.oid);
  EXECUTE pg_catalog.replace(definition,source,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF NOT FOUND OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
    OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
    OR repaired.provolatile IS DISTINCT FROM original.provolatile
    OR pg_catalog.md5(pg_catalog.replace(repaired.prosrc,E'\r\n',E'\n'))<>'8a2ec6e2c40616af169619a897fa190b' THEN
    RAISE EXCEPTION 'builder_asi_pruner_closure_failed' USING ERRCODE='42501'; END IF;
END $asi_pruner_null_profile$;
COMMIT;
