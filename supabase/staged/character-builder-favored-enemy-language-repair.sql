-- Only the earlier installed disposable Favored Enemy function needs this.
-- Fresh installations use the corrected variable name in the main companion.
BEGIN;
DO $repair$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE; source text; replacement text;
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(
    'private.prepare_builder_favored_enemies_v1(uuid,jsonb,jsonb,text)');
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  IF CURRENT_USER<>'supabase_admin' OR original.proowner<>'postgres'::pg_catalog.regrole
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR NOT original.prosecdef
    OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
    OR pg_catalog.md5(source)<>'c7ded9b1c9a8bb5394357415a81ce351'
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'builder_favored_enemy_language_profile_unavailable' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(source,'prior jsonb; source jsonb;','prior jsonb; enemy_source jsonb;');
  replacement:=pg_catalog.replace(replacement,'FOR source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources)',
    'FOR enemy_source IN SELECT value FROM pg_catalog.jsonb_array_elements(sources)');
  replacement:=pg_catalog.replace(pg_catalog.replace(replacement,'source->','enemy_source->'),'source#','enemy_source#');
  IF replacement=source OR replacement LIKE '%FOR source IN%' THEN
    RAISE EXCEPTION 'builder_favored_enemy_language_source_drift' USING ERRCODE='42501'; END IF;
  EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF repaired.prosrc IS DISTINCT FROM replacement OR repaired.proowner IS DISTINCT FROM original.proowner
    OR repaired.proacl IS DISTINCT FROM original.proacl OR repaired.proconfig IS DISTINCT FROM original.proconfig
    OR repaired.prosecdef IS DISTINCT FROM original.prosecdef OR repaired.provolatile IS DISTINCT FROM original.provolatile THEN
    RAISE EXCEPTION 'builder_favored_enemy_language_closure_failed' USING ERRCODE='42501'; END IF;
END $repair$;
COMMIT;
