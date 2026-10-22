-- SOURCE ONLY / UNAPPLIED. Approved plan10e295; fixed production534b5d8.
-- Dependency Git blobs (not a native installation attestation). Producer has
-- the 2026-10-22 reviewed CASE/choice-alias corrections; other sources unchanged.
-- class-origin-producer.sql 3ad143c239c404f2393a14fb98eb46fc223c46cd
-- class-origin-joint-revision.sql d07ce2f53b0af06950ae3eb46006906e804701ed
-- class-origin-confirmation-producer.sql 7d0d7db1d3988e94de5143b84e7f3c89b8cb3176
-- hit-die-authority-and-writers.sql 7f8650efc96617063cf03e6ea4c5763f684ce72c
-- hit-die-transaction.sql 5d9fc835b0b8b957ca88e8fedf2ff6cc4b752faf
-- class-origin-command-schema.ts d935b7c1bb14dedce381499ab3f21abb50efa96a
-- Load AFTER those unchanged stages. No app/issuer/role/ready/Auth activation.
BEGIN;
SET LOCAL search_path='';
DO $$ DECLARE class_oid oid; authority_oid oid; item record; actual jsonb; BEGIN
  SELECT oid INTO class_oid FROM pg_catalog.pg_roles WHERE rolname='inkborne_class_origin_owner'
    AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication);
  SELECT oid INTO authority_oid FROM pg_catalog.pg_roles WHERE rolname='inkborne_hit_die_authority_owner'
    AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication);
  IF class_oid IS NULL OR authority_oid IS NULL OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid IN(class_oid,authority_oid) OR member IN(class_oid,authority_oid))
    OR pg_catalog.has_schema_privilege(class_oid,'public','CREATE') OR pg_catalog.has_schema_privilege(class_oid,'private','CREATE')
    OR pg_catalog.has_schema_privilege(authority_oid,'public','CREATE') OR pg_catalog.has_schema_privilege(authority_oid,'private','CREATE')
    OR NOT pg_catalog.has_schema_privilege(class_oid,'public','USAGE') OR NOT pg_catalog.has_schema_privilege(class_oid,'private','USAGE')
    OR NOT pg_catalog.has_schema_privilege(authority_oid,'public','USAGE') OR NOT pg_catalog.has_schema_privilege(authority_oid,'private','USAGE')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid IN('public.characters'::regclass,'private.character_projection_order_v1'::regclass)
      AND (relowner IN(class_oid,authority_oid) OR NOT relrowsecurity))
    OR NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND NOT enabled)
    OR (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready) THEN
    RAISE EXCEPTION 'Isolated original owners/RLS/disabled prerequisites required' USING ERRCODE='42501';
  END IF;
  -- Exact frozen prosrc, owner, execution mode AND explicit configuration.
  -- Every one of these 23 original headers explicitly sets search_path=''.
  FOR item IN SELECT * FROM (VALUES
-- FROZEN_FUNCTIONS_BEGIN
    ('private.require_class_origin_auth_v1(jsonb)','inkborne_class_origin_owner','34837118aa95bedd7fd9a85d8b066e9d',false,'plpgsql','void','v'),
    ('private.class_origin_receipt_shape_v1(jsonb)','inkborne_class_origin_owner','30f47e0eaae199b33be22761ba4536cf',false,'plpgsql','boolean','i'),
    ('private.class_origin_exact_keys_v1(jsonb,text[])','inkborne_class_origin_owner','601e304fe6b551afc032bfdbe8139d3e',false,'sql','boolean','i'),
    ('private.class_origin_uuid_v1(jsonb)','inkborne_class_origin_owner','5720f1938f6622f2d6584e77beb02411',false,'plpgsql','boolean','i'),
    ('private.class_origin_instant_v1(jsonb)','inkborne_class_origin_owner','48bf7ab8e7701266e9b11bd40ee90722',false,'plpgsql','boolean','i'),
    ('private.class_origin_decimal_v1(text)','inkborne_class_origin_owner','bff8ecc025cda61e34936581f78c953c',false,'plpgsql','boolean','i'),
    ('private.class_origin_row_scope_v1(text,jsonb,uuid,uuid)','inkborne_class_origin_owner','84678f1b56b436c22035d0705b861fc6',false,'sql','boolean','i'),
    ('private.class_origin_row_key_v1(text,jsonb)','inkborne_class_origin_owner','2e522faea8c8aef01accae2ea9907120',false,'sql','jsonb','i'),
    ('private.class_origin_ids_match_v1(uuid[],uuid[])','inkborne_class_origin_owner','28f6163efe12e99757a3edc470c31edb',false,'sql','boolean','i'),
    ('private.class_origin_protected_row_guard_v1()','inkborne_class_origin_owner','632bd1c54c3ce2d0a9fb0662ae6b34f1',true,'plpgsql','trigger','v'),
    ('private.class_origin_row_transition_guard_v1()','inkborne_class_origin_owner','98948e6536641b7d8df05b991e824503',true,'plpgsql','trigger','v'),
    ('private.class_origin_immutable_v1()','inkborne_class_origin_owner','5909a75f2762f4e153b5ce5cc95c2115',false,'plpgsql','trigger','v'),
    ('private.class_origin_finalize_bootstrap_v1(uuid)','inkborne_class_origin_owner','33eb67f9610636fbe8d2f21a7a2db81b',false,'plpgsql','void','v'),
    ('private.class_origin_finalize_acceptance_v1(uuid)','inkborne_class_origin_owner','b6a63f555d25eb7b375702310b95126c',true,'plpgsql','void','v'),
    ('private.class_origin_read_final_graph_v1(uuid,uuid[])','inkborne_class_origin_owner','3e860cbfbeacc9594d1dbcb7ec2d28ec',false,'plpgsql','jsonb','v'),
    ('private.class_origin_assert_common_v1(uuid)','inkborne_class_origin_owner','bc903e21c8921db490a1ccc1be64e52c',false,'plpgsql','jsonb','v'),
    ('private.class_origin_deferred_finalizer_v1()','inkborne_class_origin_owner','48058f01ba8e27be3794a627c4655e2f',true,'plpgsql','trigger','v'),
    ('private.class_origin_acceptance_guard_v1()','inkborne_class_origin_owner','74549af21275768d4ac44585fec72e03',true,'plpgsql','trigger','v'),
    ('private.hit_die_context_shape_v1(jsonb)','inkborne_hit_die_authority_owner','f244630700c62b63f5185ba59a2b36d5',false,'plpgsql','boolean','s'),
    ('private.require_verified_hit_die_auth_v1(jsonb)','inkborne_hit_die_authority_owner','972773f897b4f6630b5d7c948a0c851c',false,'plpgsql','void','v'),
    ('private.lock_character_writer_guard_v1()','inkborne_hit_die_authority_owner','f7efb029110ebb9e486b1a3b9b8f8779',false,'plpgsql','void','v'),
    ('private.hit_die_exact_keys_v1(jsonb,text[])','inkborne_hit_die_kernel_owner','38eec7b37a3f5e1741fe00e66e5c0f89',false,'sql','boolean','i'),
    ('private.hit_die_native_v1(timestamp with time zone)','inkborne_hit_die_kernel_owner','11f0c36f37912dc882eba9238b709c8c',false,'sql','text','s')
-- FROZEN_FUNCTIONS_END
  ) frozen(signature,owner_name,body_md5,is_definer,language_name,return_type,volatility) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner JOIN pg_catalog.pg_language l ON l.oid=p.prolang
      WHERE p.oid=pg_catalog.to_regprocedure(item.signature) AND r.rolname=item.owner_name
      AND p.prosecdef=item.is_definer AND p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]
      AND l.lanname=item.language_name AND p.prorettype=pg_catalog.to_regtype(item.return_type)
      AND NOT p.proretset AND p.prokind='f' AND p.provolatile::text=item.volatility
      AND pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n'))=item.body_md5)
      OR NOT pg_catalog.has_function_privilege(CASE WHEN item.owner_name='inkborne_class_origin_owner' THEN class_oid ELSE authority_oid END,
        pg_catalog.to_regprocedure(item.signature),'EXECUTE') THEN
      RAISE EXCEPTION 'Frozen function source/owner/effective capability drift: %',item.signature USING ERRCODE='42501';
    END IF;
  END LOOP;
  -- Complete native parent columns/defaults, not a test-created graph/template.
  SELECT pg_catalog.jsonb_object_agg(a.attname,pg_catalog.jsonb_build_array(pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_catalog.pg_get_expr(d.adbin,d.adrelid))) INTO actual
    FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.characters'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  IF actual IS DISTINCT FROM '{"id":["uuid",true,"gen_random_uuid()"],"user_id":["uuid",true,null],"system_id":["uuid",true,null],"campaign_id":["uuid",false,null],"name":["text",true,null],"visibility":["text",true,"''private''::text"],"archived":["boolean",true,"false"],"created_at":["timestamp with time zone",true,"now()"],"level":["integer",true,"1"],"base_stats":["jsonb",true,"''{}''::jsonb"],"choices":["jsonb",true,"''{}''::jsonb"],"state":["jsonb",true,"''{}''::jsonb"],"narrative":["jsonb",true,"''{}''::jsonb"],"narrative_rich":["jsonb",true,"''{}''::jsonb"],"primary_color":["text",false,null],"action_revision":["bigint",true,"0"]}'::jsonb THEN
    RAISE EXCEPTION 'Native parent type/default drift' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('private.character_projection_order_v1','{"character_id":["uuid",true,null],"producer_version":["integer",true,null],"producer_revision":["bigint",true,null],"pins":["uuid[]",true,null],"inventory":["uuid[]",true,null],"spells":["uuid[]",true,null],"feature_grants":["uuid[]",true,null],"spell_grants":["uuid[]",true,null]}'::jsonb),
    ('private.character_class_origin_v1','{"character_id":["uuid",true,null],"schema_version":["integer",true,null],"system_id":["uuid",true,null],"origin_status":["text",true,null],"origin_occurrence_id":["uuid",false,null],"creation_provenance":["text",false,null],"creation_operation_id":["uuid",false,null],"source_draft_operation_id":["uuid",false,null],"role_proof":["jsonb",false,null],"command_revision":["bigint",true,null]}'::jsonb),
    ('private.character_creation_commands_v1','{"verified_actor_id":["uuid",true,null],"operation_id":["uuid",true,null],"target_character_id":["uuid",true,null],"receipt":["jsonb",true,null]}'::jsonb)
  ) shapes(relation,expected) LOOP
    SELECT pg_catalog.jsonb_object_agg(a.attname,pg_catalog.jsonb_build_array(pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_catalog.pg_get_expr(d.adbin,d.adrelid))) INTO actual
      FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=item.relation::regclass AND a.attnum>0 AND NOT a.attisdropped;
    IF actual IS DISTINCT FROM item.expected THEN RAISE EXCEPTION 'Bootstrap native row type/default drift: %',item.relation USING ERRCODE='42501'; END IF;
  END LOOP;
  -- No hidden-RLS absence: existing unconditional internal read policy/effective
  -- SELECT and no applicable restrictive SELECT policy for each queried role.
  FOR item IN SELECT * FROM (VALUES
    ('public.characters',class_oid),('public.characters',authority_oid),('private.character_projection_order_v1',class_oid),
    ('private.character_projection_order_v1',authority_oid),('private.character_class_origin_v1',class_oid)
  ) visibility(relation,role_oid) LOOP
    IF NOT pg_catalog.has_table_privilege(item.role_oid,item.relation,'SELECT')
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=item.relation::regclass AND polcmd IN('r','*')
        AND item.role_oid=ANY(polroles) AND polpermissive AND pg_catalog.pg_get_expr(polqual,polrelid)='true')
      OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=item.relation::regclass AND polcmd IN('r','*') AND NOT polpermissive
        AND (0::oid=ANY(polroles) OR item.role_oid=ANY(polroles))) THEN
      RAISE EXCEPTION 'Native absence visibility drift: %',item.relation USING ERRCODE='42501'; END IF;
  END LOOP;
  -- Acceptance has no target FK; proofs reference the already-created journal.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='private.class_writer_acceptance_v1'::regclass AND contype='f')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='private.class_writer_row_transitions_v1'::regclass AND contype='f'
      AND confrelid='private.class_writer_acceptance_v1'::regclass AND NOT condeferrable) THEN
    RAISE EXCEPTION 'Preinsert journal RI ordering drift' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES('private.character_class_origin_v1'),('private.character_creation_commands_v1'),('private.character_projection_order_v1')) relations(name) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=item.name::regclass AND contype='f' AND confrelid='public.characters'::regclass AND NOT condeferrable) THEN
      RAISE EXCEPTION 'Immediate target FK required: %',item.name USING ERRCODE='42501'; END IF;
  END LOOP;
  SELECT pg_catalog.jsonb_object_agg(t.tgname,pg_catalog.jsonb_build_array(t.tgtype,t.tgenabled,t.tgfoid::regprocedure::text,t.tgdeferrable,t.tginitdeferred)) INTO actual
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.characters'::regclass AND NOT t.tgisinternal;
  IF actual IS DISTINCT FROM '{"validate_character_content_boundaries":[17,"O","private.validate_character_content_boundaries()",false,false],"prune_inactive_feature_refs_after_choices":[17,"O","private.prune_inactive_feature_refs_after_choices()",false,false],"prune_inactive_asi_choices_before_choices":[19,"O","private.prune_inactive_asi_choices_before_choices()",false,false],"enforce_asi_choice_map_boundary":[19,"O","private.enforce_asi_choice_map_boundary()",false,false],"enforce_background_choice_map_boundary":[23,"O","private.enforce_background_choice_map_boundary()",false,false],"hit_die_character_revision":[19,"O","private.hit_die_character_revision_v1()",false,false],"hit_die_order_revision_rebind":[17,"O","private.hit_die_order_revision_rebind_v1()",false,false]}'::jsonb THEN
    RAISE EXCEPTION 'Native parent trigger inventory drift' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('class_origin_acceptance_closure','private.class_writer_acceptance_v1'),('class_origin_transition_closure','private.class_writer_row_transitions_v1')) closures(name,relation) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname=item.name AND tgrelid=item.relation::regclass AND tgdeferrable AND tginitdeferred
      AND tgenabled='O' AND tgfoid='private.class_origin_deferred_finalizer_v1()'::regprocedure) THEN
      RAISE EXCEPTION 'Original deferred closure absent' USING ERRCODE='42501'; END IF;
  END LOOP;
  -- Exact bounded ORIGINAL wiring, including the original joint UPDATE dispatch.
  -- Five required guard groups are not proved by body fingerprints alone.
  FOR item IN SELECT * FROM (VALUES
    ('private.class_writer_acceptance_v1','{"class_origin_acceptance_guard":[31,"O","private.class_origin_acceptance_guard_v1()",false,false,0,"",""],"class_origin_acceptance_closure":[21,"O","private.class_origin_deferred_finalizer_v1()",true,true,0,"",""]}'::jsonb),
    ('private.class_writer_row_transitions_v1','{"class_origin_row_transition_guard":[31,"O","private.class_origin_row_transition_guard_v1()",false,false,0,"",""],"class_origin_transition_closure":[21,"O","private.class_origin_deferred_finalizer_v1()",true,true,0,"",""]}'::jsonb),
    ('private.character_class_origin_v1','{"class_origin_origin_guard":[31,"O","private.class_origin_protected_row_guard_v1()",false,false,2,"6f726967696e006368617261637465725f696400",""],"class_origin_metadata_revision_dispatch":[17,"O","private.class_origin_metadata_revision_dispatch_v1()",false,false,0,"",""]}'::jsonb),
    ('private.character_creation_commands_v1','{"class_origin_creation_receipt_guard":[7,"O","private.class_origin_protected_row_guard_v1()",false,false,2,"6372656174696f6e5f726563656970740076657269666965645f6163746f725f69642c6f7065726174696f6e5f696400",""],"class_origin_creation_receipt_immutable":[27,"O","private.class_origin_immutable_v1()",false,false,0,"",""]}'::jsonb)
  ) wiring(relation,expected) LOOP
    SELECT pg_catalog.jsonb_object_agg(t.tgname,pg_catalog.jsonb_build_array(t.tgtype,t.tgenabled,t.tgfoid::regprocedure::text,
      t.tgdeferrable,t.tginitdeferred,t.tgnargs,pg_catalog.encode(t.tgargs,'hex'),t.tgattr::text)) INTO actual
      FROM pg_catalog.pg_trigger t WHERE t.tgrelid=item.relation::regclass AND NOT t.tgisinternal;
    IF actual IS DISTINCT FROM item.expected THEN RAISE EXCEPTION 'Original private bootstrap trigger wiring drift: %',item.relation USING ERRCODE='42501'; END IF;
  END LOOP;
