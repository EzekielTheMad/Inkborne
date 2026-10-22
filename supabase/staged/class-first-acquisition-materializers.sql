-- CANDIDATE / STAGED ONLY. Finite B2 native plan consumption, no B3 or app activation.
BEGIN;
DO $prerequisites$
DECLARE wanted record; actual record;
BEGIN
 IF CURRENT_USER IS DISTINCT FROM SESSION_USER OR CURRENT_USER NOT IN ('supabase_admin','postgres')
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER AND rolsuper) THEN
   RAISE EXCEPTION 'first_class_materializer_installer_unavailable' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT * FROM (VALUES
  ('private.active_character_spell_grant_representatives(uuid)','fdf7953649d00ed0fdaaaf54513eedf1','s','sql',true,'public.character_spell_grants'),
  ('private.character_can_access_content_version(uuid,uuid,integer)','52e552ce7b8e8294d50cefb84c44bada','s','sql',false,'boolean'),
  ('private.enforce_character_feature_grant()','09d2af9438480717ad8c49ce8408767f','v','plpgsql',false,'trigger'),
  ('private.enforce_character_spell_grant()','73bc671b4efda30f431fd197e0dccb1e','v','plpgsql',false,'trigger'),
  ('private.is_character_feature_grant_active(uuid)','bd22f85c60214156bc6ecac4deb714e7','s','sql',false,'boolean'),
  ('private.is_character_spell_grant_active(uuid)','cb043cf815d3013727e95e444adc4229','s','sql',false,'boolean'),
  ('private.materialize_feature_grants_for_ref(uuid)','b58f5a65f6b49e429a42f4c8cf22f7be','v','plpgsql',false,'void'),
  ('private.materialize_feature_grants_trigger()','e48151a39e38d45d2d0d8b363c4fdfc3','v','plpgsql',false,'trigger'),
  ('private.materialize_spell_grants_for_ref(uuid)','287777fe6679cc0aeb2ceb0cf3b22d40','v','plpgsql',false,'void'),
  ('private.materialize_spell_grants_trigger()','91a002e426a0a25184b963c91ca5832f','v','plpgsql',false,'trigger'),
  ('private.prune_inactive_feature_refs_after_choices()','b76b88108d4626d7e3a9c8cbc159c911','v','plpgsql',false,'trigger'),
  ('public.sync_character_feature_refs(uuid)','7725b4b03024943da35241aded008ee9','v','plpgsql',true,'record'),
  ('public.sync_character_spell_grants(uuid)','ff5856366195db9acc3574c2f681d779','v','plpgsql',true,'record')
 ) original(signature,body_md5,volatility,language_name,is_set,result_type) LOOP
   SELECT p.*,l.lanname INTO actual FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
     WHERE p.oid=pg_catalog.to_regprocedure(wanted.signature);
   IF NOT FOUND OR pg_catalog.pg_get_userbyid(actual.proowner)<>'postgres' OR actual.prokind<>'f'
     OR NOT actual.prosecdef OR actual.provolatile::text<>wanted.volatility OR actual.lanname<>wanted.language_name
     OR actual.proretset IS DISTINCT FROM wanted.is_set OR actual.prorettype<>pg_catalog.to_regtype(wanted.result_type)
     OR actual.proisstrict OR actual.pronargdefaults<>0 OR actual.provariadic<>0
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n'))<>wanted.body_md5 THEN
     RAISE EXCEPTION 'first_class_materializer_original_binding' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(actual.proacl,pg_catalog.acldefault('f',actual.proowner))) a
     WHERE (a.grantee<>actual.proowner AND NOT (wanted.signature LIKE 'public.sync_%' AND a.grantee IN ('authenticated'::pg_catalog.regrole::oid,'service_role'::pg_catalog.regrole::oid))
       AND NOT (wanted.signature='private.character_can_access_content_version(uuid,uuid,integer)' AND a.grantee='inkborne_class_origin_owner'::pg_catalog.regrole::oid))
       OR (a.grantee<>actual.proowner AND a.is_grantable)) THEN
     RAISE EXCEPTION 'first_class_materializer_original_acl' USING ERRCODE='42501'; END IF;
 END LOOP;
 FOR wanted IN SELECT * FROM (VALUES
  ('private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','d63ff61eb0d3472046b078ab43ac7894','postgres',true,'v','plpgsql','private.class_first_protected_plans_v1'),
  ('private.bind_first_class_plan_journal_v1()','966186205acce2cdd5873cddd6af7bf0','postgres',true,'v','plpgsql','trigger'),
  ('private.guard_first_class_plan_insert_v1()','c5e8ee3f63c4c9f0734c3f39e8033454','postgres',false,'v','plpgsql','trigger'),
  ('private.refuse_first_class_plan_mutation_v1()','b7e08cff77e78b7717ef742632c859d2','postgres',false,'v','plpgsql','trigger'),
  ('private.lock_first_class_plan_sources_v1(jsonb,jsonb,boolean)','b1b8fe32fe78698ca85681e20e5f5553','inkborne_class_origin_owner',true,'v','plpgsql','jsonb'),
  ('private.lock_character_command_actor_rows_v1(jsonb)','20723debd6bff48414c085efd2b984af','postgres',false,'v','plpgsql','timestamptz'),
  ('private.check_character_command_clock_v1(timestamp with time zone)','055cc671ff088cbea202eaa44dd4b497','postgres',false,'v','plpgsql','timestamptz'),
  ('private.require_class_origin_auth_v1(jsonb)','34837118aa95bedd7fd9a85d8b066e9d','inkborne_class_origin_owner',false,'v','plpgsql','void'),
  ('private.require_verified_hit_die_auth_v1(jsonb)','972773f897b4f6630b5d7c948a0c851c','inkborne_hit_die_authority_owner',false,'v','plpgsql','void'),
  ('private.hit_die_order_revision_rebind_v1()','fac833d4fc5d76e61c24f3fbe4c428ea','inkborne_hit_die_authority_owner',true,'v','plpgsql','trigger')
 ) dependency(signature,body_md5,owner_name,is_definer,volatility,language_name,result_type) LOOP
   SELECT p.*,l.lanname INTO actual FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
     WHERE p.oid=pg_catalog.to_regprocedure(wanted.signature);
   IF NOT FOUND OR pg_catalog.pg_get_userbyid(actual.proowner)<>wanted.owner_name OR actual.prosecdef IS DISTINCT FROM wanted.is_definer
     OR actual.prokind<>'f' OR actual.prorettype<>pg_catalog.to_regtype(wanted.result_type) OR actual.provolatile::text<>wanted.volatility OR actual.lanname<>wanted.language_name
     OR actual.proisstrict OR actual.pronargdefaults<>0 OR actual.provariadic<>0 OR actual.proretset
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n'))<>wanted.body_md5 THEN
     RAISE EXCEPTION 'first_class_materializer_dependency_binding' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='private.class_first_protected_plans_v1'::pg_catalog.regclass
     AND c.relowner='postgres'::pg_catalog.regrole::oid AND c.relrowsecurity AND c.relforcerowsecurity)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('inkborne_class_origin_owner','inkborne_hit_die_authority_owner')
     AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication))
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid IN ('inkborne_class_origin_owner'::pg_catalog.regrole::oid,'inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid)
     OR member IN ('inkborne_class_origin_owner'::pg_catalog.regrole::oid,'inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid)) THEN
   RAISE EXCEPTION 'first_class_materializer_plan_owner_unavailable' USING ERRCODE='42501'; END IF;
 IF (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1)<>13
   OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready OR protocol_version<>1)
   OR (SELECT pg_catalog.count(*) FROM private.class_origin_gate_v1)<>1
   OR NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND NOT enabled) THEN
   RAISE EXCEPTION 'first_class_materializer_requires_closed_gates' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT * FROM (VALUES
   ('public.character_content_refs','materialize_feature_grants','private.materialize_feature_grants_trigger()',21,ARRAY['content_id','content_version']::text[]),
   ('public.character_content_refs','materialize_spell_grants','private.materialize_spell_grants_trigger()',21,ARRAY['character_id','content_id','content_version']::text[]),
   ('public.character_content_refs','enforce_character_feature_grant','private.enforce_character_feature_grant()',23,ARRAY['character_id','content_id','content_version','context','choice_source','feature_grant_id']::text[]),
   ('public.character_spells','enforce_character_spell_grant','private.enforce_character_spell_grant()',23,ARRAY['character_id','content_id','content_version','name','class_slug','source','is_prepared','always_prepared','spell_grant_id']::text[]),
   ('public.characters','prune_inactive_feature_refs_after_choices','private.prune_inactive_feature_refs_after_choices()',17,ARRAY['choices']::text[]),
   ('public.characters','hit_die_order_revision_rebind','private.hit_die_order_revision_rebind_v1()',17,ARRAY[]::text[])
 ) triggers(relation_name,trigger_name,signature,event_mask,columns) LOOP
   SELECT t.*,COALESCE((SELECT pg_catalog.array_agg(a.attname::text ORDER BY a.attname) FROM pg_catalog.pg_attribute a
     WHERE a.attrelid=t.tgrelid AND a.attnum=ANY(t.tgattr::smallint[])),ARRAY[]::text[]) AS selected_columns
     INTO actual FROM pg_catalog.pg_trigger t WHERE t.tgrelid=pg_catalog.to_regclass(wanted.relation_name) AND t.tgname=wanted.trigger_name;
   IF NOT FOUND OR actual.tgfoid<>pg_catalog.to_regprocedure(wanted.signature) OR actual.tgtype<>wanted.event_mask
     OR actual.tgenabled<>'O' OR actual.tgisinternal OR actual.tgdeferrable OR actual.tgqual IS NOT NULL
     OR actual.selected_columns IS DISTINCT FROM (SELECT COALESCE(pg_catalog.array_agg(c ORDER BY c),ARRAY[]::text[]) FROM pg_catalog.unnest(wanted.columns) c) THEN
     RAISE EXCEPTION 'first_class_materializer_trigger_binding' USING ERRCODE='42501'; END IF;
 END LOOP;
 -- These pre-existing capabilities belong to the exact original/B1 owner
 -- matrix. No missing privilege, owner, policy or membership is repaired here.
 -- G2 native baseline already grants BOTH existing public sync APIs to service
 -- and authenticated. Retain those grants; their ordinary auth.uid/owner checks
 -- remain and their new protected-target branch refuses enrolled characters.
 IF NOT pg_catalog.has_function_privilege('authenticated','public.sync_character_feature_refs(uuid)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('service_role','public.sync_character_feature_refs(uuid)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('authenticated','public.sync_character_spell_grants(uuid)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('service_role','public.sync_character_spell_grants(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'first_class_materializer_original_sync_acl' USING ERRCODE='42501'; END IF;
 IF pg_catalog.has_schema_privilege('inkborne_class_origin_owner','private','CREATE')
   OR pg_catalog.has_schema_privilege('inkborne_class_origin_owner','public','CREATE') THEN
   RAISE EXCEPTION 'first_class_materializer_owner_create_denied' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT * FROM (VALUES
   ('private.character_class_origin_v1'),('private.character_class_occurrences_v1'),
   ('private.character_class_commands_v1'),('private.class_writer_acceptance_v1'),
   ('private.class_writer_row_transitions_v1'),('private.character_projection_order_v1')
 ) relations(name) LOOP
   IF NOT pg_catalog.has_table_privilege('inkborne_class_origin_owner',wanted.name,'SELECT')
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(wanted.name)
       AND c.relkind='r' AND c.relowner=CURRENT_USER::pg_catalog.regrole::oid AND c.relrowsecurity)
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=pg_catalog.to_regclass(wanted.name)
       AND p.polcmd IN ('r','*') AND p.polpermissive
       AND 'inkborne_class_origin_owner'::pg_catalog.regrole::oid=ANY(p.polroles)
       AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true')
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=pg_catalog.to_regclass(wanted.name)
       AND p.polcmd IN ('r','*') AND NOT p.polpermissive
       AND (0::oid=ANY(p.polroles) OR 'inkborne_class_origin_owner'::pg_catalog.regrole::oid=ANY(p.polroles))) THEN
     RAISE EXCEPTION 'first_class_materializer_original_read_capability' USING ERRCODE='42501'; END IF;
 END LOOP;
 FOR wanted IN SELECT * FROM (VALUES
   ('public.characters'),('public.content_versions'),('public.character_content_refs'),
   ('public.character_feature_grants'),('public.character_spell_grants'),('public.character_spells')
 ) relations(name) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(wanted.name)
     AND c.relkind='r' AND c.relowner='postgres'::pg_catalog.regrole::oid AND c.relrowsecurity) THEN
     RAISE EXCEPTION 'first_class_materializer_public_owner_unavailable' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='private.class_writer_acceptance_v1'::pg_catalog.regclass
     AND tgname='class_origin_first_plan_binding' AND tgfoid='private.bind_first_class_plan_journal_v1()'::pg_catalog.regprocedure
     AND tgtype=7 AND tgenabled='O' AND NOT tgisinternal AND NOT tgdeferrable AND tgqual IS NULL)
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='private.class_first_protected_plans_v1'::pg_catalog.regclass
     AND tgname='first_class_plan_insert' AND tgfoid='private.guard_first_class_plan_insert_v1()'::pg_catalog.regprocedure
     AND tgtype=7 AND tgenabled='O' AND NOT tgisinternal AND NOT tgdeferrable AND tgqual IS NULL)
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='private.class_first_protected_plans_v1'::pg_catalog.regclass
     AND tgname='first_class_plan_immutable' AND tgfoid='private.refuse_first_class_plan_mutation_v1()'::pg_catalog.regprocedure
     AND tgtype=27 AND tgenabled='O' AND NOT tgisinternal AND NOT tgdeferrable AND tgqual IS NULL)
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='private.class_first_protected_plans_v1'::pg_catalog.regclass
     AND tgname='first_class_plan_no_truncate' AND tgfoid='private.refuse_first_class_plan_mutation_v1()'::pg_catalog.regprocedure
     AND tgtype=34 AND tgenabled='O' AND NOT tgisinternal AND NOT tgdeferrable AND tgqual IS NULL) THEN
   RAISE EXCEPTION 'first_class_materializer_plan_binding_required' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN
   ('anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner') LOOP
   IF pg_catalog.has_function_privilege(wanted.rolname,'private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','EXECUTE')
     OR pg_catalog.has_table_privilege(wanted.rolname,'private.class_first_protected_plans_v1','INSERT')
     OR pg_catalog.has_table_privilege(wanted.rolname,'private.class_first_protected_plans_v1','SELECT') THEN
     RAISE EXCEPTION 'first_class_materializer_plan_closed_acl_required' USING ERRCODE='42501'; END IF;
 END LOOP;

