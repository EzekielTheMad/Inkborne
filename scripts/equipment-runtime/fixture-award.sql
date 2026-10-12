BEGIN;
SET LOCAL ROLE service_role;
DO $award$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; s uuid := (current_setting('inkborne.r07.state')::jsonb->>'source')::uuid; expected jsonb; refs jsonb; result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true);
  IF current_user <> 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Trusted award role/claims mismatch'; END IF;
  SELECT choices INTO expected FROM public.characters WHERE id=s;
  IF expected->>'notes' IS DISTINCT FROM 'R07 preserve choice' OR (expected->'asi_choices' ? (current_setting('inkborne.r07.run')||'-asi')) IS NOT TRUE THEN RAISE EXCEPTION 'Mechanical choices drift'; END IF;
  SELECT jsonb_agg(jsonb_build_object('content_id',content_id,'content_version',content_version) ORDER BY content_id,content_version) INTO refs FROM public.character_content_refs WHERE character_id=s;
  IF jsonb_array_length(refs) IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'Mechanical pins drift'; END IF;
  result := public.commit_starting_equipment((r->>'owner')::uuid,s,expected,refs,current_setting('inkborne.r07.intent')::jsonb);
  IF result->>'status' IS DISTINCT FROM 'awarded' OR (SELECT state->'currency'->>'gp' FROM public.characters WHERE id=s) IS DISTINCT FROM '17'
      OR (SELECT choices->'starting_equipment'->>'confirmed' FROM public.characters WHERE id=s) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Award mismatch'; END IF;
END $award$;
COMMIT;