END $$;

-- 1. Class-owned policy validators: independent literal refusal, not forged proof admission.
CREATE FUNCTION private.class_origin_empty_parent_allowed_v1(p_parent public.characters) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; parent_json jsonb; BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND enabled) THEN RETURN false; END IF;
  RETURN false; -- Native bootstrap admission is unconditionally unavailable.
  -- Unreachable transaction correspondence blueprint; no positive policy branch.
  PERFORM private.lock_character_writer_guard_v1();
  parent_json:=pg_catalog.to_jsonb(p_parent)||pg_catalog.jsonb_build_object('action_revision',p_parent.action_revision::text);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE target_character_id=p_parent.id AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized;
  RETURN FOUND AND j.acceptance_kind='bootstrap_new' AND j.before_parent IS NULL AND j.before_origin IS NULL AND NOT j.revision_transition_consumed
    AND j.preinsert_proof->>'acceptance_id'=j.acceptance_id::text AND j.preinsert_proof->>'target_character_id'=p_parent.id::text
    AND j.preinsert_proof->>'transaction_id'=j.transaction_id::text AND p_parent.user_id=j.verified_actor_id
    AND parent_json=j.expected_graph->'parent' AND p_parent.action_revision=0 AND p_parent.campaign_id IS NULL
    AND private.class_origin_receipt_shape_v1(j.receipt) AND j.receipt->>'verified_actor_id'=p_parent.user_id::text
    AND j.receipt->>'target_character_id'=p_parent.id::text AND pg_catalog.jsonb_array_length(j.planned_transitions)=2
    AND (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id AND NOT consumed)=2;