END;
$prerequisites$;
-- CANDIDATE SOURCE ONLY. B2 physical inserts, not a B3 writer or save entrypoint.
-- Installed atomically after the exact B1 stage and accepted original baseline.
-- No caller/context grant, journal write, private order write or gate activation.

CREATE FUNCTION private.read_first_class_pending_journal_v1(p_target uuid,p_acceptance uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE journal private.class_writer_acceptance_v1%ROWTYPE;
  origin_row private.character_class_origin_v1%ROWTYPE;
  order_row private.character_projection_order_v1%ROWTYPE;
  parent_row public.characters%ROWTYPE; proofs jsonb; result jsonb;
BEGIN
  IF p_target IS NULL THEN RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO origin_row FROM private.character_class_origin_v1 WHERE character_id=p_target;
  IF p_acceptance IS NULL THEN RETURN pg_catalog.jsonb_build_object('enrolled',FOUND); END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO journal FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND OR journal.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
    OR journal.target_character_id IS DISTINCT FROM p_target OR journal.acceptance_kind<>'class_transition'
    OR journal.finalized OR journal.revision_transition_consumed OR journal.preinsert_proof IS NOT NULL THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO parent_row FROM public.characters WHERE id=p_target;
  IF NOT FOUND OR parent_row.user_id IS DISTINCT FROM journal.verified_actor_id THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO order_row FROM private.character_projection_order_v1 WHERE character_id=p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('relation_key',proof.relation_key,
    'row_key',proof.row_key,'before_row',proof.before_row,'after_row',proof.after_row)
    ORDER BY proof.relation_key,proof.row_key),'[]'::jsonb) INTO proofs
  FROM private.class_writer_row_transitions_v1 proof WHERE proof.acceptance_id=p_acceptance;
  IF (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=p_acceptance)<>3
    OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=p_acceptance AND consumed)
    OR proofs IS DISTINCT FROM (SELECT pg_catalog.jsonb_agg(value ORDER BY value->>'relation_key',value->'row_key')
      FROM pg_catalog.jsonb_array_elements(journal.planned_transitions))
    OR EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 WHERE character_id=p_target)
    OR EXISTS(SELECT 1 FROM private.character_class_commands_v1 WHERE character_id=p_target) THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501';
  END IF;
  result:=pg_catalog.jsonb_build_object('journal',pg_catalog.to_jsonb(journal),
    'parent',pg_catalog.to_jsonb(parent_row)||pg_catalog.jsonb_build_object('action_revision',parent_row.action_revision::text),
    'origin',pg_catalog.to_jsonb(origin_row)||pg_catalog.jsonb_build_object('command_revision',origin_row.command_revision::text),
    'order',pg_catalog.to_jsonb(order_row)||pg_catalog.jsonb_build_object('producer_revision',order_row.producer_revision::text));
  IF pg_catalog.octet_length(result::text)>12582912 THEN
    RAISE EXCEPTION 'first_class_materialization_bound' USING ERRCODE='54000'; END IF;
  RETURN result;
