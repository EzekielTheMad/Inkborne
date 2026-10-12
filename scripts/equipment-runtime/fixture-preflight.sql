-- G2 only. Actual replayed schema; no helper replacement or DDL.
BEGIN READ ONLY;
DO $check$
DECLARE roots jsonb := current_setting('inkborne.r07.roots')::jsonb; candidate text;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Fixture target/actor mismatch'; END IF;
  IF EXISTS (SELECT FROM auth.users) OR EXISTS (SELECT FROM public.profiles) THEN RAISE EXCEPTION 'Synthetic fixture requires unused Auth/profile target'; END IF;
  IF EXISTS (SELECT FROM public.game_systems WHERE id = (roots->>'system')::uuid)
     OR EXISTS (SELECT FROM public.characters WHERE id = (roots->>'foreignCharacter')::uuid)
     OR EXISTS (SELECT FROM public.content_definitions WHERE id IN (SELECT value::uuid FROM jsonb_each_text(roots))) THEN RAISE EXCEPTION 'Fixed fixture ID collision'; END IF;
  FOREACH candidate IN ARRAY ARRAY['snapshot_content_definition_version','materialize_feature_grants','materialize_spell_grants','enforce_character_feature_grant','enforce_character_spell_grant','enforce_asi_choice_map_boundary','preserve_starting_grant_receipt','protect_starting_inventory_provenance'] LOOP
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_trigger WHERE tgname=candidate AND tgenabled='O' AND NOT tgisinternal) THEN RAISE EXCEPTION 'Required real trigger absent'; END IF;
  END LOOP;
END $check$;
COMMIT;
SELECT jsonb_build_object('phase','preflight','passed',true);