END $$;
ALTER FUNCTION private.class_origin_empty_parent_allowed_v1(public.characters) OWNER TO inkborne_class_origin_owner;

CREATE FUNCTION private.class_origin_empty_order_allowed_v1(p_order private.character_projection_order_v1) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND enabled) THEN RETURN false; END IF;
  RETURN false; -- Native bootstrap admission is unconditionally unavailable.
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE target_character_id=p_order.character_id AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized;
  RETURN FOUND AND j.acceptance_kind='bootstrap_new' AND NOT j.revision_transition_consumed AND j.before_parent IS NULL AND j.before_origin IS NULL
    AND p_order.producer_version=1 AND p_order.producer_revision=0
    AND pg_catalog.to_jsonb(p_order)||pg_catalog.jsonb_build_object('producer_revision',p_order.producer_revision::text)=j.expected_graph->'order'
    AND (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id AND consumed)=2
    AND pg_catalog.jsonb_array_length(j.planned_transitions)=2;
END $$;
ALTER FUNCTION private.class_origin_empty_order_allowed_v1(private.character_projection_order_v1) OWNER TO inkborne_class_origin_owner;

CREATE FUNCTION private.class_origin_empty_order_inputs_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; parent_json jsonb; origin_json jsonb; BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND enabled) THEN RAISE EXCEPTION 'bootstrap_admission_unavailable' USING ERRCODE='P0001'; END IF;
  RAISE EXCEPTION 'bootstrap_admission_unavailable' USING ERRCODE='P0001';
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance FOR UPDATE;
  IF NOT FOUND OR j.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR j.finalized OR j.revision_transition_consumed
    OR j.acceptance_kind IS DISTINCT FROM 'bootstrap_new' OR j.before_parent IS NOT NULL OR j.before_origin IS NOT NULL
    OR j.preinsert_proof->>'acceptance_id' IS DISTINCT FROM j.acceptance_id::text
    OR j.preinsert_proof->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR j.preinsert_proof->>'transaction_id' IS DISTINCT FROM j.transaction_id::text
    OR NOT COALESCE(private.class_origin_receipt_shape_v1(j.receipt),false) OR pg_catalog.jsonb_array_length(j.planned_transitions)<>2
    OR (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id)<>2
    OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id AND (NOT consumed OR before_row IS NOT NULL)) THEN
    RAISE EXCEPTION 'Exact pending bootstrap/two consumed proofs required' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text) INTO parent_json
    FROM public.characters c WHERE c.id=j.target_character_id AND c.user_id=j.verified_actor_id FOR UPDATE;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('command_revision',o.command_revision::text) INTO origin_json
    FROM private.character_class_origin_v1 o WHERE o.character_id=j.target_character_id FOR UPDATE;
  IF parent_json IS DISTINCT FROM j.expected_graph->'parent' OR origin_json IS DISTINCT FROM j.expected_graph->'origin'
    OR parent_json->>'action_revision' IS DISTINCT FROM '0' OR origin_json->>'command_revision' IS DISTINCT FROM '0'
    OR origin_json->>'origin_status' IS DISTINCT FROM 'draft' OR origin_json->>'creation_provenance' IS DISTINCT FROM 'new_character'
    OR origin_json->>'creation_operation_id' IS DISTINCT FROM j.receipt->>'operation_id'
    OR NOT EXISTS(SELECT 1 FROM private.character_creation_commands_v1 creation WHERE creation.verified_actor_id=j.verified_actor_id
      AND creation.target_character_id=j.target_character_id AND creation.operation_id=(j.receipt->>'operation_id')::uuid AND creation.receipt=j.receipt)
    OR EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 WHERE character_id=j.target_character_id)
    OR EXISTS(SELECT 1 FROM private.character_projection_order_v1 WHERE character_id=j.target_character_id) THEN
    RAISE EXCEPTION 'Actual fresh rows/order absence mismatch' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=j.acceptance_id AND t.relation_key='origin'
      AND t.row_key=pg_catalog.jsonb_build_array(j.target_character_id) AND t.after_row=origin_json AND t.consumed)
    OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t JOIN private.character_creation_commands_v1 creation
      ON creation.verified_actor_id=j.verified_actor_id AND creation.operation_id=(j.receipt->>'operation_id')::uuid
      WHERE t.acceptance_id=j.acceptance_id AND t.relation_key='creation_receipt'
        AND t.row_key=pg_catalog.jsonb_build_array(j.verified_actor_id,creation.operation_id) AND t.after_row=pg_catalog.to_jsonb(creation) AND t.consumed) THEN
    RAISE EXCEPTION 'Actual consumed-row correspondence required' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('target_character_id',j.target_character_id,'verified_actor_id',j.verified_actor_id,'expected_graph',j.expected_graph);