END;
$$;
ALTER FUNCTION private.read_first_class_pending_journal_v1(uuid,uuid) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.read_first_class_pending_journal_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.read_first_class_pending_journal_v1(uuid,uuid) TO postgres;

-- Existing postgres-owned DEFINER materializers call this INVOKER helper. Its
-- private data is the already postgres-owned immutable B1 plan, never journals.
CREATE FUNCTION private.first_class_materialization_inputs_v1(p_target uuid,p_phase text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE plan private.class_first_protected_plans_v1%ROWTYPE; state jsonb; journal jsonb;
  envelope jsonb; expected_order jsonb; selected_version jsonb; actual_version jsonb;
  expected_refs jsonb; actual_refs jsonb; expected_features jsonb; actual_features jsonb;
  expected_grants jsonb; actual_grants jsonb; actual_spells jsonb; expected_spells jsonb;
BEGIN
  IF p_phase IS NULL OR p_phase NOT IN ('grants','active','prune') THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO plan FROM private.class_first_protected_plans_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=p_target;
  IF NOT FOUND THEN
    IF private.read_first_class_pending_journal_v1(p_target,NULL)->'enrolled'='false'::jsonb THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501';
  END IF;
  IF plan.plan_kind<>'first_class_native_plan_v1' OR plan.verified_context->>'actor_id' IS DISTINCT FROM plan.verified_actor_id::text
    OR plan.verified_context->>'session_id' IS DISTINCT FROM plan.session_id::text
    OR plan.canonical_intent->>'operation_id' IS DISTINCT FROM plan.operation_id::text
    OR plan.canonical_intent->>'character_id' IS DISTINCT FROM p_target::text THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  -- Locks from genuine B1 remain held by this transaction; recheck current Auth
  -- rows/deadline without rerunning untouched-empty bootstrap/source history.
  IF private.lock_character_command_actor_rows_v1(plan.verified_context) IS DISTINCT FROM plan.jwt_expires_at THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  state:=private.read_first_class_pending_journal_v1(p_target,plan.acceptance_id);
  journal:=state->'journal'; envelope:=plan.allocation_envelope;
  IF journal->>'acceptance_id' IS DISTINCT FROM plan.acceptance_id::text
    OR journal->>'transaction_id' IS DISTINCT FROM plan.transaction_id::text
    OR journal->>'verified_actor_id' IS DISTINCT FROM plan.verified_actor_id::text
    OR journal->>'target_character_id' IS DISTINCT FROM p_target::text
    OR journal->'before_parent' IS DISTINCT FROM envelope->'before_parent'
    OR journal->'before_origin' IS DISTINCT FROM envelope->'before_origin'
    OR journal->'expected_graph' IS DISTINCT FROM envelope->'expected_graph'
    OR journal->'planned_transitions' IS DISTINCT FROM envelope->'planned_transitions'
    OR journal->'receipt' IS DISTINCT FROM envelope->'receipt'
    OR state->'origin' IS DISTINCT FROM envelope->'before_origin' THEN
    RAISE EXCEPTION 'first_class_materialization_mismatch' USING ERRCODE='23514'; END IF;
  expected_order:=envelope->'before_order';
  IF p_phase IN ('active','prune') THEN
    expected_order:=expected_order||pg_catalog.jsonb_build_object('producer_revision','1');
    IF state->'parent' IS DISTINCT FROM envelope->'expected_graph'->'parent' THEN
      RAISE EXCEPTION 'first_class_materialization_phase' USING ERRCODE='23514'; END IF;
  ELSIF state->'parent' IS DISTINCT FROM envelope->'before_parent' THEN
    RAISE EXCEPTION 'first_class_materialization_phase' USING ERRCODE='23514';
  END IF;
  IF state->'order' IS DISTINCT FROM expected_order THEN
    RAISE EXCEPTION 'first_class_materialization_phase' USING ERRCODE='23514'; END IF;
  FOR selected_version IN SELECT value FROM pg_catalog.jsonb_array_elements(envelope->'expected_graph'->'versions') LOOP
    SELECT pg_catalog.to_jsonb(version_row) INTO actual_version FROM public.content_versions version_row
      WHERE content_id=(selected_version->>'content_id')::uuid AND version=(selected_version->>'version')::integer;
    IF NOT FOUND OR actual_version IS DISTINCT FROM selected_version
      OR NOT private.character_can_access_content_version(p_target,(selected_version->>'content_id')::uuid,
        (selected_version->>'version')::integer) THEN
      RAISE EXCEPTION 'first_class_materialization_version_changed' USING ERRCODE='23514'; END IF;
  END LOOP;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual_refs
    FROM public.character_content_refs r WHERE r.character_id=p_target;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected_refs
    FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'refs');
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual_features
    FROM public.character_feature_grants r WHERE r.character_id=p_target;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected_features
    FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'feature_grants');
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual_grants
    FROM public.character_spell_grants r WHERE r.character_id=p_target;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected_grants
    FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'spell_grants');
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual_spells
    FROM public.character_spells r WHERE r.character_id=p_target;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected_spells
    FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'spells');
  IF EXISTS(SELECT 1 FROM public.character_inventory WHERE character_id=p_target)
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(actual_refs) a(value)
      WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected_refs) e(value) WHERE e.value=a.value))
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(actual_features) a(value)
      WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected_features) e(value) WHERE e.value=a.value))
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(actual_grants) a(value)
      WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected_grants) e(value) WHERE e.value=a.value)) THEN
    RAISE EXCEPTION 'first_class_materialization_rows_mismatch' USING ERRCODE='23514'; END IF;
  IF p_phase='grants' THEN
    IF actual_refs IS DISTINCT FROM pg_catalog.jsonb_build_array(envelope->'native_rows'->'refs'->0)
      OR actual_spells<>'[]'::jsonb THEN
      RAISE EXCEPTION 'first_class_materialization_phase' USING ERRCODE='23514'; END IF;
  ELSE
    IF actual_features IS DISTINCT FROM expected_features OR actual_grants IS DISTINCT FROM expected_grants
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(actual_spells) a(value)
        WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(expected_spells) e(value) WHERE e.value=a.value))
      OR (p_phase='prune' AND (actual_refs IS DISTINCT FROM pg_catalog.jsonb_build_array(envelope->'native_rows'->'refs'->0)
        OR actual_spells<>'[]'::jsonb)) THEN
      RAISE EXCEPTION 'first_class_materialization_phase' USING ERRCODE='23514'; END IF;
    IF (SELECT COALESCE(pg_catalog.jsonb_agg(r.id ORDER BY r.id),'[]')
        FROM private.active_character_spell_grant_representatives(p_target) r)
      IS DISTINCT FROM (SELECT COALESCE(pg_catalog.jsonb_agg(value->'spell_grant_id' ORDER BY (value->>'spell_grant_id')::uuid),'[]')
        FROM pg_catalog.jsonb_array_elements(expected_spells))
      OR (SELECT COALESCE(pg_catalog.jsonb_agg(r.id ORDER BY r.id),'[]') FROM public.character_feature_grants r
        WHERE r.character_id=p_target AND private.is_character_feature_grant_active(r.id))
      IS DISTINCT FROM (SELECT COALESCE(pg_catalog.jsonb_agg(value->'feature_grant_id' ORDER BY (value->>'feature_grant_id')::uuid),'[]')
        FROM pg_catalog.jsonb_array_elements(expected_refs) WHERE value->'feature_grant_id'<>'null'::jsonb) THEN
      RAISE EXCEPTION 'first_class_materialization_active_mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  PERFORM private.check_character_command_clock_v1(plan.jwt_expires_at);
  RETURN envelope;
