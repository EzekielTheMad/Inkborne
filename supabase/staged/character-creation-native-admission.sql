-- SOURCE ONLY: atomic finite creation admission overlay; install AFTER the
-- actor-prefix, original bootstrap and creation-server-bridge stages. No app
-- activation, global Auth replacement, readiness flags or deployed migration.
-- The service credential holder is trusted to invoke the same-token server
-- verifier; these DB row checks do not verify JWTs/configured session lifetime.
-- Native provider/configuration and installer acceptance are separate required
-- evidence. Legacy writer/lifecycle fencing remains an app activation blocker.
-- Direct SUPER installer must be supabase_admin (native) or postgres (offline);
-- runtime shim remains postgres-owned. No role/membership/Auth table grants or
-- installer repair is added. Runtime NONSUPER/RLS acceptance is separate.
BEGIN;
DO $originals$
DECLARE wanted record; actual record; selected_role record;
BEGIN
  IF CURRENT_USER IS DISTINCT FROM SESSION_USER OR CURRENT_USER NOT IN ('supabase_admin','postgres')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER AND rolsuper)
    OR (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND NOT enabled)
    OR pg_catalog.to_regprocedure('public.character_creation_command_v1(jsonb,jsonb)') IS NULL
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'character_creation_admission_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
  FOR selected_role IN SELECT role_name FROM pg_catalog.unnest(ARRAY['inkborne_class_origin_owner',
    'inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner']) AS roles(role_name)
  LOOP
    SELECT * INTO actual FROM pg_catalog.pg_roles WHERE rolname=selected_role.role_name;
    IF NOT FOUND OR actual.rolcanlogin OR actual.rolsuper OR actual.rolbypassrls OR actual.rolinherit
      OR actual.rolcreaterole OR actual.rolcreatedb OR actual.rolreplication
      OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=actual.oid OR roleid=actual.oid) THEN
      RAISE EXCEPTION 'character_creation_admission_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  -- The bounded row primitive and both GENERAL Auth denials are unchanged.
  IF (SELECT pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n')) FROM pg_catalog.pg_proc
      WHERE oid='private.lock_character_command_actor_rows_v1(jsonb)'::regprocedure)
        IS DISTINCT FROM '20723debd6bff48414c085efd2b984af'
    OR (SELECT pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n')) FROM pg_catalog.pg_proc
      WHERE oid='private.require_class_origin_auth_v1(jsonb)'::regprocedure)
        IS DISTINCT FROM '34837118aa95bedd7fd9a85d8b066e9d'
    OR (SELECT pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n')) FROM pg_catalog.pg_proc
      WHERE oid='private.require_verified_hit_die_auth_v1(jsonb)'::regprocedure)
        IS DISTINCT FROM '972773f897b4f6630b5d7c948a0c851c' THEN
    RAISE EXCEPTION 'character_creation_admission_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
  FOR wanted IN SELECT * FROM (VALUES
    ('private.class_origin_empty_parent_allowed_v1(public.characters)','inkborne_class_origin_owner','boolean','e05497efcea8b28638a4d38c05bafe76'),
    ('private.class_origin_empty_order_allowed_v1(private.character_projection_order_v1)','inkborne_class_origin_owner','boolean','3a0ecb290f63aa781ab647250e07751f'),
    ('private.class_origin_empty_order_inputs_v1(uuid)','inkborne_class_origin_owner','jsonb','2a483e1dce416b70b0ec749363a66c6f'),
    ('private.class_bootstrap_verified_prefix_v1(jsonb)','inkborne_hit_die_authority_owner','uuid','fdea16fdceade19fea3e7ab61bd0b59c'),
    ('private.lock_class_bootstrap_system_v1(jsonb,uuid)','inkborne_hit_die_authority_owner','jsonb','b29f394684957bd37be22f8e655bdbf4'),
    ('private.create_empty_class_origin_character_v1(jsonb,jsonb)','inkborne_class_origin_owner','jsonb','733d2f9a825df33ae9b5cdd277b23d7f'),
    ('private.resolve_empty_class_origin_creation_v1(jsonb,uuid)','inkborne_class_origin_owner','jsonb','67e836eabcc4097024c452f27824bf8e'),
    ('private.initialize_empty_class_order_v1(uuid)','inkborne_hit_die_authority_owner','jsonb','afee00eab3c411ed17885c1c3296be1a')
  ) AS dependencies(signature,owner_name,result_type,body_md5)
  LOOP
    SELECT p.*,pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
      pg_catalog.format_type(p.prorettype,NULL) AS result_type,l.lanname INTO actual
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
      WHERE p.oid=pg_catalog.to_regprocedure(wanted.signature);
    IF NOT FOUND OR actual.owner_name IS DISTINCT FROM wanted.owner_name OR NOT actual.prosecdef
      OR actual.provolatile <> 'v' OR actual.prokind <> 'f' OR actual.proretset OR actual.lanname <> 'plpgsql'
      OR actual.result_type IS DISTINCT FROM wanted.result_type
      OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n')) IS DISTINCT FROM wanted.body_md5
      OR pg_catalog.has_function_privilege('anon',actual.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',actual.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',actual.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'character_creation_admission_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  -- These are existing authority capabilities, not additional system grants.
  IF NOT pg_catalog.has_column_privilege('inkborne_hit_die_authority_owner','public.game_systems','id','UPDATE')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.game_systems'::regclass
      AND polname='hit_die_system_lock' AND polcmd='w' AND polpermissive
      AND polroles=ARRAY['inkborne_hit_die_authority_owner'::regrole::oid]
      AND pg_catalog.pg_get_expr(polqual,polrelid)='true' AND pg_catalog.pg_get_expr(polwithcheck,polrelid)='false')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.game_systems'::regclass
      AND polname='hit_die_system_no_mutation' AND polcmd='w' AND NOT polpermissive
      AND polroles=ARRAY['inkborne_hit_die_authority_owner'::regrole::oid]
      AND pg_catalog.pg_get_expr(polqual,polrelid)='true' AND pg_catalog.pg_get_expr(polwithcheck,polrelid)='false') THEN
    RAISE EXCEPTION 'character_creation_admission_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
