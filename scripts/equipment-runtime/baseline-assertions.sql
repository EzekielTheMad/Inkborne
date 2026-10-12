-- Assert actual application objects after every frozen migration has succeeded.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
DO $check$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'public.profiles','public.game_systems','public.content_definitions','public.content_versions',
    'public.campaigns','public.campaign_members','public.characters','public.character_content_refs',
    'public.character_feature_grants','public.character_inventory','public.character_spells',
    'public.character_timeline_events','public.npcs','public.character_dm_notes'
  ] LOOP
    IF pg_catalog.to_regclass(relation_name) IS NULL THEN RAISE EXCEPTION 'R07.1 required baseline relation absent'; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'copy_character')
    OR NOT EXISTS (SELECT FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'save_character_abilities')
    OR NOT EXISTS (SELECT FROM pg_catalog.pg_trigger t WHERE t.tgrelid = 'public.character_content_refs'::regclass AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'R07.1 baseline copy/ability/ref triggers absent';
  END IF;
  IF EXISTS (SELECT FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('characters','character_inventory','content_versions','character_content_refs') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'R07.1 baseline RLS missing';
  END IF;
END
$check$;
COMMIT;