END $$;
ALTER FUNCTION private.class_origin_empty_order_inputs_v1(uuid) OWNER TO inkborne_class_origin_owner;

-- 2. R09-owned prefix/system/order. No journal SELECT/DML privileges added.
CREATE FUNCTION private.class_bootstrap_verified_prefix_v1(p_context jsonb) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  IF NOT COALESCE(private.hit_die_context_shape_v1(p_context),false) THEN RAISE EXCEPTION 'invalid_context' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_character_writer_guard_v1();
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  IF pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'expired_context' USING ERRCODE='42501'; END IF;
  RETURN (p_context->>'actor_id')::uuid; -- Only after the native verifier; it currently ALWAYS raises.
END $$;
ALTER FUNCTION private.class_bootstrap_verified_prefix_v1(jsonb) OWNER TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.lock_class_bootstrap_system_v1(p_context jsonb,p_system uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE system_row public.game_systems%ROWTYPE; BEGIN
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO system_row FROM public.game_systems WHERE id=p_system FOR SHARE;
  IF NOT FOUND OR system_row.status IS DISTINCT FROM 'published' OR system_row.slug IS DISTINCT FROM 'dnd-5e-2014' THEN
    RAISE EXCEPTION 'published_system_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  IF pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'expired_context' USING ERRCODE='42501'; END IF;
  RETURN pg_catalog.to_jsonb(system_row);
END $$;
ALTER FUNCTION private.lock_class_bootstrap_system_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.initialize_empty_class_order_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE inputs jsonb; c public.characters%ROWTYPE; ordering private.character_projection_order_v1%ROWTYPE; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  inputs:=private.class_origin_empty_order_inputs_v1(p_acceptance); -- Independently ALWAYS unavailable; no alternate path.
  SELECT * INTO c FROM public.characters WHERE id=(inputs->>'target_character_id')::uuid AND user_id=(inputs->>'verified_actor_id')::uuid FOR UPDATE;
  IF NOT FOUND OR c.action_revision<>0 OR pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text) IS DISTINCT FROM inputs#>'{expected_graph,parent}'
    OR EXISTS(SELECT 1 FROM private.character_projection_order_v1 WHERE character_id=c.id)
    OR EXISTS(SELECT 1 FROM public.character_content_refs WHERE character_id=c.id)
    OR EXISTS(SELECT 1 FROM public.character_inventory WHERE character_id=c.id)
    OR EXISTS(SELECT 1 FROM public.character_spells WHERE character_id=c.id)
    OR EXISTS(SELECT 1 FROM public.character_feature_grants WHERE character_id=c.id)
    OR EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=c.id) THEN
    RAISE EXCEPTION 'Genuine empty source domains required' USING ERRCODE='23514'; END IF;
  -- Retained class occurrence absence is certified by class-owned inputs + expected graph.
  IF inputs#>'{expected_graph,occurrences}' IS DISTINCT FROM '[]'::jsonb OR inputs#>'{expected_graph,versions}' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'No class/source closure at bootstrap' USING ERRCODE='23514'; END IF;
  INSERT INTO private.character_projection_order_v1(character_id,producer_version,producer_revision,pins,inventory,spells,feature_grants,spell_grants)
    VALUES(c.id,1,0,ARRAY[]::uuid[],ARRAY[]::uuid[],ARRAY[]::uuid[],ARRAY[]::uuid[],ARRAY[]::uuid[]) RETURNING * INTO ordering;
  IF pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text) IS DISTINCT FROM inputs#>'{expected_graph,order}' THEN
    RAISE EXCEPTION 'Initial order readback mismatch' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text);
