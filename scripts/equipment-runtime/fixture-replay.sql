BEGIN;
SET LOCAL ROLE service_role;
DO $replay$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; evidence jsonb := current_setting('inkborne.r07.state')::jsonb; s uuid := (evidence->>'source')::uuid; original jsonb := evidence->'receipt'; intent jsonb := current_setting('inkborne.r07.intent')::jsonb; resolved jsonb; committed jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true);
  IF current_user <> 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Replay claims mismatch'; END IF;
  resolved := public.resolve_starting_equipment((r->>'owner')::uuid,s,intent-'plan');
  -- Stale pre-award expectation is deliberately ignored on exact terminal receipt replay.
  committed := public.commit_starting_equipment((r->>'owner')::uuid,s,'{}','[]',intent);
  IF resolved IS DISTINCT FROM jsonb_build_object('status','awarded','receipt',original) OR committed IS DISTINCT FROM resolved
    OR (SELECT count(*) FROM public.character_inventory WHERE character_id=s) <> 1
    OR NOT EXISTS (SELECT FROM public.character_inventory WHERE id=(original->'inventory_ids'->>0)::uuid AND quantity=1 AND starting_grant_id=(original->>'grant_id')::uuid)
    OR NOT EXISTS (SELECT FROM public.characters WHERE id=s AND state->'currency'->>'gp'='4' AND state->>'current_hp'='9' AND state->>'r07_note'='preserve state') THEN RAISE EXCEPTION 'Receipt replay changed consumption/state'; END IF;
END $replay$;
COMMIT;
