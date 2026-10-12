BEGIN;
SET LOCAL ROLE authenticated;
DO $consume$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; evidence jsonb := current_setting('inkborne.r07.state')::jsonb; s uuid := (evidence->>'source')::uuid; original jsonb := evidence->'receipt'; affected integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',r->>'owner',true); PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r->>'owner','role','authenticated')::text,true);
  IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM (r->>'owner')::uuid THEN RAISE EXCEPTION 'Owner consume claims mismatch'; END IF;
  IF NOT EXISTS (SELECT FROM public.character_starting_grants WHERE character_id=s AND receipt=original AND status='awarded') THEN RAISE EXCEPTION 'Original receipt drift'; END IF;
  UPDATE public.character_inventory SET quantity=1 WHERE id=(original->'inventory_ids'->>0)::uuid AND character_id=s AND quantity=2;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected <> 1 THEN RAISE EXCEPTION 'Consumption quantity drift'; END IF;
  UPDATE public.characters SET state=jsonb_set(state,'{currency,gp}','4') WHERE id=s AND state->'currency'->>'gp'='17' AND state->>'current_hp'='9' AND state->>'r07_note'='preserve state';
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected <> 1 THEN RAISE EXCEPTION 'Currency/unrelated state drift'; END IF;
END $consume$;
COMMIT;
