BEGIN;
SET LOCAL ROLE service_role;
DO $create$
DECLARE r jsonb := current_setting('inkborne.r07.roots')::jsonb; created uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  IF current_user <> 'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Trusted create role/claims mismatch'; END IF;
  created := public.create_character_with_starting_grant((r->>'owner')::uuid,current_setting('inkborne.r07.run')||'-source',(r->>'system')::uuid);
  IF (SELECT count(*) FROM public.character_starting_grants WHERE character_id=created AND status='eligible') <> 1 THEN RAISE EXCEPTION 'Create marker missing'; END IF;
  PERFORM set_config('inkborne.r07.source',created::text,false);
END $create$;
COMMIT;
