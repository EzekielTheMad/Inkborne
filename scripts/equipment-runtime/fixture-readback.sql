-- Confirmed-phase readback after COMMIT. Gather actual generated IDs, never force production UUIDs.
BEGIN READ ONLY;
DO $readback$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; previous jsonb := current_setting('inkborne.r07.state')::jsonb;
  source_id uuid := COALESCE(NULLIF(current_setting('inkborne.r07.source',true),''),previous->>'source')::uuid;
  copy_id uuid := COALESCE(NULLIF(current_setting('inkborne.r07.copy',true),''),previous->>'copy')::uuid;
  owned jsonb := '{}'; result jsonb; row_ids jsonb; definition jsonb; relation text; expected_versions integer;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Privileged readback actor mismatch'; END IF;
  IF source_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.characters WHERE id=source_id AND user_id=(r->>'owner')::uuid AND system_id=(r->>'system')::uuid AND name=current_setting('inkborne.r07.run')||'-source')
    OR copy_id IS NOT NULL AND NOT EXISTS (SELECT FROM public.characters WHERE id=copy_id AND user_id=(r->>'owner')::uuid AND system_id=(r->>'system')::uuid AND name=current_setting('inkborne.r07.run')||'-copy') THEN RAISE EXCEPTION 'Generated character ownership mismatch'; END IF;
  IF EXISTS (SELECT FROM public.characters WHERE (user_id IN ((r->>'owner')::uuid,(r->>'foreign')::uuid) OR system_id=(r->>'system')::uuid)
      AND id NOT IN (SELECT x FROM unnest(ARRAY[(r->>'foreignCharacter')::uuid,source_id,copy_id]) x WHERE x IS NOT NULL)) THEN RAISE EXCEPTION 'Unexpected fixture dependency/character'; END IF;
  owned := jsonb_build_object('auth.users',jsonb_build_array(r->>'owner',r->>'foreign'),'public.profiles',jsonb_build_array(r->>'owner',r->>'foreign'),'public.game_systems',jsonb_build_array(r->>'system'),'public.content_definitions',jsonb_build_array(r->>'class',r->>'feature',r->>'asi',r->>'spell',r->>'item'));
  SELECT COALESCE(jsonb_agg(id::text ORDER BY id),'[]') INTO row_ids FROM public.content_versions WHERE content_id IN ((r->>'class')::uuid,(r->>'feature')::uuid,(r->>'asi')::uuid,(r->>'spell')::uuid,(r->>'item')::uuid);
  expected_versions := CASE WHEN EXISTS (SELECT FROM public.content_definitions WHERE id=(r->>'feature')::uuid AND version=2) THEN 6 ELSE 5 END;
  IF jsonb_array_length(row_ids) <> expected_versions OR EXISTS (SELECT FROM public.content_versions WHERE content_id IN ((r->>'class')::uuid,(r->>'feature')::uuid,(r->>'asi')::uuid,(r->>'spell')::uuid,(r->>'item')::uuid) AND NOT (version=1 OR content_id=(r->>'feature')::uuid AND version=2)) THEN RAISE EXCEPTION 'Snapshot identity/version mismatch'; END IF;
  FOR definition IN SELECT value FROM jsonb_array_elements(current_setting('inkborne.r07.definitions')::jsonb) LOOP
    IF NOT EXISTS (SELECT FROM public.content_versions WHERE content_id=(definition->>'id')::uuid AND version=1 AND data_snapshot=definition->'data' AND effects_snapshot=definition->'effects'
      AND system_id_snapshot=(definition->>'system_id')::uuid AND slug_snapshot=definition->>'slug' AND name_snapshot=definition->>'name' AND content_type_snapshot=definition->>'content_type'
      AND source_snapshot=definition->>'source' AND scope_snapshot=definition->>'scope' AND owner_id_snapshot IS NULL) THEN RAISE EXCEPTION 'Canonical original immutable snapshot mismatch'; END IF;
  END LOOP;
  owned := owned || jsonb_build_object('public.content_versions',row_ids);
  SELECT jsonb_agg(x::text ORDER BY x) INTO row_ids FROM unnest(ARRAY[(r->>'foreignCharacter')::uuid,source_id,copy_id]) x WHERE x IS NOT NULL;
  owned := owned || jsonb_build_object('public.characters',row_ids);
  FOREACH relation IN ARRAY ARRAY['character_content_refs','character_feature_grants','character_spell_grants','character_spells','character_inventory','character_starting_grants'] LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(id::text ORDER BY id),''[]''::jsonb) FROM public.%I WHERE character_id IN ($1,$2)',relation) INTO row_ids USING source_id,copy_id;
    owned := owned || jsonb_build_object('public.'||relation,row_ids);
  END LOOP;
  result := jsonb_build_object('ids',owned);
  IF source_id IS NOT NULL THEN result := result || jsonb_build_object('source',source_id); END IF;
  IF copy_id IS NOT NULL THEN result := result || jsonb_build_object('copy',copy_id); END IF;
  SELECT receipt INTO row_ids FROM public.character_starting_grants WHERE character_id=source_id;
  IF row_ids IS NOT NULL THEN
    IF previous ? 'receipt' AND row_ids IS DISTINCT FROM previous->'receipt' THEN RAISE EXCEPTION 'Original receipt drift'; END IF;
    result := result || jsonb_build_object('receipt',row_ids);
  END IF;
  PERFORM set_config('inkborne.r07.readback',result::text,false);
END $readback$;
-- R07.2 OWNERSHIP
COMMIT;
SELECT jsonb_build_object('phase',current_setting('inkborne.r07.phase'),'passed',true,'state',current_setting('inkborne.r07.readback')::jsonb);