END;
$$;

CREATE FUNCTION private.consume_first_class_grants_for_ref_v1(p_ref uuid,p_family text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE ref_row public.character_content_refs%ROWTYPE; envelope jsonb; planned jsonb;
  expected jsonb; inserted jsonb; feature_row public.character_feature_grants%ROWTYPE;
  spell_row public.character_spell_grants%ROWTYPE; actual jsonb;
BEGIN
  IF p_family IS NULL OR p_family NOT IN ('feature_grants','spell_grants') THEN
    RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO ref_row FROM public.character_content_refs WHERE id=p_ref;
  IF NOT FOUND THEN RETURN false; END IF;
  -- The row's exact native feature_grant_id determines phase, never caller data.
  envelope:=private.first_class_materialization_inputs_v1(ref_row.character_id,
    CASE WHEN ref_row.feature_grant_id IS NULL THEN 'grants' ELSE 'active' END);
  IF envelope IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'refs') selected(value)
      WHERE selected.value=pg_catalog.to_jsonb(ref_row)) THEN
    RAISE EXCEPTION 'first_class_materialization_ref_mismatch' USING ERRCODE='23514'; END IF;
  IF ref_row.feature_grant_id IS NOT NULL THEN RETURN true; END IF;
  IF pg_catalog.to_jsonb(ref_row) IS DISTINCT FROM envelope->'native_rows'->'refs'->0 THEN
    RAISE EXCEPTION 'first_class_materialization_ref_mismatch' USING ERRCODE='23514'; END IF;
  IF (p_family='feature_grants' AND (EXISTS(SELECT 1 FROM public.character_feature_grants WHERE character_id=ref_row.character_id)
      OR EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=ref_row.character_id)))
    OR (p_family='spell_grants' AND EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=ref_row.character_id)) THEN
    RAISE EXCEPTION 'first_class_materialization_already_consumed' USING ERRCODE='23514'; END IF;
  IF p_family='spell_grants' THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual
      FROM public.character_feature_grants r WHERE r.character_id=ref_row.character_id;
    SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected
      FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'feature_grants');
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'first_class_materialization_phase' USING ERRCODE='23514'; END IF;
  END IF;
  FOR planned IN SELECT value FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->p_family) LOOP
    IF p_family='feature_grants' THEN
      feature_row:=pg_catalog.jsonb_populate_record(NULL::public.character_feature_grants,planned);
      INSERT INTO public.character_feature_grants(id,character_id,controller_ref_id,controller_type,controller_slug,
        feature_slug,feature_content_id,feature_version,unlock_level,created_at)
        VALUES(feature_row.id,feature_row.character_id,feature_row.controller_ref_id,feature_row.controller_type,
          feature_row.controller_slug,feature_row.feature_slug,feature_row.feature_content_id,feature_row.feature_version,
          feature_row.unlock_level,feature_row.created_at) RETURNING pg_catalog.to_jsonb(character_feature_grants) INTO inserted;
    ELSE
      spell_row:=pg_catalog.jsonb_populate_record(NULL::public.character_spell_grants,planned);
      INSERT INTO public.character_spell_grants(id,character_id,controller_ref_id,controller_type,controller_slug,class_slug,
        spell_slug,spell_content_id,spell_version,spell_name,unlock_level,created_at)
        VALUES(spell_row.id,spell_row.character_id,spell_row.controller_ref_id,spell_row.controller_type,spell_row.controller_slug,
          spell_row.class_slug,spell_row.spell_slug,spell_row.spell_content_id,spell_row.spell_version,spell_row.spell_name,
          spell_row.unlock_level,spell_row.created_at) RETURNING pg_catalog.to_jsonb(character_spell_grants) INTO inserted;
    END IF;
    IF inserted IS DISTINCT FROM planned THEN
      RAISE EXCEPTION 'first_class_materialization_returning_mismatch' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF p_family='feature_grants' THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual
      FROM public.character_feature_grants r WHERE r.character_id=ref_row.character_id;
  ELSE
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual
      FROM public.character_spell_grants r WHERE r.character_id=ref_row.character_id;
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected
    FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->p_family);
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'first_class_materialization_rows_mismatch' USING ERRCODE='23514'; END IF;
  PERFORM private.first_class_materialization_inputs_v1(ref_row.character_id,'grants');
  RETURN true;
