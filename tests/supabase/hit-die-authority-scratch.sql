-- SCRIPT SOURCE ONLY: not executed and not a migration/test runner entry.
-- Requires explicit G2 target/bootstrap and installation of the complete chain
-- plus both staged files. This first phase characterizes DEFAULT UNREADY only;
-- it proves neither real Auth roles nor graph/CAS success/concurrency.
BEGIN;
DO $$
DECLARE context jsonb; result jsonb; family_count bigint;
BEGIN
  context := '{"context_version":1,"actor_id":"11111111-1111-4111-8111-000000000001","session_id":"11111111-1111-4111-8111-000000000002","jwt_expires_at":"9999-12-31T23:59:59.000000Z"}'::jsonb;
  SELECT count(*) INTO family_count FROM private.character_writer_readiness_v1;
  IF family_count <> 13 OR EXISTS (SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready) THEN RAISE EXCEPTION 'Unexpected readiness activation'; END IF;
  result := public.read_hit_die_graph_v1(context,'11111111-1111-4111-8111-000000000003');
  IF result <> '{"status":"unready","reason":"auth_unavailable"}'::jsonb THEN RAISE EXCEPTION 'Default reader became available'; END IF;
  result := public.patch_character_state_at_revision_v1(context,'11111111-1111-4111-8111-000000000003','9007199254740993','{"inspiration":true}');
  IF result <> '{"status":"unready","reason":"auth_unavailable"}'::jsonb THEN RAISE EXCEPTION 'Default CAS became available'; END IF;
  result := public.patch_character_state_at_revision_v1(context,'11111111-1111-4111-8111-000000000003','1','{"inspiration":true,"current_hp":99}');
  IF result <> '{"status":"invalid"}'::jsonb THEN RAISE EXCEPTION 'Unsafe state patch admitted'; END IF;
  IF pg_catalog.has_function_privilege('service_role','public.commit_hit_die_v1(uuid,jsonb,jsonb,jsonb,text,timestamptz)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.read_hit_die_receipt_v1(uuid,jsonb,text)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.resolve_hit_die_snapshot_v1(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Sessionless legacy execution persists'; END IF;
END $$;
-- Representative actual PG17 lock/denied-mutation characterization, STILL
-- UNEXECUTED SOURCE. Requires a seeded system row in the disposable G2 target.
-- SET ROLE is deployment-test authority, never granted to service/browser roles.
SET LOCAL ROLE inkborne_hit_die_authority_owner;
DO $$
DECLARE selected_system uuid;
BEGIN
  SELECT system_row.id INTO selected_system FROM public.game_systems AS system_row ORDER BY system_row.id LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A disposable seeded system is required for the locking control'; END IF;
  BEGIN
    UPDATE public.game_systems AS system_row SET id = system_row.id WHERE system_row.id = selected_system;
    RAISE EXCEPTION 'Column locking privilege unexpectedly permitted actual mutation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
-- Later separately reviewed G2 phases must exercise actual graph/CAS: complete
-- approved ASI/schema fixture + proved persisted order + known Auth/config
-- fixture vs real verified token, all raw counts/missing versions/controllers,
-- inspiration true/false/no-op/ABA/two IDs/unknown-key/fault and unchanged domain
-- arrays/producer_revision, native JWT equality/after-lock expiry, actual role
-- revocations and multi-connection shared/child phantoms. No production helper
-- replacement, readiness marking, fixture rows or cleanup is included here.
-- Every other shared table must also prove FOR SHARE succeeds on known rows,
-- admin/owner counts agree under effective RLS, and UPDATE of even its granted
-- key/no-op value fails. The representative system test alone does not prove
-- those policies, immutable-version triggers or provider/RI roles.
-- R09.3b2 graph-v2 source adds native content_versions.created_at metadata.
-- Later G2 must compare EVERY required immutable tuple/time against admin
-- counts, including inactive grants, through the actual locked reader; as-of
-- equality/+1microsecond, materializer/copy lineage and selection-version
-- precedence need actual rows. Direct metadata queries cannot certify the
-- unavailable reader, historical winning candidate/access or writer fences.