END;
$originals$;

CREATE FUNCTION private.require_character_creation_context_v1(p_context jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- Prefix checks exact context, actual actor/session/profile, selected status,
  -- and native expiry; locks are retained by this outer transaction. No GUC,
  -- caller boolean, receipt or stored unverified calculation becomes authority.
  PERFORM private.lock_character_command_actor_rows_v1(p_context);
END $$;
ALTER FUNCTION private.require_character_creation_context_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.require_character_creation_context_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.require_character_creation_context_v1(jsonb)
  TO inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

CREATE OR REPLACE FUNCTION private.class_origin_empty_parent_allowed_v1(p_parent public.characters) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; parent_json jsonb; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  parent_json:=pg_catalog.to_jsonb(p_parent)||pg_catalog.jsonb_build_object('action_revision',p_parent.action_revision::text);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE target_character_id=p_parent.id AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized;
  RETURN FOUND AND j.acceptance_kind='bootstrap_new' AND j.before_parent IS NULL AND j.before_origin IS NULL AND NOT j.revision_transition_consumed
    AND j.preinsert_proof->>'acceptance_id'=j.acceptance_id::text AND j.preinsert_proof->>'target_character_id'=p_parent.id::text
    AND j.preinsert_proof->>'transaction_id'=j.transaction_id::text AND p_parent.user_id=j.verified_actor_id
    AND parent_json=j.expected_graph->'parent' AND p_parent.action_revision=0 AND p_parent.campaign_id IS NULL
    AND p_parent.level=1 AND p_parent.visibility='private' AND NOT p_parent.archived AND p_parent.primary_color IS NULL
    AND p_parent.base_stats='{}'::jsonb AND p_parent.choices='{}'::jsonb AND p_parent.state='{}'::jsonb
    AND p_parent.narrative='{}'::jsonb AND p_parent.narrative_rich='{}'::jsonb
    AND j.receipt->>'receipt_kind'='bootstrap_new' AND j.receipt#>>'{canonical_intent,command}'='create_character'
    AND j.receipt#>>'{canonical_intent,fields,system_id}'=p_parent.system_id::text
    AND j.receipt#>>'{canonical_intent,fields,name}'=p_parent.name
    AND j.receipt#>'{canonical_intent,fields,campaign_id}'='null'::jsonb
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['occurrences','refs','inventory','spells','feature_grants','spell_grants','versions']) AS domains(name)
      WHERE j.expected_graph->name IS DISTINCT FROM '[]'::jsonb)
    AND private.class_origin_receipt_shape_v1(j.receipt) AND j.receipt->>'verified_actor_id'=p_parent.user_id::text
    AND j.receipt->>'target_character_id'=p_parent.id::text AND pg_catalog.jsonb_array_length(j.planned_transitions)=2
    AND (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id AND NOT consumed)=2;
END $$;
ALTER FUNCTION private.class_origin_empty_parent_allowed_v1(public.characters) OWNER TO inkborne_class_origin_owner;

CREATE OR REPLACE FUNCTION private.class_origin_empty_order_allowed_v1(p_order private.character_projection_order_v1) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE target_character_id=p_order.character_id AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized;
  RETURN FOUND AND j.acceptance_kind='bootstrap_new' AND NOT j.revision_transition_consumed AND j.before_parent IS NULL AND j.before_origin IS NULL
    AND p_order.producer_version=1 AND p_order.producer_revision=0
    AND pg_catalog.to_jsonb(p_order)||pg_catalog.jsonb_build_object('producer_revision',p_order.producer_revision::text)=j.expected_graph->'order'
    AND (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id AND consumed)=2
    AND pg_catalog.jsonb_array_length(j.planned_transitions)=2;
END $$;
ALTER FUNCTION private.class_origin_empty_order_allowed_v1(private.character_projection_order_v1) OWNER TO inkborne_class_origin_owner;