END;
$$;

CREATE FUNCTION private.consume_first_class_active_projections_v1(p_acceptance uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE plan private.class_first_protected_plans_v1%ROWTYPE; envelope jsonb; planned jsonb; inserted jsonb;
  ref_row public.character_content_refs%ROWTYPE; spell_row public.character_spells%ROWTYPE;
BEGIN
  SELECT * INTO plan FROM private.class_first_protected_plans_v1 WHERE acceptance_id=p_acceptance
    AND transaction_id=pg_catalog.pg_current_xact_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_materialization_unavailable' USING ERRCODE='42501'; END IF;
  envelope:=private.first_class_materialization_inputs_v1(plan.target_character_id,'active');
  IF (SELECT pg_catalog.count(*) FROM public.character_content_refs WHERE character_id=plan.target_character_id)<>1
    OR EXISTS(SELECT 1 FROM public.character_spells WHERE character_id=plan.target_character_id) THEN
    RAISE EXCEPTION 'first_class_materialization_already_consumed' USING ERRCODE='23514'; END IF;
  FOR planned IN SELECT value FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'refs') WITH ORDINALITY r(value,position)
      WHERE position>1 ORDER BY position LOOP
    ref_row:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,planned);
    INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
      VALUES(ref_row.id,ref_row.character_id,ref_row.content_id,ref_row.content_version,ref_row.context,ref_row.choice_source,
        ref_row.created_at,ref_row.feature_grant_id) RETURNING pg_catalog.to_jsonb(character_content_refs) INTO inserted;
    IF inserted IS DISTINCT FROM planned THEN
      RAISE EXCEPTION 'first_class_materialization_returning_mismatch' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOR planned IN SELECT value FROM pg_catalog.jsonb_array_elements(envelope->'native_rows'->'spells') LOOP
    spell_row:=pg_catalog.jsonb_populate_record(NULL::public.character_spells,planned);
    INSERT INTO public.character_spells(id,character_id,content_id,content_version,name,class_slug,is_known,is_prepared,
      always_prepared,in_spellbook,source,custom_data,created_at,spell_grant_id)
      VALUES(spell_row.id,spell_row.character_id,spell_row.content_id,spell_row.content_version,spell_row.name,spell_row.class_slug,
        spell_row.is_known,spell_row.is_prepared,spell_row.always_prepared,spell_row.in_spellbook,spell_row.source,
        spell_row.custom_data,spell_row.created_at,spell_row.spell_grant_id)
      RETURNING pg_catalog.to_jsonb(character_spells) INTO inserted;
    IF inserted IS DISTINCT FROM planned THEN
      RAISE EXCEPTION 'first_class_materialization_returning_mismatch' USING ERRCODE='23514'; END IF;
  END LOOP;
  -- Require complete row-family bijections, not merely no extra rows.
  IF (SELECT pg_catalog.count(*) FROM public.character_content_refs WHERE character_id=plan.target_character_id)
      <>pg_catalog.jsonb_array_length(envelope->'native_rows'->'refs')
    OR (SELECT pg_catalog.count(*) FROM public.character_spells WHERE character_id=plan.target_character_id)
      <>pg_catalog.jsonb_array_length(envelope->'native_rows'->'spells') THEN
    RAISE EXCEPTION 'first_class_materialization_rows_mismatch' USING ERRCODE='23514'; END IF;
  PERFORM private.first_class_materialization_inputs_v1(plan.target_character_id,'active');
END;
$$;


