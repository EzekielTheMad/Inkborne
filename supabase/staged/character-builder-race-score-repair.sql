-- Install after character-builder-progression.sql, in the disposable profile.
-- Missing legacy score arrays must not suppress canonical racial effects.
-- Existing six-value score arrays keep their previous precedence unchanged.
BEGIN;
DO $repair$
DECLARE original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; definition text;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('private.prepare_builder_progression_v1(uuid,uuid,text,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_race_score_repair_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO original FROM pg_catalog.pg_proc
    WHERE oid=pg_catalog.to_regprocedure('private.character_ability_scores_before_builder_progression_v1(uuid,uuid,text,text)');
  IF NOT FOUND OR original.proowner<>'postgres'::pg_catalog.regrole::oid
    OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR original.prosecdef IS DISTINCT FROM true OR original.provolatile<>'s'
    OR original.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
    OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>'a2cffa8881d10b33bdf209389e13770e' THEN
    RAISE EXCEPTION 'builder_race_score_preimage_changed' USING ERRCODE='42501'; END IF;
  source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n');
  replacement:=pg_catalog.replace(source,$before$      AND NOT (
        version.content_type_snapshot IN ('race', 'subrace')
        AND pg_catalog.jsonb_typeof(version.data_snapshot->'scores') = 'array'
        AND pg_catalog.jsonb_array_length(version.data_snapshot->'scores') = 6
      )
      AND effect.value->>'type' = 'mechanical'$before$,$after$      AND NOT COALESCE((
        version.content_type_snapshot IN ('race', 'subrace')
        AND pg_catalog.jsonb_typeof(version.data_snapshot->'scores') = 'array'
        AND pg_catalog.jsonb_array_length(version.data_snapshot->'scores') = 6
      ), false)
      AND effect.value->>'type' = 'mechanical'$after$);
  IF replacement=source OR pg_catalog.md5(replacement)<>'46503e95f31b45f99ec5541ce0192cf7' THEN
    RAISE EXCEPTION 'builder_race_score_source_mismatch' USING ERRCODE='42501'; END IF;
  definition:=pg_catalog.pg_get_functiondef(original.oid);
  EXECUTE pg_catalog.replace(definition,original.prosrc,replacement);
  SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
  IF NOT FOUND OR repaired.proowner IS DISTINCT FROM original.proowner OR repaired.proacl IS DISTINCT FROM original.proacl
    OR repaired.proconfig IS DISTINCT FROM original.proconfig OR repaired.prosecdef IS DISTINCT FROM original.prosecdef
    OR repaired.provolatile IS DISTINCT FROM original.provolatile
    OR pg_catalog.md5(pg_catalog.replace(repaired.prosrc,E'\r\n',E'\n'))<>'46503e95f31b45f99ec5541ce0192cf7' THEN
    RAISE EXCEPTION 'builder_race_score_closure_failed' USING ERRCODE='42501'; END IF;
END $repair$;
COMMIT;
