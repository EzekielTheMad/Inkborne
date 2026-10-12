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
ROLLBACK;
-- Later separately reviewed G2 phases must exercise actual graph/CAS: complete
-- approved ASI/schema fixture + proved persisted order + known Auth/config
-- fixture vs real verified token, all raw counts/missing versions/controllers,
-- inspiration true/false/no-op/ABA/two IDs/unknown-key/fault and unchanged domain
-- arrays/producer_revision, native JWT equality/after-lock expiry, actual role
-- revocations and multi-connection shared/child phantoms. No production helper
-- replacement, readiness marking, fixture rows or cleanup is included here.