END $$;
ALTER FUNCTION private.initialize_empty_class_order_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;

-- 3. Actual private orchestration. No compatibility bootstrap, public issuer or model.
CREATE FUNCTION private.create_empty_class_origin_character_v1(p_context jsonb,p_intent jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; prior private.character_creation_commands_v1%ROWTYPE; completed private.class_writer_acceptance_v1%ROWTYPE;
  c public.characters%ROWTYPE; inserted public.characters%ROWTYPE; origin private.character_class_origin_v1%ROWTYPE;
  target uuid; acceptance uuid; accepted timestamptz; receipt jsonb; expected_graph jsonb; transitions jsonb; transition jsonb;
  parent_json jsonb; origin_json jsonb; order_json jsonb; receipt_row jsonb; result jsonb; matching bigint; changed bigint;
BEGIN
  IF NOT COALESCE(private.class_origin_exact_keys_v1(p_intent,ARRAY['contract_version','operation_id','command','fields']),false)
    OR p_intent->'contract_version' IS DISTINCT FROM '1'::jsonb OR p_intent->>'command' IS DISTINCT FROM 'create_character'
    OR NOT private.class_origin_uuid_v1(p_intent->'operation_id') OR pg_catalog.octet_length(p_intent::text)>32768
    OR NOT COALESCE(private.class_origin_exact_keys_v1(p_intent->'fields',ARRAY['name','system_id','campaign_id']),false)
    OR pg_catalog.jsonb_typeof(p_intent#>'{fields,name}') IS DISTINCT FROM 'string'
    OR pg_catalog.length(p_intent#>>'{fields,name}') NOT BETWEEN 1 AND 100
    OR p_intent#>>'{fields,name}' IS DISTINCT FROM pg_catalog.btrim(p_intent#>>'{fields,name}')
    OR NOT private.class_origin_uuid_v1(p_intent#>'{fields,system_id}')
    OR p_intent#>'{fields,campaign_id}' IS DISTINCT FROM 'null'::jsonb AND NOT private.class_origin_uuid_v1(p_intent#>'{fields,campaign_id}') THEN
    RETURN '{"status":"invalid"}'::jsonb; END IF;
  PERFORM private.require_class_origin_auth_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  SELECT creation.* INTO prior FROM private.character_creation_commands_v1 creation
    WHERE creation.verified_actor_id=actor AND creation.operation_id=(p_intent->>'operation_id')::uuid;
  IF FOUND THEN
    SELECT * INTO c FROM public.characters WHERE id=prior.target_character_id AND user_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
    SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_acceptance_v1 j
      WHERE j.target_character_id=c.id AND j.verified_actor_id=actor AND j.acceptance_kind='bootstrap_new' AND j.finalized AND j.receipt=prior.receipt;
    IF matching<>1 OR NOT COALESCE(private.class_origin_receipt_shape_v1(prior.receipt),false) THEN RAISE EXCEPTION 'original_receipt_history_unavailable' USING ERRCODE='23514'; END IF;
    SELECT * INTO completed FROM private.class_writer_acceptance_v1 j
      WHERE j.target_character_id=c.id AND j.verified_actor_id=actor AND j.acceptance_kind='bootstrap_new' AND j.finalized AND j.receipt=prior.receipt FOR SHARE;
    PERFORM t.acceptance_id FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=completed.acceptance_id ORDER BY t.relation_key,t.row_key FOR SHARE;
    IF completed.revision_transition_consumed OR completed.before_parent IS NOT NULL OR completed.before_origin IS NOT NULL
      OR completed.preinsert_proof->>'acceptance_id' IS DISTINCT FROM completed.acceptance_id::text
      OR completed.preinsert_proof->>'target_character_id' IS DISTINCT FROM c.id::text
      OR completed.preinsert_proof->>'transaction_id' IS DISTINCT FROM completed.transaction_id::text
      OR prior.receipt->>'target_character_id' IS DISTINCT FROM c.id::text OR prior.receipt->>'verified_actor_id' IS DISTINCT FROM actor::text
      OR prior.receipt->>'operation_id' IS DISTINCT FROM prior.operation_id::text
      OR pg_catalog.jsonb_array_length(completed.planned_transitions)<>2
      OR (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id)<>2
      OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id AND (NOT consumed OR before_row IS NOT NULL))
      OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id AND relation_key='creation_receipt'
        AND row_key=pg_catalog.jsonb_build_array(actor,prior.operation_id) AND after_row=pg_catalog.to_jsonb(prior))
      OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id AND relation_key='origin'
        AND row_key=pg_catalog.jsonb_build_array(c.id) AND after_row=completed.expected_graph->'origin') THEN
      RAISE EXCEPTION 'original_consumed_bootstrap_history_unavailable' USING ERRCODE='23514'; END IF;
    result:=CASE WHEN prior.receipt->'canonical_intent'=p_intent THEN pg_catalog.jsonb_build_object('status','recorded','receipt',prior.receipt) ELSE '{"status":"intent_conflict"}'::jsonb END;
    -- FIRST recovery: no current system/order/revision/NEW gate admission here.
    PERFORM private.require_class_origin_auth_v1(p_context);
    actor:=private.class_bootstrap_verified_prefix_v1(p_context);
    IF NOT EXISTS(SELECT 1 FROM public.characters WHERE id=prior.target_character_id AND user_id=actor)
      OR pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'current_owner_or_expiry_unavailable' USING ERRCODE='42501'; END IF;
    RETURN result;
  END IF;
  IF p_intent#>'{fields,campaign_id}' IS DISTINCT FROM 'null'::jsonb THEN RETURN '{"status":"unsupported"}'::jsonb; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND enabled) THEN RAISE EXCEPTION 'bootstrap_admission_unavailable' USING ERRCODE='P0001'; END IF;
  RAISE EXCEPTION 'bootstrap_admission_unavailable' USING ERRCODE='P0001';
  -- Unreachable REAL transaction body; activation requires a separately reviewed issuer.
  PERFORM private.lock_class_bootstrap_system_v1(p_context,(p_intent#>>'{fields,system_id}')::uuid);
  PERFORM private.require_class_origin_auth_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  target:=pg_catalog.gen_random_uuid(); acceptance:=pg_catalog.gen_random_uuid(); accepted:=pg_catalog.clock_timestamp();
  IF NOT pg_catalog.isfinite(accepted) OR accepted<'0001-01-01T00:00:00Z' OR accepted>='10000-01-01T00:00:00Z' THEN RAISE EXCEPTION 'finite_native_time_required' USING ERRCODE='23514'; END IF;
  c.id:=target; c.user_id:=actor; c.system_id:=(p_intent#>>'{fields,system_id}')::uuid; c.campaign_id:=NULL; c.name:=p_intent#>>'{fields,name}';
  c.visibility:='private'; c.archived:=false; c.created_at:=pg_catalog.transaction_timestamp(); c.level:=1;
  c.base_stats:='{}'; c.choices:='{}'; c.state:='{}'; c.narrative:='{}'; c.narrative_rich:='{}'; c.primary_color:=NULL; c.action_revision:=0;
  parent_json:=pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision','0');
  origin:=pg_catalog.jsonb_populate_record(NULL::private.character_class_origin_v1,pg_catalog.jsonb_build_object('character_id',target,'schema_version',1,'system_id',c.system_id,
    'origin_status','draft','origin_occurrence_id',NULL,'creation_provenance','new_character','creation_operation_id',p_intent->>'operation_id','source_draft_operation_id',NULL,'role_proof',NULL,'command_revision',0));
  origin_json:=pg_catalog.to_jsonb(origin)||pg_catalog.jsonb_build_object('command_revision','0');
  receipt:=pg_catalog.jsonb_build_object('receipt_version',1,'receipt_kind','bootstrap_new','operation_id',p_intent->>'operation_id','verified_actor_id',actor,'target_character_id',target,
    'accepted_at',pg_catalog.to_char(accepted AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'canonical_intent',p_intent,
    'initial_action_revision','0','initial_class_revision','0','initial_producer_revision','0','copy_lineage',NULL);
  IF NOT COALESCE(private.class_origin_receipt_shape_v1(receipt),false) THEN RAISE EXCEPTION 'strict_creation_receipt_required' USING ERRCODE='23514'; END IF;
  receipt_row:=pg_catalog.jsonb_build_object('verified_actor_id',actor,'operation_id',p_intent->>'operation_id','target_character_id',target,'receipt',receipt);
  order_json:=pg_catalog.jsonb_build_object('character_id',target,'producer_version',1,'producer_revision','0','pins','[]'::jsonb,'inventory','[]'::jsonb,'spells','[]'::jsonb,'feature_grants','[]'::jsonb,'spell_grants','[]'::jsonb);
  expected_graph:=pg_catalog.jsonb_build_object('parent',parent_json,'origin',origin_json,'order',order_json,'occurrences','[]'::jsonb,'refs','[]'::jsonb,
    'inventory','[]'::jsonb,'spells','[]'::jsonb,'feature_grants','[]'::jsonb,'spell_grants','[]'::jsonb,'versions','[]'::jsonb);
  transitions:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('relation_key','origin','row_key',pg_catalog.jsonb_build_array(target),'before_row',NULL,'after_row',origin_json),
    pg_catalog.jsonb_build_object('relation_key','creation_receipt','row_key',pg_catalog.jsonb_build_array(actor,p_intent->>'operation_id'),'before_row',NULL,'after_row',receipt_row));
  IF pg_catalog.octet_length(expected_graph::text)>4194304 THEN RAISE EXCEPTION 'expected_graph_budget' USING ERRCODE='23514'; END IF;
  INSERT INTO private.class_writer_acceptance_v1(acceptance_id,transaction_id,verified_actor_id,target_character_id,acceptance_kind,before_parent,before_origin,preinsert_proof,expected_graph,planned_transitions,receipt)
    VALUES(acceptance,pg_catalog.pg_current_xact_id(),actor,target,'bootstrap_new',NULL,NULL,NULL,expected_graph,transitions,receipt);
  -- Immediate original guard stamps actual preinsert absence; parent STILL absent.
  FOR transition IN SELECT value FROM pg_catalog.jsonb_array_elements(transitions) LOOP
    INSERT INTO private.class_writer_row_transitions_v1(acceptance_id,relation_key,row_key,before_row,after_row)
      VALUES(acceptance,transition->>'relation_key',transition->'row_key',NULL,transition->'after_row');
  END LOOP;
  INSERT INTO public.characters(id,user_id,system_id,campaign_id,name,visibility,archived,created_at,level,base_stats,choices,state,narrative,narrative_rich,primary_color)
    VALUES(c.id,c.user_id,c.system_id,c.campaign_id,c.name,c.visibility,c.archived,c.created_at,c.level,c.base_stats,c.choices,c.state,c.narrative,c.narrative_rich,c.primary_color) RETURNING * INTO inserted;
  IF pg_catalog.to_jsonb(inserted)||pg_catalog.jsonb_build_object('action_revision',inserted.action_revision::text) IS DISTINCT FROM parent_json THEN
    RAISE EXCEPTION 'Actual parent default/trigger readback mismatch' USING ERRCODE='23514'; END IF;
  INSERT INTO private.character_class_origin_v1(character_id,schema_version,system_id,origin_status,origin_occurrence_id,creation_provenance,creation_operation_id,source_draft_operation_id,role_proof,command_revision)
    VALUES(origin.character_id,origin.schema_version,origin.system_id,origin.origin_status,origin.origin_occurrence_id,origin.creation_provenance,origin.creation_operation_id,origin.source_draft_operation_id,origin.role_proof,origin.command_revision);
  INSERT INTO private.character_creation_commands_v1(verified_actor_id,operation_id,target_character_id,receipt) VALUES(actor,(p_intent->>'operation_id')::uuid,target,receipt);
  order_json:=private.initialize_empty_class_order_v1(acceptance);
  IF order_json IS DISTINCT FROM expected_graph->'order' OR private.class_origin_read_final_graph_v1(target,ARRAY[]::uuid[]) IS DISTINCT FROM expected_graph THEN
    RAISE EXCEPTION 'Actual initial full graph mismatch' USING ERRCODE='23514'; END IF;
  UPDATE private.class_writer_acceptance_v1 SET finalized=true WHERE acceptance_id=acceptance AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Finalization must be single use' USING ERRCODE='23514'; END IF;
  PERFORM private.class_origin_finalize_acceptance_v1(acceptance); -- Unchanged bootstrap dispatch; deferred closures stay armed.
  result:=pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
  PERFORM private.require_class_origin_auth_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  IF NOT EXISTS(SELECT 1 FROM public.characters WHERE id=target AND user_id=actor)
    OR pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'current_owner_or_expiry_unavailable' USING ERRCODE='42501'; END IF;
  RETURN result;
END $$;
ALTER FUNCTION private.create_empty_class_origin_character_v1(jsonb,jsonb) OWNER TO inkborne_class_origin_owner;

CREATE FUNCTION private.resolve_empty_class_origin_creation_v1(p_context jsonb,p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; prior private.character_creation_commands_v1%ROWTYPE; completed private.class_writer_acceptance_v1%ROWTYPE; c public.characters%ROWTYPE; result jsonb; matching bigint; BEGIN
  PERFORM private.require_class_origin_auth_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  SELECT creation.* INTO prior FROM private.character_creation_commands_v1 creation WHERE creation.verified_actor_id=actor AND creation.operation_id=p_operation;
  IF FOUND THEN
    SELECT * INTO c FROM public.characters WHERE id=prior.target_character_id AND user_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
    SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_acceptance_v1 j WHERE j.target_character_id=c.id AND j.verified_actor_id=actor AND j.acceptance_kind='bootstrap_new' AND j.finalized AND j.receipt=prior.receipt;
    IF matching<>1 OR NOT COALESCE(private.class_origin_receipt_shape_v1(prior.receipt),false) THEN RAISE EXCEPTION 'original_receipt_history_unavailable' USING ERRCODE='23514'; END IF;
    SELECT * INTO completed FROM private.class_writer_acceptance_v1 j WHERE j.target_character_id=c.id AND j.verified_actor_id=actor AND j.acceptance_kind='bootstrap_new' AND j.finalized AND j.receipt=prior.receipt FOR SHARE;
    PERFORM t.acceptance_id FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=completed.acceptance_id ORDER BY t.relation_key,t.row_key FOR SHARE;
    IF completed.revision_transition_consumed OR completed.before_parent IS NOT NULL OR completed.before_origin IS NOT NULL
      OR completed.preinsert_proof->>'acceptance_id' IS DISTINCT FROM completed.acceptance_id::text
      OR completed.preinsert_proof->>'target_character_id' IS DISTINCT FROM c.id::text
      OR completed.preinsert_proof->>'transaction_id' IS DISTINCT FROM completed.transaction_id::text
      OR prior.receipt->>'target_character_id' IS DISTINCT FROM c.id::text OR prior.receipt->>'verified_actor_id' IS DISTINCT FROM actor::text
      OR prior.receipt->>'operation_id' IS DISTINCT FROM prior.operation_id::text OR pg_catalog.jsonb_array_length(completed.planned_transitions)<>2
      OR (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id)<>2
      OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id AND (NOT consumed OR before_row IS NOT NULL))
      OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id AND relation_key='creation_receipt'
        AND row_key=pg_catalog.jsonb_build_array(actor,p_operation) AND after_row=pg_catalog.to_jsonb(prior))
      OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=completed.acceptance_id AND relation_key='origin'
        AND row_key=pg_catalog.jsonb_build_array(c.id) AND after_row=completed.expected_graph->'origin') THEN
      RAISE EXCEPTION 'original_consumed_bootstrap_history_unavailable' USING ERRCODE='23514'; END IF;
    result:=pg_catalog.jsonb_build_object('status','recorded','receipt',prior.receipt);
  ELSE result:='{"status":"absent"}'::jsonb; END IF;
  PERFORM private.require_class_origin_auth_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  IF (prior.target_character_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.characters WHERE id=prior.target_character_id AND user_id=actor))
    OR pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN
    RAISE EXCEPTION 'current_owner_or_expiry_unavailable' USING ERRCODE='42501'; END IF;
  -- Missing receipt is NOT cancellation/new-operation permission. No NEW gate/source lock.
  RETURN result;
END $$;
ALTER FUNCTION private.resolve_empty_class_origin_creation_v1(jsonb,uuid) OWNER TO inkborne_class_origin_owner;

-- 4. Narrow capability closure only after dependencies exist; ALL admission remains false.
GRANT INSERT(id,user_id,system_id,campaign_id,name,visibility,archived,created_at,level,base_stats,choices,state,narrative,narrative_rich,primary_color) ON public.characters TO inkborne_class_origin_owner;
CREATE POLICY class_bootstrap_parent_insert ON public.characters FOR INSERT TO inkborne_class_origin_owner WITH CHECK(private.class_origin_empty_parent_allowed_v1(characters));
CREATE POLICY class_bootstrap_parent_insert_guard ON public.characters AS RESTRICTIVE FOR INSERT TO inkborne_class_origin_owner WITH CHECK(private.class_origin_empty_parent_allowed_v1(characters));
GRANT INSERT(character_id,producer_version,producer_revision,pins,inventory,spells,feature_grants,spell_grants) ON private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;
CREATE POLICY class_bootstrap_order_insert ON private.character_projection_order_v1 FOR INSERT TO inkborne_hit_die_authority_owner WITH CHECK(private.class_origin_empty_order_allowed_v1(character_projection_order_v1));
CREATE POLICY class_bootstrap_order_insert_guard ON private.character_projection_order_v1 AS RESTRICTIVE FOR INSERT TO inkborne_hit_die_authority_owner WITH CHECK(private.class_origin_empty_order_allowed_v1(character_projection_order_v1));
REVOKE ALL ON FUNCTION private.class_origin_empty_parent_allowed_v1(public.characters),private.class_origin_empty_order_allowed_v1(private.character_projection_order_v1),
  private.class_origin_empty_order_inputs_v1(uuid),private.class_bootstrap_verified_prefix_v1(jsonb),private.lock_class_bootstrap_system_v1(jsonb,uuid),
  private.initialize_empty_class_order_v1(uuid),private.create_empty_class_origin_character_v1(jsonb,jsonb),private.resolve_empty_class_origin_creation_v1(jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.class_origin_empty_order_allowed_v1(private.character_projection_order_v1),private.class_origin_empty_order_inputs_v1(uuid) TO inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.class_bootstrap_verified_prefix_v1(jsonb),private.lock_class_bootstrap_system_v1(jsonb,uuid),private.initialize_empty_class_order_v1(uuid) TO inkborne_class_origin_owner;
-- No readiness/gate/Auth/base-object/role changes. Auth + independent NEW seams deny.
COMMIT;
