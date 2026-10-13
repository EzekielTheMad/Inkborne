-- Native G2 metadata and exact first-denial only. ZERO positive history/fixtures.
BEGIN READ ONLY;
DO $check$
DECLARE stage integer:=current_setting('inkborne.core.stage')::integer; candidate text; api_role text; signature text;
  owner_role text; relation_oid oid; column_name text; actual_count bigint; permission text; result jsonb; message text; trigger_key text; expected_execute boolean;
  synthetic jsonb:='{"context_version":1,"actor_id":"09090000-2026-4a12-8e00-000000000001","session_id":"09090000-2026-4a12-8e00-000000000002","jwt_expires_at":"9999-12-31T23:59:59.000000Z"}';
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' OR stage NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Exact administrative disabled stage required' USING ERRCODE='42501';
  END IF;
  FOR owner_role IN SELECT unnest(CASE WHEN stage=1 THEN ARRAY['inkborne_hit_die_kernel_owner']
    WHEN stage=2 THEN ARRAY['inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner']
    ELSE ARRAY['inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner','inkborne_class_origin_owner'] END) LOOP
    IF NOT EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname=owner_role AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
      OR pg_catalog.has_schema_privilege(owner_role,'public','CREATE') OR pg_catalog.has_schema_privilege(owner_role,'private','CREATE')
      OR NOT pg_catalog.has_schema_privilege(owner_role,'public','USAGE') OR NOT pg_catalog.has_schema_privilege(owner_role,'private','USAGE')
      OR EXISTS(SELECT FROM pg_catalog.pg_auth_members m WHERE m.roleid=owner_role::regrole OR m.member=owner_role::regrole) THEN
      RAISE EXCEPTION 'Runtime role attributes/schema/membership widening' USING ERRCODE='42501';
    END IF;
    FOR signature IN SELECT p.oid::regprocedure::text FROM pg_catalog.pg_proc p WHERE p.proowner=owner_role::regrole LOOP
      IF NOT EXISTS(SELECT FROM pg_catalog.pg_proc WHERE oid=signature::regprocedure AND EXISTS(SELECT FROM unnest(proconfig) AS config_entry(value) WHERE config_entry.value IN ('search_path=','search_path=""'))) THEN
        RAISE EXCEPTION 'Runtime function search path drift' USING ERRCODE='23514';
      END IF;
      IF EXISTS(SELECT FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) entry
        WHERE p.oid=signature::regprocedure AND entry.grantee=0 AND entry.privilege_type='EXECUTE') THEN
        RAISE EXCEPTION 'PUBLIC function EXECUTE widening' USING ERRCODE='42501';
      END IF;
      IF EXISTS(SELECT FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) entry
        WHERE p.oid=signature::regprocedure AND entry.privilege_type='EXECUTE' AND entry.grantee<>p.proowner
          AND (entry.is_grantable OR NOT EXISTS(SELECT FROM pg_catalog.pg_roles grantee WHERE grantee.oid=entry.grantee
            AND grantee.rolname IN ('anon','authenticated','service_role','inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner','inkborne_class_origin_owner')))) THEN
        RAISE EXCEPTION 'Foreign EXECUTE ACL or delegate grant option' USING ERRCODE='42501';
      END IF;
      FOR api_role IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN
        ('anon','authenticated','service_role','inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner','inkborne_class_origin_owner') LOOP
        expected_execute:=api_role=owner_role;
        IF api_role='service_role' AND ((stage=1 AND signature::regprocedure IN (
          pg_catalog.to_regprocedure('public.read_hit_die_receipt_v1(uuid,jsonb,text)'),
          pg_catalog.to_regprocedure('public.resolve_hit_die_snapshot_v1(uuid,uuid)'),
          pg_catalog.to_regprocedure('public.commit_hit_die_v1(uuid,jsonb,jsonb,jsonb,text,timestamptz)')))
          OR (stage>=2 AND signature::regprocedure IN (
            pg_catalog.to_regprocedure('public.read_hit_die_graph_v1(jsonb,uuid)'),
            pg_catalog.to_regprocedure('public.patch_character_state_at_revision_v1(jsonb,uuid,text,jsonb)')))) THEN expected_execute:=true; END IF;
        IF stage>=2 AND api_role='inkborne_hit_die_authority_owner' AND signature::regprocedure IN (
          pg_catalog.to_regprocedure('private.hit_die_exact_keys_v1(jsonb,text[])'),pg_catalog.to_regprocedure('private.hit_die_native_v1(timestamptz)'),
          pg_catalog.to_regprocedure('private.hit_die_millis_v1(timestamptz)'),pg_catalog.to_regprocedure('private.hit_die_deadline_v1(jsonb,timestamptz)')) THEN expected_execute:=true; END IF;
        IF stage>=3 AND api_role='inkborne_class_origin_owner' AND signature::regprocedure=pg_catalog.to_regprocedure('private.lock_character_writer_guard_v1()') THEN expected_execute:=true; END IF;
        IF stage>=4 AND api_role='inkborne_hit_die_authority_owner' AND signature::regprocedure IN (
          pg_catalog.to_regprocedure('private.class_origin_metadata_delta_v1(uuid)'),pg_catalog.to_regprocedure('private.class_origin_consume_metadata_revision_v1(uuid)'),
          pg_catalog.to_regprocedure('private.class_origin_assert_metadata_revision_v1(uuid)')) THEN expected_execute:=true; END IF;
        IF stage>=4 AND api_role='inkborne_class_origin_owner' AND signature::regprocedure=pg_catalog.to_regprocedure('private.apply_class_metadata_revision_v1(uuid)') THEN expected_execute:=true; END IF;
        IF stage>=5 AND api_role='inkborne_hit_die_authority_owner' AND signature::regprocedure=pg_catalog.to_regprocedure('private.class_confirmation_private_inputs_v1(uuid,uuid)') THEN expected_execute:=true; END IF;
        IF stage>=5 AND api_role='inkborne_class_origin_owner' AND signature::regprocedure=pg_catalog.to_regprocedure('private.lock_class_confirmation_sources_v1(jsonb,uuid,uuid)') THEN expected_execute:=true; END IF;
        -- Everything else is false, including authority -> base class finalizer.
        IF pg_catalog.has_function_privilege(api_role,signature,'EXECUTE') IS DISTINCT FROM expected_execute THEN
          RAISE EXCEPTION 'Exact effective cross-owner EXECUTE matrix mismatch' USING ERRCODE='42501';
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM private.hit_die_gate_v1)<>1 OR EXISTS(SELECT FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'Kernel activation forbidden' USING ERRCODE='23514';
  END IF;
  FOREACH candidate IN ARRAY ARRAY['hit_die_roll_receipt_fk','hit_die_receipt_linked_roll_fk'] LOOP
    IF NOT EXISTS(SELECT FROM pg_catalog.pg_constraint WHERE conname=candidate AND contype='f' AND condeferrable AND condeferred AND convalidated
      AND conrelid=CASE WHEN candidate='hit_die_roll_receipt_fk' THEN 'public.character_rolls'::regclass ELSE 'private.character_action_receipts'::regclass END) THEN
      RAISE EXCEPTION 'Linked receipt FK deferral metadata drift' USING ERRCODE='23514';
    END IF;
  END LOOP;
  FOR trigger_key IN SELECT unnest(ARRAY['private.character_action_receipts|preserve_hit_die_receipt','public.character_rolls|preserve_hit_die_roll']
    || CASE WHEN stage>=2 THEN ARRAY['public.characters|hit_die_character_revision','public.characters|hit_die_order_revision_rebind'] ELSE ARRAY[]::text[] END
    || CASE WHEN stage>=3 THEN ARRAY['private.class_writer_acceptance_v1|class_origin_acceptance_guard',
      'private.class_writer_row_transitions_v1|class_origin_row_transition_guard','private.character_class_origin_v1|class_origin_origin_guard',
      'private.character_class_occurrences_v1|class_origin_occurrence_guard','private.character_class_commands_v1|class_origin_class_receipt_guard',
      'private.character_creation_commands_v1|class_origin_creation_receipt_guard','private.class_save_occurrence_manifests_v1|class_origin_manifest_immutable',
      'private.character_class_commands_v1|class_origin_class_receipt_immutable','private.character_creation_commands_v1|class_origin_creation_receipt_immutable',
      'private.class_writer_acceptance_v1|class_origin_acceptance_closure','private.class_writer_row_transitions_v1|class_origin_transition_closure'] ELSE ARRAY[]::text[] END
    || CASE WHEN stage>=4 THEN ARRAY['private.class_origin_revision_events_v1|class_origin_revision_event_guard',
      'private.character_class_origin_v1|class_origin_metadata_revision_dispatch','private.class_origin_revision_events_v1|class_origin_revision_event_closure'] ELSE ARRAY[]::text[] END) LOOP
    IF NOT EXISTS(SELECT FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass(split_part(trigger_key,'|',1))
      AND tgname=split_part(trigger_key,'|',2) AND tgenabled='O') THEN RAISE EXCEPTION 'Protected trigger disabled/absent' USING ERRCODE='23514'; END IF;
    IF trigger_key LIKE '%closure' AND NOT EXISTS(SELECT FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass(split_part(trigger_key,'|',1))
      AND tgname=split_part(trigger_key,'|',2) AND tgdeferrable AND tginitdeferred) THEN RAISE EXCEPTION 'Original deferred closure lost' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF stage>=2 THEN
    IF (SELECT count(*) FROM private.character_writer_guard_v1)<>1 OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
      OR EXISTS(SELECT FROM private.character_writer_readiness_v1 WHERE ready) OR EXISTS(SELECT FROM private.character_projection_order_v1) THEN
      RAISE EXCEPTION 'Writer readiness/order producer activation' USING ERRCODE='23514';
    END IF;
    FOREACH candidate IN ARRAY ARRAY['public.content_definitions','public.game_systems','public.campaigns','public.campaign_members','public.content_shares','public.content_versions'] LOOP
      relation_oid:=candidate::regclass; column_name:=CASE WHEN candidate='public.content_versions' THEN 'content_id' ELSE 'id' END;
      IF NOT pg_catalog.has_column_privilege('inkborne_hit_die_authority_owner',relation_oid,column_name,'UPDATE')
        OR pg_catalog.has_table_privilege('inkborne_hit_die_authority_owner',relation_oid,'UPDATE')
        OR NOT EXISTS(SELECT FROM pg_catalog.pg_policy WHERE polrelid=relation_oid AND polcmd='w' AND NOT polpermissive
          AND 'inkborne_hit_die_authority_owner'::regrole=ANY(polroles) AND pg_catalog.pg_get_expr(polwithcheck,polrelid)='false') THEN
        RAISE EXCEPTION 'Exact lock-only column/policy metadata absent' USING ERRCODE='42501';
      END IF;
    END LOOP;
    EXECUTE 'SET LOCAL ROLE service_role';
    result:=public.read_hit_die_graph_v1(synthetic,'09090000-2026-4a12-8e00-000000000003'::uuid);
    IF result IS DISTINCT FROM '{"status":"unready","reason":"auth_unavailable"}'::jsonb THEN RAISE EXCEPTION 'Unexpected graph authority success' USING ERRCODE='23514'; END IF;
    result:=public.patch_character_state_at_revision_v1(synthetic,'09090000-2026-4a12-8e00-000000000003'::uuid,'0','{"inspiration":true}'::jsonb);
    IF result IS DISTINCT FROM '{"status":"unready","reason":"auth_unavailable"}'::jsonb THEN RAISE EXCEPTION 'Unexpected inspiration authority success' USING ERRCODE='23514'; END IF;
    RESET ROLE;
    FOREACH signature IN ARRAY ARRAY['public.read_hit_die_receipt_v1(uuid,jsonb,text)','public.resolve_hit_die_snapshot_v1(uuid,uuid)',
      'public.commit_hit_die_v1(uuid,jsonb,jsonb,jsonb,text,timestamptz)'] LOOP
      IF pg_catalog.has_function_privilege('service_role',signature,'EXECUTE') THEN RAISE EXCEPTION 'Legacy sessionless caller escape' USING ERRCODE='42501'; END IF;
    END LOOP;
    EXECUTE 'SET LOCAL ROLE inkborne_hit_die_authority_owner';
    BEGIN
      PERFORM private.require_verified_hit_die_auth_v1(synthetic);
      RAISE EXCEPTION 'Authority Auth unexpectedly succeeded' USING ERRCODE='23514';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
      IF message<>'auth_unavailable' THEN RAISE; END IF;
    END;
    RESET ROLE;
  END IF;
  IF stage>=3 THEN
    IF (SELECT count(*) FROM private.class_origin_gate_v1)<>1 OR EXISTS(SELECT FROM private.class_origin_gate_v1 WHERE enabled) THEN
      RAISE EXCEPTION 'Class gate activation' USING ERRCODE='23514';
    END IF;
    EXECUTE 'SET LOCAL ROLE inkborne_class_origin_owner';
    BEGIN
      PERFORM private.begin_class_origin_acceptance_v1(synthetic,'{}'::jsonb);
      RAISE EXCEPTION 'Class issuer unexpectedly succeeded' USING ERRCODE='23514';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
      IF message<>'auth_unavailable' THEN RAISE; END IF;
    END;
    IF stage>=5 THEN
      BEGIN
        PERFORM private.confirm_already_first_class_origin_v1(synthetic,'{}'::jsonb);
        RAISE EXCEPTION 'Class entry unexpectedly succeeded' USING ERRCODE='23514';
      EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
        IF message<>'auth_unavailable' THEN RAISE; END IF;
      END;
    END IF;
    RESET ROLE;
  END IF;
  IF stage>=5 THEN
    FOREACH candidate IN ARRAY ARRAY['public.character_content_refs','public.character_inventory','public.character_spells','public.character_feature_grants','public.character_spell_grants'] LOOP
      relation_oid:=candidate::regclass;
      IF NOT pg_catalog.has_column_privilege('inkborne_hit_die_authority_owner',relation_oid,'id','UPDATE')
        OR pg_catalog.has_table_privilege('inkborne_hit_die_authority_owner',relation_oid,'UPDATE')
        OR NOT EXISTS(SELECT FROM pg_catalog.pg_policy WHERE polrelid=relation_oid AND polname='class_confirmation_no_mutation'
          AND NOT polpermissive AND polcmd='w' AND 'inkborne_hit_die_authority_owner'::regrole=ANY(polroles)
          AND pg_catalog.pg_get_expr(polwithcheck,polrelid)='false') THEN RAISE EXCEPTION 'D5 lock-only column policy drift' USING ERRCODE='42501'; END IF;
    END LOOP;
  END IF;
  FOREACH candidate IN ARRAY ARRAY['private.hit_die_gate_v1','private.character_writer_guard_v1','private.character_writer_readiness_v1','private.class_origin_gate_v1','private.character_action_receipts','private.character_projection_order_v1',
    'private.character_class_origin_v1','private.character_class_occurrences_v1','private.class_save_occurrence_manifests_v1',
    'private.character_class_commands_v1','private.character_creation_commands_v1','private.class_writer_acceptance_v1',
    'private.class_writer_row_transitions_v1','private.class_origin_revision_events_v1'] LOOP
    relation_oid:=pg_catalog.to_regclass(candidate);
    IF relation_oid IS NULL THEN CONTINUE; END IF;
    EXECUTE pg_catalog.format('SELECT count(*) FROM %s',relation_oid::regclass) INTO actual_count;
    IF actual_count<>CASE WHEN candidate IN ('private.hit_die_gate_v1','private.character_writer_guard_v1','private.class_origin_gate_v1') THEN 1 WHEN candidate='private.character_writer_readiness_v1' THEN 13 ELSE 0 END OR NOT EXISTS(SELECT FROM pg_catalog.pg_class WHERE oid=relation_oid AND relrowsecurity) THEN
      RAISE EXCEPTION 'New product evidence must remain empty and RLS protected' USING ERRCODE='23514';
    END IF;
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH permission IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF pg_catalog.has_table_privilege(api_role,relation_oid,permission) THEN RAISE EXCEPTION 'Protected evidence privilege widening' USING ERRCODE='42501'; END IF;
        IF permission IN ('SELECT','INSERT','UPDATE','REFERENCES') AND pg_catalog.has_any_column_privilege(api_role,relation_oid,permission) THEN
          RAISE EXCEPTION 'Protected evidence column privilege widening' USING ERRCODE='42501';
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOREACH candidate IN ARRAY ARRAY['private.character_action_receipts','private.character_class_commands_v1','private.character_creation_commands_v1'] LOOP
    relation_oid:=pg_catalog.to_regclass(candidate);
    IF relation_oid IS NULL THEN CONTINUE; END IF;
    owner_role:=CASE WHEN candidate='private.character_action_receipts' THEN 'inkborne_hit_die_kernel_owner' ELSE 'inkborne_class_origin_owner' END;
    IF NOT pg_catalog.has_table_privilege(owner_role,relation_oid,'SELECT') OR NOT pg_catalog.has_table_privilege(owner_role,relation_oid,'INSERT')
      OR pg_catalog.has_table_privilege(owner_role,relation_oid,'UPDATE') OR pg_catalog.has_any_column_privilege(owner_role,relation_oid,'UPDATE')
      OR pg_catalog.has_table_privilege(owner_role,relation_oid,'DELETE') THEN RAISE EXCEPTION 'Immutable receipt runtime privileges drift' USING ERRCODE='42501'; END IF;
  END LOOP;
  EXECUTE 'SET LOCAL ROLE inkborne_hit_die_kernel_owner';
  BEGIN
    PERFORM private.read_locked_hit_die_dependencies_v1('09090000-2026-4a12-8e00-000000000003'::uuid);
    RAISE EXCEPTION 'Legacy dependency unexpectedly succeeded' USING ERRCODE='23514';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
    IF message<>'Hit-die dependency authority, writer fences and lock protocol unavailable' THEN RAISE; END IF;
  END;
  RESET ROLE;
END $check$;
COMMIT;
SELECT pg_catalog.jsonb_build_object('profile','core-db-disabled-install-v1','stage',current_setting('inkborne.core.stage')::integer,'passed',true,
  'database',current_database(),'actor',current_user,'backend_pid',pg_catalog.pg_backend_pid(),
  'metadata',(SELECT coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'schema',n.nspname,'name',p.proname,'owner',r.rolname,
    'definition_md5',pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),'source_md5',pg_catalog.md5(p.prosrc),
    'security_definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl::text,
    'acl_grantees',(SELECT coalesce(jsonb_agg(grantee.rolname ORDER BY grantee.rolname),'[]'::jsonb)
      FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) permission
      JOIN pg_catalog.pg_roles grantee ON grantee.oid=permission.grantee WHERE permission.privilege_type='EXECUTE'),
    'argument_types',(SELECT coalesce(jsonb_agg(type_ns.nspname||'.'||type_row.typname ORDER BY args.position),'[]'::jsonb)
      FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS args(type_oid,position)
      JOIN pg_catalog.pg_type type_row ON type_row.oid=args.type_oid JOIN pg_catalog.pg_namespace type_ns ON type_ns.oid=type_row.typnamespace),
    'execute',(SELECT jsonb_object_agg(executor.rolname,pg_catalog.has_function_privilege(executor.oid,p.oid,'EXECUTE')) FROM pg_catalog.pg_roles executor
      WHERE executor.rolname IN ('anon','authenticated','service_role','inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner','inkborne_class_origin_owner'))
      || pg_catalog.jsonb_build_object('PUBLIC',EXISTS(SELECT FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) permission
        WHERE permission.grantee=0 AND permission.privilege_type='EXECUTE'))) ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE r.rolname IN
    ('inkborne_hit_die_kernel_owner','inkborne_hit_die_authority_owner','inkborne_class_origin_owner')),
  'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'deferrable',c.condeferrable,
    'initially_deferred',c.condeferred,'validated',c.convalidated,'definition',pg_catalog.pg_get_constraintdef(c.oid)) ORDER BY c.conrelid,c.conname),'[]'::jsonb)
    FROM pg_catalog.pg_constraint c WHERE c.conrelid IN (
      SELECT rel.oid FROM pg_catalog.pg_class rel JOIN pg_catalog.pg_namespace n ON n.oid=rel.relnamespace
      WHERE n.nspname='private') OR c.conname LIKE 'hit_die_%'),
  'limits','No positive Auth/history/locking/atomicity/replay/unreachable-body acceptance; SQL role simulation only.');
