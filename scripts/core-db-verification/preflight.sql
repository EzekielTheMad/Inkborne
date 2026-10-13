-- NEW G2 profile preflight only. No object/role/fixture creation or activation.
BEGIN READ ONLY;
DO $check$
DECLARE candidate text;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'Core profile native target/admin/version mismatch' USING ERRCODE='42501';
  END IF;
  FOREACH candidate IN ARRAY ARRAY['inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner','inkborne_class_origin_owner'] LOOP
    IF EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname=candidate) THEN
      RAISE EXCEPTION 'Disabled family role already present; no replay/resume' USING ERRCODE='23514';
    END IF;
  END LOOP;
  FOREACH candidate IN ARRAY ARRAY['private.hit_die_gate_v1','private.character_action_receipts',
    'private.character_writer_guard_v1','private.character_writer_readiness_v1','private.character_projection_order_v1',
    'private.class_origin_gate_v1','private.character_class_origin_v1','private.character_class_occurrences_v1',
    'private.class_save_occurrence_manifests_v1','private.character_class_commands_v1','private.character_creation_commands_v1',
    'private.class_writer_acceptance_v1','private.class_writer_row_transitions_v1','private.class_origin_revision_events_v1'] LOOP
    IF pg_catalog.to_regclass(candidate) IS NOT NULL THEN RAISE EXCEPTION 'Disabled object already present' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF EXISTS(SELECT FROM pg_catalog.pg_attribute WHERE attrelid='public.characters'::regclass AND attname='action_revision' AND NOT attisdropped)
    OR pg_catalog.to_regprocedure('public.read_hit_die_graph_v1(jsonb,uuid)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.commit_hit_die_v1(uuid,jsonb,jsonb,jsonb,text,timestamptz)') IS NOT NULL THEN
    RAISE EXCEPTION 'Partial disabled installation detected' USING ERRCODE='23514';
  END IF;
  IF pg_catalog.to_regclass('public.character_starting_grants') IS NULL THEN RAISE EXCEPTION 'Original equipment prerequisite absent' USING ERRCODE='23514'; END IF;
END $check$;
COMMIT;
SELECT pg_catalog.jsonb_build_object('profile','core-db-disabled-install-v1','phase','preflight','passed',true);