CREATE OR REPLACE FUNCTION private.class_origin_empty_order_inputs_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; parent_json jsonb; origin_json jsonb; BEGIN
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

CREATE OR REPLACE FUNCTION private.class_bootstrap_verified_prefix_v1(p_context jsonb) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM private.require_character_creation_context_v1(p_context);
  IF NOT COALESCE(private.hit_die_context_shape_v1(p_context),false) THEN RAISE EXCEPTION 'invalid_context' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_character_writer_guard_v1();
  PERFORM private.require_character_creation_context_v1(p_context);
  IF pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'expired_context' USING ERRCODE='42501'; END IF;
  RETURN (p_context->>'actor_id')::uuid; -- Only after strict actual row checks; server token verification remains a precondition.
END $$;
ALTER FUNCTION private.class_bootstrap_verified_prefix_v1(jsonb) OWNER TO inkborne_hit_die_authority_owner;

CREATE OR REPLACE FUNCTION private.lock_class_bootstrap_system_v1(p_context jsonb,p_system uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE system_row public.game_systems%ROWTYPE; BEGIN
  PERFORM private.require_character_creation_context_v1(p_context);
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO system_row FROM public.game_systems WHERE id=p_system FOR SHARE;
  IF NOT FOUND OR system_row.status IS DISTINCT FROM 'published' OR system_row.slug IS DISTINCT FROM 'dnd-5e-2014' THEN
    RAISE EXCEPTION 'published_system_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.require_character_creation_context_v1(p_context);
  IF pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'expired_context' USING ERRCODE='42501'; END IF;
  RETURN pg_catalog.to_jsonb(system_row);
END $$;
ALTER FUNCTION private.lock_class_bootstrap_system_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;

CREATE OR REPLACE FUNCTION private.create_empty_class_origin_character_v1(p_context jsonb,p_intent jsonb) RETURNS jsonb
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
  PERFORM private.require_character_creation_context_v1(p_context);
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
    PERFORM private.require_character_creation_context_v1(p_context);
    actor:=private.class_bootstrap_verified_prefix_v1(p_context);
    IF NOT EXISTS(SELECT 1 FROM public.characters WHERE id=prior.target_character_id AND user_id=actor)
      OR pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'current_owner_or_expiry_unavailable' USING ERRCODE='42501'; END IF;
    RETURN result;
  END IF;
  IF p_intent#>'{fields,campaign_id}' IS DISTINCT FROM 'null'::jsonb THEN RETURN '{"status":"unsupported"}'::jsonb; END IF;
  -- Finite genuine NEW path; no caller graph, IDs, times or proof inputs.
  PERFORM private.lock_class_bootstrap_system_v1(p_context,(p_intent#>>'{fields,system_id}')::uuid);
  PERFORM private.require_character_creation_context_v1(p_context);
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
  PERFORM private.require_character_creation_context_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  IF NOT EXISTS(SELECT 1 FROM public.characters WHERE id=target AND user_id=actor)
    OR pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'current_owner_or_expiry_unavailable' USING ERRCODE='42501'; END IF;
  RETURN result;
END $$;
ALTER FUNCTION private.create_empty_class_origin_character_v1(jsonb,jsonb) OWNER TO inkborne_class_origin_owner;

CREATE OR REPLACE FUNCTION private.resolve_empty_class_origin_creation_v1(p_context jsonb,p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; prior private.character_creation_commands_v1%ROWTYPE; completed private.class_writer_acceptance_v1%ROWTYPE; c public.characters%ROWTYPE; result jsonb; matching bigint; BEGIN
  PERFORM private.require_character_creation_context_v1(p_context);
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
  PERFORM private.require_character_creation_context_v1(p_context);
  actor:=private.class_bootstrap_verified_prefix_v1(p_context);
  IF (prior.target_character_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.characters WHERE id=prior.target_character_id AND user_id=actor))
    OR pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN
    RAISE EXCEPTION 'current_owner_or_expiry_unavailable' USING ERRCODE='42501'; END IF;
  -- Missing receipt is NOT cancellation/new-operation permission. No NEW gate/source lock.
  RETURN result;
END $$;
ALTER FUNCTION private.resolve_empty_class_origin_creation_v1(jsonb,uuid) OWNER TO inkborne_class_origin_owner;

-- No new API capability: existing gateway create/resolve grants are retained.
-- The general class/hit-die Auth helpers, global gates, readiness, materializers,
-- metadata confirmation and first-acquisition machinery are unchanged.
DO $closure$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,
    LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    WHERE p.oid='private.require_character_creation_context_v1(jsonb)'::regprocedure
      AND a.privilege_type='EXECUTE' AND a.grantee NOT IN (p.proowner,
        'inkborne_class_origin_owner'::regrole::oid,'inkborne_hit_die_authority_owner'::regrole::oid))
    OR pg_catalog.has_function_privilege('inkborne_character_command_gateway_owner',
      'private.require_character_creation_context_v1(jsonb)','EXECUTE')
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'character_creation_admission_capability_unavailable' USING ERRCODE='42501';
  END IF;
END;
$closure$;
COMMIT;