-- Overlay private.materialize_feature_grants_for_ref(uuid); frozen ordinary body MD5 b58f5a65f6b49e429a42f4c8cf22f7be.
CREATE OR REPLACE FUNCTION private.materialize_feature_grants_for_ref(
  target_ref_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  controller record;
  level_entry jsonb;
  dependency_slug text;
  dependency_level integer;
  resolved_feature record;
BEGIN
  -- Finite native route; the complete ordinary legacy body below is retained.
  IF private.consume_first_class_grants_for_ref_v1(target_ref_id,'feature_grants') THEN RETURN; END IF;
  SELECT
    ref.id AS ref_id,
    ref.character_id,
    version.content_id,
    version.version,
    version.content_type_snapshot,
    version.slug_snapshot,
    version.system_id_snapshot,
    version.source_snapshot,
    version.owner_id_snapshot,
    version.data_snapshot,
    version.created_at
  INTO controller
  FROM public.character_content_refs AS ref
  JOIN public.content_versions AS version
    ON version.content_id = ref.content_id
   AND version.version = ref.content_version
  WHERE ref.id = target_ref_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.character_feature_grants
  WHERE controller_ref_id = target_ref_id;

  IF controller.content_type_snapshot NOT IN ('class', 'subclass') THEN
    RETURN;
  END IF;

  IF jsonb_typeof(controller.data_snapshot->'levels') <> 'array' THEN
    RAISE EXCEPTION 'Pinned % % has no valid feature level manifest',
      controller.content_type_snapshot,
      controller.slug_snapshot
      USING ERRCODE = '22023';
  END IF;

  FOR level_entry IN
    SELECT value
    FROM jsonb_array_elements(controller.data_snapshot->'levels')
  LOOP
    IF jsonb_typeof(level_entry->'level') <> 'number'
      OR jsonb_typeof(level_entry->'features') <> 'array'
    THEN
      RAISE EXCEPTION 'Pinned % % has a malformed feature level manifest',
        controller.content_type_snapshot,
        controller.slug_snapshot
        USING ERRCODE = '22023';
    END IF;

    dependency_level := (level_entry->>'level')::integer;
    IF dependency_level < 1 OR dependency_level > 20 THEN
      RAISE EXCEPTION 'Pinned % % has an invalid feature unlock level',
        controller.content_type_snapshot,
        controller.slug_snapshot
        USING ERRCODE = '22023';
    END IF;

    FOR dependency_slug IN
      SELECT jsonb_array_elements_text(level_entry->'features')
    LOOP
      IF btrim(dependency_slug) = '' THEN
        RAISE EXCEPTION 'Pinned % % contains an empty feature slug',
          controller.content_type_snapshot,
          controller.slug_snapshot
          USING ERRCODE = '22023';
      END IF;

      SELECT
        candidate.content_id,
        candidate.version
      INTO resolved_feature
      FROM public.content_versions AS candidate
      WHERE candidate.system_id_snapshot = controller.system_id_snapshot
        AND candidate.content_type_snapshot = 'feature'
        AND candidate.slug_snapshot = dependency_slug
        AND candidate.created_at <= controller.created_at
        AND (
          (
            controller.source_snapshot = 'srd'
            AND candidate.scope_snapshot = 'platform'
          )
          OR (
            controller.source_snapshot = 'homebrew'
            AND (
              candidate.owner_id_snapshot = controller.owner_id_snapshot
              OR candidate.scope_snapshot = 'platform'
            )
          )
        )
        AND private.character_can_access_content_version(
          controller.character_id,
          candidate.content_id,
          candidate.version
        )
      ORDER BY
        (
          candidate.owner_id_snapshot IS NOT DISTINCT FROM
          controller.owner_id_snapshot
        ) DESC,
        candidate.created_at DESC,
        candidate.version DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Feature % cannot be resolved for pinned % % v%',
          dependency_slug,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          controller.version
          USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.character_feature_grants (
        character_id,
        controller_ref_id,
        controller_type,
        controller_slug,
        feature_slug,
        feature_content_id,
        feature_version,
        unlock_level
      ) VALUES (
        controller.character_id,
        controller.ref_id,
        controller.content_type_snapshot,
        controller.slug_snapshot,
        dependency_slug,
        resolved_feature.content_id,
        resolved_feature.version,
        dependency_level
      )
      ON CONFLICT (controller_ref_id, feature_slug)
      DO UPDATE SET
        feature_content_id = EXCLUDED.feature_content_id,
        feature_version = EXCLUDED.feature_version,
        unlock_level = LEAST(
          public.character_feature_grants.unlock_level,
          EXCLUDED.unlock_level
        );
    END LOOP;
  END LOOP;
END;
$$;
ALTER FUNCTION private.materialize_feature_grants_for_ref(uuid) OWNER TO postgres;

-- Overlay private.materialize_spell_grants_for_ref(uuid); frozen ordinary body MD5 287777fe6679cc0aeb2ceb0cf3b22d40.
CREATE OR REPLACE FUNCTION private.materialize_spell_grants_for_ref(
  target_ref_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  controller record;
  manifest_entry record;
  spell_value jsonb;
  dependency_slug text;
  dependency_level integer;
  resolved_spell record;
BEGIN
  -- Finite native route; the complete ordinary legacy body below is retained.
  IF private.consume_first_class_grants_for_ref_v1(target_ref_id,'spell_grants') THEN RETURN; END IF;
  SELECT
    ref.id AS ref_id,
    ref.character_id,
    version.content_id,
    version.version,
    version.content_type_snapshot,
    version.slug_snapshot,
    version.system_id_snapshot,
    version.source_snapshot,
    version.owner_id_snapshot,
    version.data_snapshot,
    version.created_at
  INTO controller
  FROM public.character_content_refs AS ref
  JOIN public.content_versions AS version
    ON version.content_id = ref.content_id
   AND version.version = ref.content_version
  WHERE ref.id = target_ref_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.character_spell_grants
  WHERE controller_ref_id = target_ref_id;

  IF controller.content_type_snapshot NOT IN ('class', 'subclass')
    OR controller.data_snapshot->'spellcastingExtra' IS NULL
  THEN
    RETURN;
  END IF;

  IF jsonb_typeof(controller.data_snapshot->'spellcastingExtra') <> 'array' THEN
    RAISE EXCEPTION 'Pinned % % has a malformed spell grant manifest',
      controller.content_type_snapshot,
      controller.slug_snapshot
      USING ERRCODE = '22023';
  END IF;

  IF controller.content_type_snapshot = 'subclass'
    AND btrim(COALESCE(controller.data_snapshot->>'parent_class', '')) = ''
  THEN
    RAISE EXCEPTION 'Pinned subclass % has no parent class for spell grants',
      controller.slug_snapshot
      USING ERRCODE = '22023';
  END IF;

  FOR manifest_entry IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      controller.data_snapshot->'spellcastingExtra'
    ) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(manifest_entry.value) = 'object' THEN
      IF COALESCE(manifest_entry.value->>'level', '') !~ '^[0-9]+$'
        OR jsonb_typeof(manifest_entry.value->'spells') <> 'array'
      THEN
        RAISE EXCEPTION 'Pinned % % has a malformed spell grant tier',
          controller.content_type_snapshot,
          controller.slug_snapshot
          USING ERRCODE = '22023';
      END IF;
      dependency_level := (manifest_entry.value->>'level')::integer;
      FOR spell_value IN
        SELECT value
        FROM jsonb_array_elements(manifest_entry.value->'spells')
      LOOP
        IF jsonb_typeof(spell_value) <> 'string' THEN
          RAISE EXCEPTION 'Pinned % % contains a non-text spell slug',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;
        dependency_slug := btrim(spell_value #>> '{}');

        IF dependency_level < 1 OR dependency_level > 20
          OR dependency_slug = ''
        THEN
          RAISE EXCEPTION 'Pinned % % contains an invalid spell grant',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;

        SELECT candidate.content_id, candidate.version, candidate.name_snapshot
        INTO resolved_spell
        FROM public.content_versions AS candidate
        WHERE candidate.system_id_snapshot = controller.system_id_snapshot
          AND candidate.content_type_snapshot = 'spell'
          AND candidate.slug_snapshot = dependency_slug
          AND candidate.created_at <= controller.created_at
          AND (
            (
              controller.source_snapshot = 'srd'
              AND candidate.source_snapshot = 'srd'
              AND candidate.scope_snapshot = 'platform'
            )
            OR (
              controller.source_snapshot = 'homebrew'
              AND private.character_can_access_content_version(
                controller.character_id,
                candidate.content_id,
                candidate.version
              )
            )
          )
        ORDER BY
          (
            candidate.owner_id_snapshot IS NOT DISTINCT FROM
            controller.owner_id_snapshot
          ) DESC,
          (candidate.scope_snapshot = 'platform') DESC,
          candidate.created_at DESC,
          candidate.version DESC,
          candidate.content_id
        LIMIT 1;

        IF NOT FOUND OR private.character_can_access_content_version(
          controller.character_id,
          resolved_spell.content_id,
          resolved_spell.version
        ) IS NOT TRUE THEN
          RAISE EXCEPTION 'Spell % cannot be resolved for pinned % % v%',
            dependency_slug,
            controller.content_type_snapshot,
            controller.slug_snapshot,
            controller.version
            USING ERRCODE = '23503';
        END IF;

        INSERT INTO public.character_spell_grants (
          character_id,
          controller_ref_id,
          controller_type,
          controller_slug,
          class_slug,
          spell_slug,
          spell_content_id,
          spell_version,
          spell_name,
          unlock_level
        ) VALUES (
          controller.character_id,
          controller.ref_id,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          CASE
            WHEN controller.content_type_snapshot = 'class'
              THEN controller.slug_snapshot
            ELSE controller.data_snapshot->>'parent_class'
          END,
          dependency_slug,
          resolved_spell.content_id,
          resolved_spell.version,
          resolved_spell.name_snapshot,
          dependency_level
        )
        ON CONFLICT (controller_ref_id, spell_slug)
        DO UPDATE SET
          spell_content_id = EXCLUDED.spell_content_id,
          spell_version = EXCLUDED.spell_version,
          spell_name = EXCLUDED.spell_name,
          unlock_level = LEAST(
            public.character_spell_grants.unlock_level,
            EXCLUDED.unlock_level
          );
      END LOOP;
    ELSIF jsonb_typeof(manifest_entry.value) = 'array' THEN
      dependency_level := manifest_entry.ordinality::integer;
      FOR spell_value IN
        SELECT value FROM jsonb_array_elements(manifest_entry.value)
      LOOP
        IF jsonb_typeof(spell_value) <> 'string' THEN
          RAISE EXCEPTION 'Pinned % % contains a non-text spell slug',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;
        dependency_slug := btrim(spell_value #>> '{}');

        IF dependency_slug = '' THEN
          RAISE EXCEPTION 'Pinned % % contains an empty spell slug',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;

        SELECT candidate.content_id, candidate.version, candidate.name_snapshot
        INTO resolved_spell
        FROM public.content_versions AS candidate
        WHERE candidate.system_id_snapshot = controller.system_id_snapshot
          AND candidate.content_type_snapshot = 'spell'
          AND candidate.slug_snapshot = dependency_slug
          AND candidate.created_at <= controller.created_at
          AND (
            (
              controller.source_snapshot = 'srd'
              AND candidate.source_snapshot = 'srd'
              AND candidate.scope_snapshot = 'platform'
            )
            OR (
              controller.source_snapshot = 'homebrew'
              AND private.character_can_access_content_version(
                controller.character_id,
                candidate.content_id,
                candidate.version
              )
            )
          )
        ORDER BY
          (
            candidate.owner_id_snapshot IS NOT DISTINCT FROM
            controller.owner_id_snapshot
          ) DESC,
          (candidate.scope_snapshot = 'platform') DESC,
          candidate.created_at DESC,
          candidate.version DESC,
          candidate.content_id
        LIMIT 1;

        IF NOT FOUND OR private.character_can_access_content_version(
          controller.character_id,
          resolved_spell.content_id,
          resolved_spell.version
        ) IS NOT TRUE THEN
          RAISE EXCEPTION 'Spell % cannot be resolved for pinned % % v%',
            dependency_slug,
            controller.content_type_snapshot,
            controller.slug_snapshot,
            controller.version
            USING ERRCODE = '23503';
        END IF;

        INSERT INTO public.character_spell_grants (
          character_id, controller_ref_id, controller_type, controller_slug,
          class_slug, spell_slug, spell_content_id, spell_version, spell_name,
          unlock_level
        ) VALUES (
          controller.character_id,
          controller.ref_id,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          CASE
            WHEN controller.content_type_snapshot = 'class'
              THEN controller.slug_snapshot
            ELSE controller.data_snapshot->>'parent_class'
          END,
          dependency_slug,
          resolved_spell.content_id,
          resolved_spell.version,
          resolved_spell.name_snapshot,
          dependency_level
        )
        ON CONFLICT (controller_ref_id, spell_slug)
        DO UPDATE SET
          spell_content_id = EXCLUDED.spell_content_id,
          spell_version = EXCLUDED.spell_version,
          spell_name = EXCLUDED.spell_name,
          unlock_level = LEAST(
            public.character_spell_grants.unlock_level,
            EXCLUDED.unlock_level
          );
      END LOOP;
    ELSIF jsonb_typeof(manifest_entry.value) = 'string' THEN
      dependency_level := manifest_entry.ordinality::integer;
      dependency_slug := btrim(manifest_entry.value #>> '{}');

      IF dependency_slug = '' THEN
        RAISE EXCEPTION 'Pinned % % contains an empty spell slug',
          controller.content_type_snapshot,
          controller.slug_snapshot
          USING ERRCODE = '22023';
      END IF;

      SELECT candidate.content_id, candidate.version, candidate.name_snapshot
      INTO resolved_spell
      FROM public.content_versions AS candidate
      WHERE candidate.system_id_snapshot = controller.system_id_snapshot
        AND candidate.content_type_snapshot = 'spell'
        AND candidate.slug_snapshot = dependency_slug
        AND candidate.created_at <= controller.created_at
        AND (
          (
            controller.source_snapshot = 'srd'
            AND candidate.source_snapshot = 'srd'
            AND candidate.scope_snapshot = 'platform'
          )
          OR (
            controller.source_snapshot = 'homebrew'
            AND private.character_can_access_content_version(
              controller.character_id,
              candidate.content_id,
              candidate.version
            )
          )
        )
      ORDER BY
        (
          candidate.owner_id_snapshot IS NOT DISTINCT FROM
          controller.owner_id_snapshot
        ) DESC,
        (candidate.scope_snapshot = 'platform') DESC,
        candidate.created_at DESC,
        candidate.version DESC,
        candidate.content_id
      LIMIT 1;

      IF NOT FOUND OR private.character_can_access_content_version(
        controller.character_id,
        resolved_spell.content_id,
        resolved_spell.version
      ) IS NOT TRUE THEN
        RAISE EXCEPTION 'Spell % cannot be resolved for pinned % % v%',
          dependency_slug,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          controller.version
          USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.character_spell_grants (
        character_id, controller_ref_id, controller_type, controller_slug,
        class_slug, spell_slug, spell_content_id, spell_version, spell_name,
        unlock_level
      ) VALUES (
        controller.character_id,
        controller.ref_id,
        controller.content_type_snapshot,
        controller.slug_snapshot,
        CASE
          WHEN controller.content_type_snapshot = 'class'
            THEN controller.slug_snapshot
          ELSE controller.data_snapshot->>'parent_class'
        END,
        dependency_slug,
        resolved_spell.content_id,
        resolved_spell.version,
        resolved_spell.name_snapshot,
        dependency_level
      )
      ON CONFLICT (controller_ref_id, spell_slug)
      DO UPDATE SET
        spell_content_id = EXCLUDED.spell_content_id,
        spell_version = EXCLUDED.spell_version,
        spell_name = EXCLUDED.spell_name,
        unlock_level = LEAST(
          public.character_spell_grants.unlock_level,
          EXCLUDED.unlock_level
        );
    ELSE
      RAISE EXCEPTION 'Pinned % % has a malformed spell grant entry',
        controller.content_type_snapshot,
        controller.slug_snapshot
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION private.materialize_spell_grants_for_ref(uuid) OWNER TO postgres;

-- Overlay private.prune_inactive_feature_refs_after_choices(); frozen ordinary body MD5 b76b88108d4626d7e3a9c8cbc159c911.
CREATE OR REPLACE FUNCTION private.prune_inactive_feature_refs_after_choices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Actual choices have changed; R09's earlier AFTER trigger rebinds revision.
  -- The finite first-class route requires no derived/ASI refs yet to prune.
  IF private.first_class_materialization_inputs_v1(NEW.id,'prune') IS NOT NULL THEN RETURN NEW; END IF;
  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = NEW.id
    AND ref.feature_grant_id IS NOT NULL
    AND private.is_character_feature_grant_active(ref.feature_grant_id)
      IS NOT TRUE;

  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = NEW.id
    AND ref.feature_grant_id IS NULL
    AND ref.choice_source LIKE 'choice:asi:%'
    AND NOT EXISTS (
      SELECT 1
      FROM public.character_feature_grants AS grant_row
      JOIN public.content_versions AS feature
        ON feature.content_id = grant_row.feature_content_id
       AND feature.version = grant_row.feature_version
      WHERE ref.choice_source = 'choice:asi:' || grant_row.id::text
        AND grant_row.character_id = NEW.id
        AND feature.data_snapshot->>'feature_type' = 'asi'
        AND NEW.choices->'asi_choices' ? grant_row.feature_slug
        AND private.is_character_feature_grant_active(grant_row.id)
    );

  RETURN NEW;
END;
$$;
ALTER FUNCTION private.prune_inactive_feature_refs_after_choices() OWNER TO postgres;

-- Overlay public.sync_character_feature_refs(uuid); frozen ordinary body MD5 7725b4b03024943da35241aded008ee9.
CREATE OR REPLACE FUNCTION public.sync_character_feature_refs(
  target_character_id uuid
)
RETURNS TABLE(inserted integer, deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  inserted_count integer := 0;
  deleted_count integer := 0;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  -- Old public reconciliation cannot mutate an enrolled protected character.
  IF private.read_first_class_pending_journal_v1(target_character_id,NULL)->'enrolled' IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'protected_character_requires_native_plan' USING ERRCODE='42501'; END IF;

  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = target_character_id
    AND ref.feature_grant_id IS NOT NULL
    AND private.is_character_feature_grant_active(ref.feature_grant_id)
      IS NOT TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  INSERT INTO public.character_content_refs (
    character_id,
    content_id,
    content_version,
    context,
    choice_source,
    feature_grant_id
  )
  SELECT
    grant_row.character_id,
    grant_row.feature_content_id,
    grant_row.feature_version,
    jsonb_build_object(
      'source', 'class_feature',
      'controller_type', grant_row.controller_type,
      'controller_slug', grant_row.controller_slug,
      'feature_slug', grant_row.feature_slug,
      'feature_level', grant_row.unlock_level
    ),
    'auto:feature-grant:' || grant_row.id::text,
    grant_row.id
  FROM public.character_feature_grants AS grant_row
  WHERE grant_row.character_id = target_character_id
    AND private.is_character_feature_grant_active(grant_row.id)
    AND private.character_can_access_content_version(
      target_character_id,
      grant_row.feature_content_id,
      grant_row.feature_version
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.character_content_refs AS existing
      WHERE existing.feature_grant_id = grant_row.id
    )
  ON CONFLICT (feature_grant_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN QUERY SELECT inserted_count, deleted_count;
END;
$$;
ALTER FUNCTION public.sync_character_feature_refs(uuid) OWNER TO postgres;

-- Overlay public.sync_character_spell_grants(uuid); frozen ordinary body MD5 ff5856366195db9acc3574c2f681d779.
CREATE OR REPLACE FUNCTION public.sync_character_spell_grants(
  target_character_id uuid
)
RETURNS TABLE(inserted integer, deleted integer, active_grants jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  inserted_count integer := 0;
  deleted_count integer := 0;
  active_grants_payload jsonb := '[]'::jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  -- Stabilize the choices snapshot across delete, insert, and overlay payload.
  PERFORM 1
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  -- Old public reconciliation cannot mutate an enrolled protected character.
  IF private.read_first_class_pending_journal_v1(target_character_id,NULL)->'enrolled' IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'protected_character_requires_native_plan' USING ERRCODE='42501'; END IF;

  DELETE FROM public.character_spells AS spell
  WHERE spell.character_id = target_character_id
    AND spell.source = 'feature'
    AND (
      spell.spell_grant_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM private.active_character_spell_grant_representatives(
          target_character_id
        ) AS active_grant
        WHERE active_grant.id = spell.spell_grant_id
      )
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  INSERT INTO public.character_spells (
    character_id,
    content_id,
    content_version,
    name,
    class_slug,
    is_prepared,
    always_prepared,
    source,
    spell_grant_id
  )
  SELECT
    grant_row.character_id,
    grant_row.spell_content_id,
    grant_row.spell_version,
    grant_row.spell_name,
    grant_row.class_slug,
    true,
    true,
    'feature',
    grant_row.id
  FROM private.active_character_spell_grant_representatives(
    target_character_id
  ) AS grant_row
  WHERE NOT EXISTS (
      SELECT 1
      FROM public.character_spells AS existing
      WHERE existing.character_id = target_character_id
        AND existing.content_id = grant_row.spell_content_id
        AND existing.class_slug = grant_row.class_slug
    )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'content_id', active_grant.spell_content_id,
        'content_version', active_grant.spell_version,
        'class_slug', active_grant.class_slug
      )
      ORDER BY active_grant.spell_content_id, active_grant.class_slug
    ),
    '[]'::jsonb
  )
  INTO active_grants_payload
  FROM private.active_character_spell_grant_representatives(
    target_character_id
  ) AS active_grant;

  RETURN QUERY
  SELECT inserted_count, deleted_count, active_grants_payload;
END;
$$;
ALTER FUNCTION public.sync_character_spell_grants(uuid) OWNER TO postgres;
ALTER FUNCTION private.first_class_materialization_inputs_v1(uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.first_class_materialization_inputs_v1(uuid,text) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
ALTER FUNCTION private.consume_first_class_grants_for_ref_v1(uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.consume_first_class_grants_for_ref_v1(uuid,text) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
ALTER FUNCTION private.consume_first_class_active_projections_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.consume_first_class_active_projections_v1(uuid) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
DO $closed_acl$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
   WHERE p.oid IN ('private.first_class_materialization_inputs_v1(uuid,text)'::pg_catalog.regprocedure,'private.consume_first_class_grants_for_ref_v1(uuid,text)'::pg_catalog.regprocedure,'private.consume_first_class_active_projections_v1(uuid)'::pg_catalog.regprocedure) AND a.grantee<>p.proowner)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
   WHERE p.oid='private.read_first_class_pending_journal_v1(uuid,uuid)'::pg_catalog.regprocedure
     AND (a.grantee NOT IN (p.proowner,'postgres'::pg_catalog.regrole::oid) OR (a.grantee<>p.proowner AND a.is_grantable))) THEN
   RAISE EXCEPTION 'first_class_materializer_unexpected_default_acl' USING ERRCODE='42501'; END IF;
END; $closed_acl$;
COMMIT;
