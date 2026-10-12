BEGIN;
SET LOCAL ROLE authenticated;
DO $mechanics$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; s uuid := (current_setting('inkborne.r07.state')::jsonb->>'source')::uuid; tag text := current_setting('inkborne.r07.run');
BEGIN
  PERFORM set_config('request.jwt.claim.sub',r->>'owner',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r->>'owner','role','authenticated')::text,true);
  IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM (r->>'owner')::uuid THEN RAISE EXCEPTION 'Owner role/claims mismatch'; END IF;
  IF NOT EXISTS (SELECT FROM public.characters WHERE id=s AND choices='{}' AND state='{}') THEN RAISE EXCEPTION 'Created source drift'; END IF;
  UPDATE public.characters SET level=4,base_stats='{"strength":10,"dexterity":10,"constitution":10,"intelligence":10,"wisdom":10,"charisma":10}',
    choices=jsonb_build_object('classes',jsonb_build_array(jsonb_build_object('slug',tag||'-class','level',4)),'starting_equipment',(current_setting('inkborne.r07.intent')::jsonb->'selections'),'notes','R07 preserve choice'),
    state='{"currency":{"gp":2},"current_hp":9,"r07_note":"preserve state"}' WHERE id=s;
  INSERT INTO public.character_content_refs(character_id,content_id,content_version) VALUES (s,(r->>'class')::uuid,1);
  PERFORM public.sync_character_feature_refs(s);
  PERFORM public.sync_character_spell_grants(s);
  PERFORM public.set_character_asi_choice(s,tag||'-asi','asi','[{"ability":"constitution","amount":2}]');
  IF current_setting('inkborne.asi_choice_rpc',true) IS NOT DISTINCT FROM 'on' THEN RAISE EXCEPTION 'ASI mutation boundary leaked'; END IF;
  IF (SELECT count(*) FROM public.character_feature_grants WHERE character_id=s) <> 2
    OR (SELECT count(*) FROM public.character_content_refs WHERE character_id=s AND feature_grant_id IS NOT NULL) <> 2
    OR (SELECT count(*) FROM public.character_spell_grants WHERE character_id=s) <> 1
    OR (SELECT count(*) FROM public.character_spells WHERE character_id=s AND spell_grant_id IS NOT NULL AND source='feature' AND always_prepared AND is_prepared) <> 1
    OR NOT EXISTS (SELECT FROM public.characters WHERE id=s AND choices->'asi_choices'->(tag||'-asi')='{"mode":"asi","allocations":[{"ability":"constitution","amount":2}]}') THEN RAISE EXCEPTION 'Actual mechanics/ASI synchronization mismatch'; END IF;
END $mechanics$;
COMMIT;
