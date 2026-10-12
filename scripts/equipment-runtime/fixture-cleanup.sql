-- Separately invoked G2 cleanup only, after a completed journal. No name pattern or cascade assumption.
BEGIN;
DO $prepare_cleanup$
DECLARE evidence jsonb := current_setting('inkborne.r07.state')::jsonb; r jsonb := current_setting('inkborne.r07.roots')::jsonb;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Cleanup actor mismatch'; END IF;
  IF NOT EXISTS (SELECT FROM public.characters WHERE id=(evidence->>'source')::uuid AND user_id=(r->>'owner')::uuid AND system_id=(r->>'system')::uuid AND name=current_setting('inkborne.r07.run')||'-source')
     OR NOT EXISTS (SELECT FROM public.characters WHERE id=(evidence->>'copy')::uuid AND user_id=(r->>'owner')::uuid AND system_id=(r->>'system')::uuid AND name=current_setting('inkborne.r07.run')||'-copy')
     OR NOT EXISTS (SELECT FROM public.characters WHERE id=(r->>'foreignCharacter')::uuid AND user_id=(r->>'foreign')::uuid AND system_id=(r->>'system')::uuid AND name=current_setting('inkborne.r07.run')||'-foreign-character') THEN RAISE EXCEPTION 'Closed cleanup roots mismatch'; END IF;
  IF NOT EXISTS (SELECT FROM public.character_starting_grants WHERE character_id=(evidence->>'source')::uuid AND receipt=evidence->'receipt' AND status='awarded') THEN RAISE EXCEPTION 'Cleanup original receipt drift'; END IF;
  PERFORM set_config('inkborne.r07.readback',evidence::text,false);
END $prepare_cleanup$;
-- R07.2 OWNERSHIP
DO $delete_exact$
DECLARE owned jsonb := current_setting('inkborne.r07.state')::jsonb->'ids'; entry record; expected uuid[]; actual uuid[]; affected integer; table_name text;
BEGIN
  FOR entry IN SELECT key,value FROM jsonb_each(owned) LOOP
    SELECT array_agg(value::uuid ORDER BY value::uuid) INTO expected FROM jsonb_array_elements_text(entry.value);
    EXECUTE format('SELECT array_agg(id ORDER BY id) FROM %I.%I WHERE id=ANY($1)',split_part(entry.key,'.',1),split_part(entry.key,'.',2)) INTO actual USING expected;
    IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Cleanup recorded IDs missing'; END IF;
  END LOOP;
  -- Remove exact derived refs before their grant/controller parents. No effect is credited to CASCADE.
  DELETE FROM public.character_content_refs WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(owned->'public.character_content_refs')) AND feature_grant_id IS NOT NULL;
  FOREACH table_name IN ARRAY ARRAY['character_spells','character_inventory','character_feature_grants','character_spell_grants','character_content_refs','character_starting_grants','characters','content_versions','content_definitions','game_systems','profiles'] LOOP
    SELECT array_agg(value::uuid) INTO expected FROM jsonb_array_elements_text(owned->('public.'||table_name));
    EXECUTE format('DELETE FROM public.%I WHERE id=ANY($1)',table_name) USING expected;
  END LOOP;
  SELECT array_agg(value::uuid) INTO expected FROM jsonb_array_elements_text(owned->'auth.users');
  DELETE FROM auth.users WHERE id=ANY(expected);
  FOR entry IN SELECT key,value FROM jsonb_each(owned) LOOP
    SELECT array_agg(value::uuid) INTO expected FROM jsonb_array_elements_text(entry.value);
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE id=ANY($1)',split_part(entry.key,'.',1),split_part(entry.key,'.',2)) INTO affected USING expected;
    IF affected<>0 THEN RAISE EXCEPTION 'Exact fixture residue remains'; END IF;
  END LOOP;
END $delete_exact$;
COMMIT;
SELECT jsonb_build_object('phase','cleanup','passed',true);
