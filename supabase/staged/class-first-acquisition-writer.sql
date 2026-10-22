-- CANDIDATE / STAGED ONLY. Complete first-add-class transaction, no app activation.
-- Requires COMPLETE first-acquisition prerequisites BEFORE B1, then B2.
BEGIN;
DO $prerequisites$
DECLARE wanted record; actual record; role_name text;
BEGIN
 IF CURRENT_USER IS DISTINCT FROM SESSION_USER OR CURRENT_USER NOT IN ('postgres','supabase_admin')
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER AND rolsuper) THEN
   RAISE EXCEPTION 'first_class_writer_installer_unavailable' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT * FROM (VALUES
 ('private.class_first_acquisition_inputs_v1(uuid)','inkborne_class_origin_owner','14fbcca5abefa1b2fb63f2a1876e50cf',true,'plpgsql','jsonb','v'),
 ('private.class_first_acquisition_observed_v1(uuid)','inkborne_class_origin_owner','82fdfeeaa34ff9c366f7148d401a9245',true,'plpgsql','jsonb','v'),
 ('private.assert_first_class_choices_revision_v1(uuid)','inkborne_class_origin_owner','2b0603c0ef75caf33eaee675ce79a710',true,'plpgsql','void','v'),
 ('private.consume_first_class_choices_revision_v1(uuid)','inkborne_class_origin_owner','ac5ae1ce1fee3945de7843f523884f14',true,'plpgsql','void','v'),
 ('private.class_first_acquisition_proof_closure_v1()','inkborne_class_origin_owner','9d72e5160c234ffbf5f0a7ffd2e2b683',true,'plpgsql','trigger','v'),
 ('private.class_origin_acceptance_guard_v1()','inkborne_class_origin_owner','bc20794c94950dd69e4b402505299039',true,'plpgsql','trigger','v'),
 ('private.class_origin_finalize_transition_v1(uuid)','inkborne_class_origin_owner','6c97fe04a1dbcf24deca9b922f15e426',false,'plpgsql','void','v'),
 ('private.observe_first_class_choices_revision_v1(jsonb,uuid)','inkborne_hit_die_authority_owner','4d62aac51361b92a884f9568d624f9a3',true,'plpgsql','jsonb','v'),
 ('private.class_first_acquisition_proof_guard_v1()','inkborne_hit_die_authority_owner','481e8b2f54aa40a6308adf41c0e9ea81',true,'plpgsql','trigger','v'),
 ('private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','postgres','d63ff61eb0d3472046b078ab43ac7894',true,'plpgsql','private.class_first_protected_plans_v1','v'),
 ('private.guard_first_class_plan_insert_v1()','postgres','c5e8ee3f63c4c9f0734c3f39e8033454',false,'plpgsql','trigger','v'),
 ('private.refuse_first_class_plan_mutation_v1()','postgres','b7e08cff77e78b7717ef742632c859d2',false,'plpgsql','trigger','v'),
 ('private.bind_first_class_plan_journal_v1()','postgres','966186205acce2cdd5873cddd6af7bf0',true,'plpgsql','trigger','v'),
 ('private.first_class_materialization_inputs_v1(uuid,text)','postgres','aefca16532137e976c03f5262164864e',false,'plpgsql','jsonb','v'),
 ('private.consume_first_class_grants_for_ref_v1(uuid,text)','postgres','b81a8ee839bd9255e9a0fdb221da5d01',false,'plpgsql','boolean','v'),
 ('private.consume_first_class_active_projections_v1(uuid)','postgres','f284d9c4bd7a5e6322947fe84498c44b',false,'plpgsql','void','v'),
 ('private.materialize_feature_grants_for_ref(uuid)','postgres','055ac79e49f2b3538f88e970f14d278c',true,'plpgsql','void','v'),
 ('private.materialize_spell_grants_for_ref(uuid)','postgres','d56f97321309287c664f7ff712f34524',true,'plpgsql','void','v'),
 ('private.prune_inactive_feature_refs_after_choices()','postgres','ec8ab1ba6cdcafd74d9ac1ca593e58be',true,'plpgsql','trigger','v'),
 ('private.read_first_class_pending_journal_v1(uuid,uuid)','inkborne_class_origin_owner','580b0984882a444558cc76101ed017aa',true,'plpgsql','jsonb','v'),
 ('private.require_character_creation_context_v1(jsonb)','postgres','76225c195e8053a65648dc452141c230',true,'plpgsql','void','v'),
 ('private.lock_character_command_actor_rows_gateway_v1(jsonb)','postgres','ae9ec17d64985d4d550a20f3abcfe4c6',true,'plpgsql','timestamptz','v'),
 ('private.lock_character_command_actor_rows_v1(jsonb)','postgres','20723debd6bff48414c085efd2b984af',false,'plpgsql','timestamptz','v'),
 ('private.check_character_command_clock_v1(timestamptz)','postgres','055cc671ff088cbea202eaa44dd4b497',false,'plpgsql','timestamptz','v'),
 ('private.begin_class_origin_acceptance_v1(jsonb,jsonb)','inkborne_class_origin_owner','1629ffd5f629b202cec24cf4ee1b617c',true,'plpgsql','jsonb','v'),
 ('private.require_class_origin_auth_v1(jsonb)','inkborne_class_origin_owner','34837118aa95bedd7fd9a85d8b066e9d',false,'plpgsql','void','v'),
 ('private.class_origin_row_transition_guard_v1()','inkborne_class_origin_owner','98948e6536641b7d8df05b991e824503',true,'plpgsql','trigger','v'),
 ('private.class_origin_protected_row_guard_v1()','inkborne_class_origin_owner','632bd1c54c3ce2d0a9fb0662ae6b34f1',true,'plpgsql','trigger','v'),
 ('private.class_origin_immutable_v1()','inkborne_class_origin_owner','5909a75f2762f4e153b5ce5cc95c2115',false,'plpgsql','trigger','v'),
 ('private.class_origin_finalize_acceptance_v1(uuid)','inkborne_class_origin_owner','b6a63f555d25eb7b375702310b95126c',true,'plpgsql','void','v'),
 ('private.class_origin_deferred_finalizer_v1()','inkborne_class_origin_owner','48058f01ba8e27be3794a627c4655e2f',true,'plpgsql','trigger','v'),
 ('private.class_origin_read_final_graph_v1(uuid,uuid[])','inkborne_class_origin_owner','3e860cbfbeacc9594d1dbcb7ec2d28ec',false,'plpgsql','jsonb','v'),
 ('private.class_origin_assert_common_v1(uuid)','inkborne_class_origin_owner','bc903e21c8921db490a1ccc1be64e52c',false,'plpgsql','jsonb','v'),
 ('private.require_verified_hit_die_auth_v1(jsonb)','inkborne_hit_die_authority_owner','972773f897b4f6630b5d7c948a0c851c',false,'plpgsql','void','v'),
 ('private.hit_die_order_revision_rebind_v1()','inkborne_hit_die_authority_owner','fac833d4fc5d76e61c24f3fbe4c428ea',true,'plpgsql','trigger','v'),
 ('private.hit_die_character_revision_v1()','inkborne_hit_die_authority_owner','337273b12b34e058c3563116cb134580',true,'plpgsql','trigger','v'),
 ('private.prune_inactive_asi_choices_before_choices()','postgres','158a19ce77847a1c30e4e09dd6f81346',true,'plpgsql','trigger','v')
 ) deps(signature,owner_name,body_md5,is_definer,language_name,result_type,volatility) LOOP
  SELECT p.*,l.lanname INTO actual FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang
   WHERE p.oid=pg_catalog.to_regprocedure(wanted.signature);
  IF NOT FOUND OR pg_catalog.pg_get_userbyid(actual.proowner)<>wanted.owner_name OR actual.prosecdef IS DISTINCT FROM wanted.is_definer
    OR actual.prorettype<>pg_catalog.to_regtype(wanted.result_type) OR actual.proretset OR actual.prokind<>'f' OR actual.lanname<>wanted.language_name
    OR actual.provolatile::text<>wanted.volatility OR actual.proisstrict OR actual.pronargdefaults<>0 OR actual.provariadic<>0
    OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n'))<>wanted.body_md5 THEN
    RAISE EXCEPTION 'first_class_writer_dependency_binding' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass('private.class_first_acquisition_proofs_v1')
   AND c.relowner=CURRENT_USER::pg_catalog.regrole::oid AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='private.class_first_protected_plans_v1'::pg_catalog.regclass
     AND c.relowner='postgres'::pg_catalog.regrole::oid AND c.relrowsecurity AND c.relforcerowsecurity) THEN
   RAISE EXCEPTION 'complete_first_class_prerequisite_required' USING ERRCODE='42501'; END IF;
 FOR role_name IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN
   ('inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner') LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name AND
       (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=role_name::pg_catalog.regrole::oid OR member=role_name::pg_catalog.regrole::oid)
     OR pg_catalog.has_schema_privilege(role_name,'private','CREATE') OR pg_catalog.has_schema_privilege(role_name,'public','CREATE') THEN
     RAISE EXCEPTION 'first_class_writer_isolated_owners_required' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles WHERE rolname IN
   ('inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner'))<>3
   OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
   RAISE EXCEPTION 'first_class_writer_private_api_denied' USING ERRCODE='42501'; END IF;
 FOR role_name IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN
   ('anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner') LOOP
   IF pg_catalog.has_function_privilege(role_name,'private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','EXECUTE')
     OR pg_catalog.has_table_privilege(role_name,'private.class_first_protected_plans_v1','SELECT')
     OR pg_catalog.has_table_privilege(role_name,'private.class_first_protected_plans_v1','INSERT') THEN
     RAISE EXCEPTION 'first_class_writer_no_delegated_mint_required' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN
   ('anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner')
   AND (pg_catalog.has_any_column_privilege(r.oid,'private.class_first_protected_plans_v1','SELECT,INSERT,UPDATE,REFERENCES')
     OR pg_catalog.has_table_privilege(r.oid,'private.class_first_protected_plans_v1','DELETE,TRUNCATE,TRIGGER,MAINTAIN'))) THEN
   RAISE EXCEPTION 'first_class_writer_no_delegated_plan_columns' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','private','auth') AND c.relkind IN ('r','p','v','m','f')
     AND (pg_catalog.has_table_privilege('inkborne_character_command_gateway_owner',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR pg_catalog.has_any_column_privilege('inkborne_character_command_gateway_owner',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN
   RAISE EXCEPTION 'first_class_writer_gateway_must_be_table_free' USING ERRCODE='42501'; END IF;
 IF (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1)<>13
   OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready OR protocol_version<>1)
   OR (SELECT pg_catalog.count(*) FROM private.class_origin_gate_v1)<>1
   OR NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND NOT enabled) THEN
   RAISE EXCEPTION 'first_class_writer_requires_closed_global_gates' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT * FROM (VALUES
   ('class_first_acquisition_proof_guard',31,false,false,'private.class_first_acquisition_proof_guard_v1()'),
   ('class_first_acquisition_proof_closure',21,true,true,'private.class_first_acquisition_proof_closure_v1()')
 ) expected(name,event_mask,is_deferred,initial_deferred,signature) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass
     AND t.tgname=wanted.name AND t.tgtype=wanted.event_mask AND t.tgenabled='O' AND NOT t.tgisinternal
     AND t.tgdeferrable=wanted.is_deferred AND t.tginitdeferred=wanted.initial_deferred
     AND t.tgfoid=pg_catalog.to_regprocedure(wanted.signature) AND t.tgqual IS NULL) THEN
     RAISE EXCEPTION 'complete_first_class_proof_wiring_required' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_trigger WHERE tgrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass
   AND NOT tgisinternal)<>2 OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE
     tgrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND NOT tgisinternal
     AND (tgnargs<>0 OR tgattr::text<>'' OR tgqual IS NOT NULL OR pg_catalog.octet_length(tgargs)<>0)) THEN
   RAISE EXCEPTION 'first_class_proof_extra_trigger_drift' USING ERRCODE='42501'; END IF;
 IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_policy WHERE polrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass)<>6 THEN
   RAISE EXCEPTION 'first_class_proof_policy_drift' USING ERRCODE='42501'; END IF;
 FOR wanted IN SELECT * FROM (VALUES
   ('class_first_proof_insert','a',true),('class_first_proof_insert_denied','a',false),
   ('class_first_proof_update','w',true),('class_first_proof_update_denied','w',false)
 ) expected(name,command,is_permissive) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass
     AND p.polname=wanted.name AND p.polcmd::text=wanted.command AND p.polpermissive=wanted.is_permissive
     AND p.polroles=ARRAY['inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid]
     AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)='false') THEN
     RAISE EXCEPTION 'first_class_proof_initial_denial_required' USING ERRCODE='42501'; END IF;
 END LOOP;
 FOR wanted IN SELECT * FROM (VALUES
   ('class_first_proof_authority_read','inkborne_hit_die_authority_owner'),('class_first_proof_class_read','inkborne_class_origin_owner')
 ) expected(name,owner_name) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass
     AND p.polname=wanted.name AND p.polcmd='r' AND p.polpermissive AND p.polroles=ARRAY[wanted.owner_name::pg_catalog.regrole::oid]
     AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true' AND p.polwithcheck IS NULL) THEN
     RAISE EXCEPTION 'first_class_proof_read_policy_drift' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
   WHERE c.oid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND a.grantee<>c.relowner
     AND NOT (a.grantee='inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid AND a.privilege_type IN ('SELECT','INSERT') AND NOT a.is_grantable)
     AND NOT (a.grantee='inkborne_class_origin_owner'::pg_catalog.regrole::oid AND a.privilege_type='SELECT' AND NOT a.is_grantable))
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute col JOIN pg_catalog.pg_class c ON c.oid=col.attrelid,
     LATERAL pg_catalog.aclexplode(col.attacl) a
     WHERE c.oid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND a.grantee<>c.relowner
       AND NOT (a.grantee='inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid
         AND col.attname IN ('phase','observed_parent','observed_order') AND a.privilege_type='UPDATE' AND NOT a.is_grantable)) THEN
   RAISE EXCEPTION 'first_class_proof_acl_drift' USING ERRCODE='42501'; END IF;
 IF NOT pg_catalog.has_table_privilege('inkborne_hit_die_authority_owner','private.class_first_acquisition_proofs_v1','SELECT')
   OR NOT pg_catalog.has_table_privilege('inkborne_hit_die_authority_owner','private.class_first_acquisition_proofs_v1','INSERT')
   OR NOT pg_catalog.has_column_privilege('inkborne_hit_die_authority_owner','private.class_first_acquisition_proofs_v1','phase','UPDATE')
   OR NOT pg_catalog.has_column_privilege('inkborne_hit_die_authority_owner','private.class_first_acquisition_proofs_v1','observed_parent','UPDATE')
   OR NOT pg_catalog.has_column_privilege('inkborne_hit_die_authority_owner','private.class_first_acquisition_proofs_v1','observed_order','UPDATE')
   OR NOT pg_catalog.has_table_privilege('inkborne_class_origin_owner','private.class_first_acquisition_proofs_v1','SELECT')
   OR NOT pg_catalog.has_function_privilege('inkborne_class_origin_owner','private.observe_first_class_choices_revision_v1(jsonb,uuid)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('inkborne_hit_die_authority_owner','private.class_first_acquisition_inputs_v1(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'complete_first_class_capabilities_required' USING ERRCODE='42501'; END IF;

 -- The first-class ASI no-op depends on the existing R09 BEFORE assignment
 -- and existing AFTER order/pruning callbacks. Revalidate only the same seven
 -- original parent triggers; no trigger, role, grant or application row changes.
 DECLARE parent_triggers jsonb;
 BEGIN
  SELECT pg_catalog.jsonb_object_agg(t.tgname,pg_catalog.jsonb_build_array(
    t.tgtype,t.tgenabled,t.tgfoid::pg_catalog.regprocedure::text,
    t.tgdeferrable,t.tginitdeferred,t.tgnargs,pg_catalog.encode(t.tgargs,'hex'),
    COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY c.position)
      FROM pg_catalog.unnest(t.tgattr::smallint[]) WITH ORDINALITY c(attnum,position)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=c.attnum
      AND NOT a.attisdropped),'[]'::jsonb),
    COALESCE(pg_catalog.pg_get_expr(t.tgqual,t.tgrelid),''))) INTO parent_triggers
   FROM pg_catalog.pg_trigger t
   WHERE t.tgrelid='public.characters'::pg_catalog.regclass AND NOT t.tgisinternal;
  IF parent_triggers IS DISTINCT FROM '{
    "validate_character_content_boundaries":[17,"O","private.validate_character_content_boundaries()",false,false,0,"",["campaign_id","system_id"],""],
    "prune_inactive_feature_refs_after_choices":[17,"O","private.prune_inactive_feature_refs_after_choices()",false,false,0,"",["choices"],""],
    "prune_inactive_asi_choices_before_choices":[19,"O","private.prune_inactive_asi_choices_before_choices()",false,false,0,"",["choices"],""],
    "enforce_asi_choice_map_boundary":[19,"O","private.enforce_asi_choice_map_boundary()",false,false,0,"",["choices"],""],
    "enforce_background_choice_map_boundary":[23,"O","private.enforce_background_choice_map_boundary()",false,false,0,"",["choices"],""],
    "hit_die_character_revision":[19,"O","private.hit_die_character_revision_v1()",false,false,0,"",[],""],
    "hit_die_order_revision_rebind":[17,"O","private.hit_die_order_revision_rebind_v1()",false,false,0,"",[],""]
  }'::jsonb THEN
    RAISE EXCEPTION 'first_class_writer_parent_trigger_drift' USING ERRCODE='42501';
  END IF;
 END;

END; $prerequisites$;

-- Installation-only parser characterization: compare exact original proof
-- columns/CHECK/PK/UNIQUE definitions without guessing PostgreSQL deparse text.
-- This temporary relation has no rows, FKs, grants or runtime use and is dropped
-- before installing functions; no application relation is created/repaired.
CREATE TEMP TABLE pg_temp.inkborne_first_proof_shape_v1 (
  acceptance_id uuid PRIMARY KEY,
  transaction_id xid8 NOT NULL,
  target_character_id uuid NOT NULL,
  verified_actor_id uuid NOT NULL, operation_id uuid NOT NULL,
  mode text NOT NULL CHECK(mode='first_add_class_choices'),
  before_action_revision bigint NOT NULL CHECK(before_action_revision=0),
  after_action_revision bigint NOT NULL CHECK(after_action_revision=1),
  before_class_revision bigint NOT NULL CHECK(before_class_revision=0),
  after_class_revision bigint NOT NULL CHECK(after_class_revision=1),
  before_parent jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(before_parent)='object'),
  before_order jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(before_order)='object'),
  expected_after_graph jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(expected_after_graph)='object' AND pg_catalog.octet_length(expected_after_graph::text)<=4194304),
  planned_rows jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(planned_rows)='array' AND pg_catalog.jsonb_array_length(planned_rows) BETWEEN 1 AND 1024),
  phase text NOT NULL CHECK(phase IN ('pending','assigned','observed')),
  observed_parent jsonb, observed_order jsonb,
  CHECK((phase='observed')=(observed_parent IS NOT NULL AND observed_order IS NOT NULL)),
  CHECK(phase='observed' OR (observed_parent IS NULL AND observed_order IS NULL)),
  CHECK(observed_parent IS NULL OR pg_catalog.jsonb_typeof(observed_parent)='object'),
  CHECK(observed_order IS NULL OR pg_catalog.jsonb_typeof(observed_order)='object'),
  CHECK(pg_catalog.octet_length(pg_catalog.jsonb_build_array(before_parent,before_order,expected_after_graph,planned_rows,observed_parent,observed_order)::text)<=8388608),
  UNIQUE(transaction_id,target_character_id)
) ON COMMIT DROP;
DO $proof_shape$ DECLARE actual jsonb; expected jsonb; BEGIN
 SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,
   pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) INTO actual FROM pg_catalog.pg_attribute a
   LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND a.attnum>0 AND NOT a.attisdropped;
 SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,
   pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) INTO expected FROM pg_catalog.pg_attribute a
   LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid='pg_temp.inkborne_first_proof_shape_v1'::pg_catalog.regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'first_class_proof_column_shape_drift' USING ERRCODE='42501'; END IF;
 SELECT pg_catalog.jsonb_agg(pg_catalog.pg_get_constraintdef(c.oid,true) ORDER BY pg_catalog.pg_get_constraintdef(c.oid,true)) INTO actual
   FROM pg_catalog.pg_constraint c WHERE c.conrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND c.contype IN ('c','p','u');
 SELECT pg_catalog.jsonb_agg(pg_catalog.pg_get_constraintdef(c.oid,true) ORDER BY pg_catalog.pg_get_constraintdef(c.oid,true)) INTO expected
   FROM pg_catalog.pg_constraint c WHERE c.conrelid='pg_temp.inkborne_first_proof_shape_v1'::pg_catalog.regclass AND c.contype IN ('c','p','u');
 IF actual IS DISTINCT FROM expected OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE
   conrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND contype IN ('c','p','u','f') AND (NOT convalidated OR condeferrable)) THEN
   RAISE EXCEPTION 'first_class_proof_constraints_drift' USING ERRCODE='42501'; END IF;
 IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_constraint WHERE conrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass AND contype='f')<>2
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass
     AND c.contype='f' AND c.confrelid='private.class_writer_acceptance_v1'::pg_catalog.regclass AND c.conkey=ARRAY[1]::smallint[]
     AND c.confkey=ARRAY[1]::smallint[] AND c.confdeltype='a' AND c.confupdtype='a' AND c.confmatchtype='s')
   OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='private.class_first_acquisition_proofs_v1'::pg_catalog.regclass
     AND c.contype='f' AND c.confrelid='public.characters'::pg_catalog.regclass AND c.conkey=ARRAY[3]::smallint[]
     AND c.confkey=ARRAY[1]::smallint[] AND c.confdeltype='a' AND c.confupdtype='a' AND c.confmatchtype='s') THEN
   RAISE EXCEPTION 'first_class_proof_foreign_key_drift' USING ERRCODE='42501'; END IF;
END; $proof_shape$;
DROP TABLE pg_temp.inkborne_first_proof_shape_v1;
-- New immutable snapshot reader. A historical row is evidence only; active
-- consumers must separately bind current xid/context/journal/phase.
CREATE FUNCTION private.read_first_class_plan_snapshot_v1(p_target uuid,p_acceptance uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE plan private.class_first_protected_plans_v1%ROWTYPE; result jsonb;
BEGIN
  IF p_target IS NULL THEN RAISE EXCEPTION 'first_class_plan_unavailable' USING ERRCODE='42501'; END IF;
  IF p_acceptance IS NULL THEN
    SELECT * INTO plan FROM private.class_first_protected_plans_v1
      WHERE target_character_id=p_target AND transaction_id=pg_catalog.pg_current_xact_id();
  ELSE
    SELECT * INTO plan FROM private.class_first_protected_plans_v1
      WHERE acceptance_id=p_acceptance AND target_character_id=p_target;
  END IF;
  IF NOT FOUND OR plan.plan_kind<>'first_class_native_plan_v1' THEN
    RAISE EXCEPTION 'first_class_plan_unavailable' USING ERRCODE='42501'; END IF;
  result:=pg_catalog.to_jsonb(plan);
  IF pg_catalog.octet_length(result::text)>16793600 THEN
    RAISE EXCEPTION 'first_class_plan_bound' USING ERRCODE='54000'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION private.apply_first_class_public_rows_v1(p_acceptance uuid,p_phase text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE plan private.class_first_protected_plans_v1%ROWTYPE; ref_row public.character_content_refs%ROWTYPE;
  inserted public.character_content_refs%ROWTYPE; selected jsonb; expected jsonb; actual jsonb; family text;
BEGIN
  IF p_phase IS NULL OR p_phase NOT IN ('controller','active') THEN
    RAISE EXCEPTION 'first_class_public_phase_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO plan FROM private.class_first_protected_plans_v1 WHERE acceptance_id=p_acceptance
    AND transaction_id=pg_catalog.pg_current_xact_id();
  IF NOT FOUND OR plan.plan_kind<>'first_class_native_plan_v1' THEN
    RAISE EXCEPTION 'first_class_plan_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_character_command_actor_rows_v1(plan.verified_context);
  IF p_phase='active' THEN
    PERFORM private.consume_first_class_active_projections_v1(p_acceptance);
  ELSE
    IF EXISTS(SELECT 1 FROM public.character_content_refs WHERE character_id=plan.target_character_id)
      OR EXISTS(SELECT 1 FROM public.character_feature_grants WHERE character_id=plan.target_character_id)
      OR EXISTS(SELECT 1 FROM public.character_spell_grants WHERE character_id=plan.target_character_id)
      OR EXISTS(SELECT 1 FROM public.character_spells WHERE character_id=plan.target_character_id)
      OR EXISTS(SELECT 1 FROM public.character_inventory WHERE character_id=plan.target_character_id) THEN
      RAISE EXCEPTION 'first_class_controller_already_consumed' USING ERRCODE='23514'; END IF;
    selected:=plan.allocation_envelope->'native_rows'->'refs'->0;
    ref_row:=pg_catalog.jsonb_populate_record(NULL::public.character_content_refs,selected);
    INSERT INTO public.character_content_refs(id,character_id,content_id,content_version,context,choice_source,created_at,feature_grant_id)
      VALUES(ref_row.id,ref_row.character_id,ref_row.content_id,ref_row.content_version,ref_row.context,ref_row.choice_source,
        ref_row.created_at,ref_row.feature_grant_id) RETURNING * INTO inserted;
    IF NOT FOUND OR pg_catalog.to_jsonb(inserted) IS DISTINCT FROM selected THEN
      RAISE EXCEPTION 'first_class_controller_returning_mismatch' USING ERRCODE='23514'; END IF;
    PERFORM private.first_class_materialization_inputs_v1(plan.target_character_id,'grants');
    FOREACH family IN ARRAY ARRAY['feature_grants','spell_grants'] LOOP
      SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY (value->>'id')::uuid),'[]') INTO expected
        FROM pg_catalog.jsonb_array_elements(plan.allocation_envelope->'native_rows'->family);
      IF family='feature_grants' THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual
          FROM public.character_feature_grants r WHERE r.character_id=plan.target_character_id;
      ELSE
        SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') INTO actual
          FROM public.character_spell_grants r WHERE r.character_id=plan.target_character_id;
      END IF;
      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'first_class_controller_grant_mismatch' USING ERRCODE='23514'; END IF;
    END LOOP;
  END IF;
  PERFORM private.lock_character_command_actor_rows_v1(plan.verified_context);
  PERFORM private.check_character_command_clock_v1(plan.jwt_expires_at);
END $$;

-- Historical recovery intentionally never invokes a current-state finalizer or
-- untouched-draft planner. The current caller may have a new verified session.
CREATE FUNCTION private.resolve_first_class_command_v1(p_context jsonb,p_target uuid,p_operation uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; prior private.character_class_commands_v1%ROWTYPE;
  journal private.class_writer_acceptance_v1%ROWTYPE; proof private.class_first_acquisition_proofs_v1%ROWTYPE;
  sealed jsonb; envelope jsonb; matching bigint; transitions jsonb;
BEGIN
  PERFORM private.require_character_creation_context_v1(p_context);
  IF p_target IS NULL OR p_operation IS NULL THEN
    RAISE EXCEPTION 'strict_first_class_recovery_required' USING ERRCODE='22023'; END IF;
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO parent FROM public.characters WHERE id=p_target AND user_id=(p_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.require_character_creation_context_v1(p_context);
  SELECT * INTO prior FROM private.character_class_commands_v1 WHERE character_id=p_target AND operation_id=p_operation;
  IF NOT FOUND THEN RETURN '{"status":"absent"}'::jsonb; END IF;
  IF NOT COALESCE(private.class_origin_receipt_shape_v1(prior.receipt),false)
    OR prior.receipt->>'verified_actor_id' IS DISTINCT FROM parent.user_id::text
    OR prior.receipt->>'target_character_id' IS DISTINCT FROM parent.id::text
    OR prior.receipt->>'operation_id' IS DISTINCT FROM p_operation::text
    OR prior.receipt->>'receipt_kind' IS DISTINCT FROM 'class_transition'
    OR prior.receipt#>>'{canonical_intent,command}' IS DISTINCT FROM 'add_class'
    OR prior.receipt->>'before_action_revision' IS DISTINCT FROM '0'
    OR prior.receipt->>'after_action_revision' IS DISTINCT FROM '1'
    OR prior.receipt->>'before_class_revision' IS DISTINCT FROM '0'
    OR prior.receipt->>'after_class_revision' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'first_class_receipt_history_unavailable' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_acceptance_v1 j
    WHERE j.target_character_id=p_target AND j.verified_actor_id=parent.user_id AND j.acceptance_kind='class_transition'
      AND j.finalized AND j.revision_transition_consumed AND j.receipt=prior.receipt;
  IF matching<>1 THEN RAISE EXCEPTION 'first_class_receipt_history_unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO journal FROM private.class_writer_acceptance_v1 j
    WHERE j.target_character_id=p_target AND j.verified_actor_id=parent.user_id AND j.acceptance_kind='class_transition'
      AND j.finalized AND j.revision_transition_consumed AND j.receipt=prior.receipt FOR SHARE;
  sealed:=private.read_first_class_plan_snapshot_v1(p_target,journal.acceptance_id); envelope:=sealed->'allocation_envelope';
  IF sealed->>'transaction_id' IS DISTINCT FROM journal.transaction_id::text
    OR sealed->>'verified_actor_id' IS DISTINCT FROM parent.user_id::text
    OR sealed->>'operation_id' IS DISTINCT FROM p_operation::text
    OR sealed->'canonical_intent' IS DISTINCT FROM prior.receipt->'canonical_intent'
    OR envelope->'receipt' IS DISTINCT FROM prior.receipt
    OR envelope->'before_parent' IS DISTINCT FROM journal.before_parent
    OR envelope->'before_origin' IS DISTINCT FROM journal.before_origin
    OR envelope->'expected_graph' IS DISTINCT FROM journal.expected_graph
    OR envelope->'planned_transitions' IS DISTINCT FROM journal.planned_transitions
    OR journal.preinsert_proof IS NOT NULL THEN
    RAISE EXCEPTION 'first_class_receipt_plan_mismatch' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('relation_key',t.relation_key,'row_key',t.row_key,
    'before_row',t.before_row,'after_row',t.after_row) ORDER BY t.relation_key,t.row_key),'[]') INTO transitions
    FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=journal.acceptance_id;
  IF (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=journal.acceptance_id)<>3
    OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=journal.acceptance_id AND NOT consumed)
    OR transitions IS DISTINCT FROM (SELECT pg_catalog.jsonb_agg(value ORDER BY value->>'relation_key',value->'row_key')
      FROM pg_catalog.jsonb_array_elements(journal.planned_transitions)) THEN
    RAISE EXCEPTION 'first_class_receipt_proofs_unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO proof FROM private.class_first_acquisition_proofs_v1 WHERE acceptance_id=journal.acceptance_id;
  IF NOT FOUND OR proof.phase<>'observed' OR proof.transaction_id IS DISTINCT FROM journal.transaction_id
    OR proof.target_character_id IS DISTINCT FROM p_target OR proof.verified_actor_id IS DISTINCT FROM parent.user_id
    OR proof.operation_id IS DISTINCT FROM p_operation OR proof.mode<>'first_add_class_choices'
    OR proof.before_action_revision<>0 OR proof.after_action_revision<>1 OR proof.before_class_revision<>0 OR proof.after_class_revision<>1
    OR proof.before_parent IS DISTINCT FROM journal.before_parent OR proof.before_order IS DISTINCT FROM envelope->'before_order'
    OR proof.expected_after_graph IS DISTINCT FROM journal.expected_graph OR proof.planned_rows IS DISTINCT FROM journal.planned_transitions
    OR proof.observed_parent IS DISTINCT FROM journal.expected_graph->'parent'
    OR proof.observed_order IS DISTINCT FROM journal.expected_graph->'order'
    OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=journal.acceptance_id
      AND t.relation_key='class_receipt' AND t.row_key=pg_catalog.jsonb_build_array(p_target,p_operation)
      AND t.before_row IS NULL AND t.after_row=pg_catalog.to_jsonb(prior)) THEN
    RAISE EXCEPTION 'first_class_receipt_observation_unavailable' USING ERRCODE='23514'; END IF;
  IF p_intent IS NOT NULL AND prior.receipt->'canonical_intent' IS DISTINCT FROM p_intent THEN
    RAISE EXCEPTION 'operation_intent_conflict' USING ERRCODE='23505'; END IF;
  PERFORM private.require_character_creation_context_v1(p_context);
  RETURN pg_catalog.jsonb_build_object('status','recorded','receipt',prior.receipt);
END $$;

CREATE FUNCTION private.finish_first_class_choices_revision_v1(p_context jsonb,p_acceptance uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE inputs jsonb; proof private.class_first_acquisition_proofs_v1%ROWTYPE;
  expected private.character_projection_order_v1%ROWTYPE; before_order private.character_projection_order_v1%ROWTYPE;
  after_order private.character_projection_order_v1%ROWTYPE; parent public.characters%ROWTYPE; parent_json jsonb; order_json jsonb;
BEGIN
  PERFORM private.require_character_creation_context_v1(p_context);
  inputs:=private.class_first_acquisition_inputs_v1(p_acceptance);
  IF inputs->'verified_context' IS DISTINCT FROM p_context THEN
    RAISE EXCEPTION 'first_class_context_mismatch' USING ERRCODE='42501'; END IF;
  SELECT * INTO proof FROM private.class_first_acquisition_proofs_v1 WHERE acceptance_id=p_acceptance FOR UPDATE;
  IF NOT FOUND OR proof.phase<>'assigned' OR proof.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() THEN
    RAISE EXCEPTION 'first_class_assigned_proof_unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO parent FROM public.characters WHERE id=proof.target_character_id AND user_id=proof.verified_actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
  parent_json:=pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object('action_revision',parent.action_revision::text);
  expected:=pg_catalog.jsonb_populate_record(NULL::private.character_projection_order_v1,inputs->'expected_after_graph'->'order');
  before_order:=pg_catalog.jsonb_populate_record(NULL::private.character_projection_order_v1,
    (inputs->'before_order')||pg_catalog.jsonb_build_object('producer_revision','1'));
  IF parent_json IS DISTINCT FROM inputs->'expected_after_graph'->'parent' THEN
    RAISE EXCEPTION 'first_class_actual_parent_mismatch' USING ERRCODE='23514'; END IF;
  UPDATE private.character_projection_order_v1 o SET pins=expected.pins,spells=expected.spells,
    feature_grants=expected.feature_grants,spell_grants=expected.spell_grants
    WHERE o.character_id=proof.target_character_id AND pg_catalog.to_jsonb(o)=pg_catalog.to_jsonb(before_order)
    RETURNING * INTO after_order;
  IF NOT FOUND OR pg_catalog.to_jsonb(after_order) IS DISTINCT FROM pg_catalog.to_jsonb(expected) THEN
    RAISE EXCEPTION 'first_class_order_returning_mismatch' USING ERRCODE='23514'; END IF;
  order_json:=pg_catalog.to_jsonb(after_order)||pg_catalog.jsonb_build_object('producer_revision',after_order.producer_revision::text);
  UPDATE private.class_first_acquisition_proofs_v1 SET phase='observed',observed_parent=parent_json,observed_order=order_json
    WHERE acceptance_id=p_acceptance AND phase='assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_assigned_proof_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.require_character_creation_context_v1(p_context);
END $$;

CREATE OR REPLACE FUNCTION private.observe_first_class_choices_revision_v1(p_context jsonb,p_acceptance uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE inputs jsonb; before_row public.characters%ROWTYPE; after_row public.characters%ROWTYPE;
  stored public.characters%ROWTYPE; ordering private.character_projection_order_v1%ROWTYPE;
  before_json jsonb; after_json jsonb; order_json jsonb;
BEGIN
  PERFORM private.require_character_creation_context_v1(p_context);
  inputs:=private.class_first_acquisition_inputs_v1(p_acceptance);
  IF inputs->'verified_context' IS DISTINCT FROM p_context THEN
    RAISE EXCEPTION 'first_class_context_mismatch' USING ERRCODE='42501'; END IF;
  SELECT * INTO before_row FROM public.characters WHERE id=(inputs->>'target_character_id')::uuid
    AND user_id=(p_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
  before_json:=pg_catalog.to_jsonb(before_row)||pg_catalog.jsonb_build_object('action_revision',before_row.action_revision::text);
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=before_row.id FOR UPDATE;
  IF NOT FOUND OR before_json IS DISTINCT FROM inputs->'before_parent'
    OR (pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text))
      IS DISTINCT FROM inputs->'before_order' THEN
    RAISE EXCEPTION 'first_class_actual_before_mismatch' USING ERRCODE='23514'; END IF;
  INSERT INTO private.class_first_acquisition_proofs_v1(acceptance_id,transaction_id,target_character_id,verified_actor_id,operation_id,
    mode,before_action_revision,after_action_revision,before_class_revision,after_class_revision,before_parent,before_order,
    expected_after_graph,planned_rows,phase,observed_parent,observed_order)
    VALUES(p_acceptance,pg_catalog.pg_current_xact_id(),before_row.id,before_row.user_id,(inputs->>'operation_id')::uuid,
      'first_add_class_choices',0,1,0,1,inputs->'before_parent',inputs->'before_order',inputs->'expected_after_graph',
      inputs->'planned_rows','pending',NULL,NULL);
  -- R09 alone assigns the revision and the pending->assigned transition from its
  -- genuine OLD/NEW callback. No caller revision, GUC or actor marker is written.
  UPDATE public.characters c SET choices=inputs->'expected_after_graph'->'parent'->'choices'
    WHERE c.id=before_row.id AND c.user_id=before_row.user_id AND c.action_revision=0
      AND pg_catalog.to_jsonb(c)=pg_catalog.to_jsonb(before_row) RETURNING * INTO after_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_choices_update_missing' USING ERRCODE='23514'; END IF;
  after_json:=pg_catalog.to_jsonb(after_row)||pg_catalog.jsonb_build_object('action_revision',after_row.action_revision::text);
  SELECT * INTO stored FROM public.characters WHERE id=before_row.id AND user_id=before_row.user_id;
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=before_row.id;
  order_json:=pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text);
  IF after_json IS DISTINCT FROM inputs->'expected_after_graph'->'parent'
    OR pg_catalog.to_jsonb(stored) IS DISTINCT FROM pg_catalog.to_jsonb(after_row)
    OR order_json IS DISTINCT FROM ((inputs->'before_order')||pg_catalog.jsonb_build_object('producer_revision','1'))
    OR NOT EXISTS(SELECT 1 FROM private.class_first_acquisition_proofs_v1 WHERE acceptance_id=p_acceptance AND phase='assigned') THEN
    RAISE EXCEPTION 'first_class_choices_returning_mismatch' USING ERRCODE='23514'; END IF;
  PERFORM private.require_character_creation_context_v1(p_context);
  RETURN pg_catalog.jsonb_build_object('phase','assigned','parent',after_json,'order',order_json);
END $$;

CREATE OR REPLACE FUNCTION private.begin_class_origin_acceptance_v1(p_context jsonb,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE sealed jsonb; envelope jsonb; transition jsonb; selected jsonb; checked jsonb; target uuid;
  journal private.class_writer_acceptance_v1%ROWTYPE; actual_journal private.class_writer_acceptance_v1%ROWTYPE;
  before_origin private.character_class_origin_v1%ROWTYPE; after_origin private.character_class_origin_v1%ROWTYPE;
  occurrence private.character_class_occurrences_v1%ROWTYPE; actual_occurrence private.character_class_occurrences_v1%ROWTYPE;
  receipt_row private.character_class_commands_v1%ROWTYPE; actual_receipt private.character_class_commands_v1%ROWTYPE;
BEGIN
  IF p_intent->>'command' IS DISTINCT FROM 'add_class' THEN
    PERFORM private.require_class_origin_auth_v1(p_context);
    PERFORM private.lock_character_writer_guard_v1();
    RAISE EXCEPTION 'class_origin_producer_unavailable' USING ERRCODE='P0001';
  END IF;
  PERFORM private.require_character_creation_context_v1(p_context);
  PERFORM private.validate_first_class_calculation_intent_v1(p_intent);
  target:=(p_intent->>'character_id')::uuid;
  sealed:=private.read_first_class_plan_snapshot_v1(target,NULL); envelope:=sealed->'allocation_envelope';
  IF sealed->>'transaction_id' IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text
    OR sealed->'verified_context' IS DISTINCT FROM p_context OR sealed->'canonical_intent' IS DISTINCT FROM p_intent
    OR sealed->>'verified_actor_id' IS DISTINCT FROM p_context->>'actor_id'
    OR EXISTS(SELECT 1 FROM private.character_class_commands_v1 WHERE character_id=target AND operation_id=(p_intent->>'operation_id')::uuid) THEN
    RAISE EXCEPTION 'first_class_sealed_plan_mismatch' USING ERRCODE='42501'; END IF;
  journal.acceptance_id:=(sealed->>'acceptance_id')::uuid; journal.transaction_id:=pg_catalog.pg_current_xact_id();
  journal.verified_actor_id:=(sealed->>'verified_actor_id')::uuid; journal.target_character_id:=target;
  journal.acceptance_kind:='class_transition'; journal.before_parent:=envelope->'before_parent'; journal.before_origin:=envelope->'before_origin';
  journal.preinsert_proof:=NULL; journal.expected_graph:=envelope->'expected_graph'; journal.planned_transitions:=envelope->'planned_transitions';
  journal.receipt:=envelope->'receipt'; journal.revision_transition_consumed:=false; journal.finalized:=false;
  INSERT INTO private.class_writer_acceptance_v1 SELECT journal.* RETURNING * INTO actual_journal;
  IF pg_catalog.to_jsonb(actual_journal) IS DISTINCT FROM pg_catalog.to_jsonb(journal) THEN
    RAISE EXCEPTION 'first_class_journal_returning_mismatch' USING ERRCODE='23514'; END IF;
  FOR transition IN SELECT value FROM pg_catalog.jsonb_array_elements(journal.planned_transitions) LOOP
    INSERT INTO private.class_writer_row_transitions_v1(acceptance_id,relation_key,row_key,before_row,after_row,consumed)
      VALUES(journal.acceptance_id,transition->>'relation_key',transition->'row_key',NULLIF(transition->'before_row','null'::jsonb),
        NULLIF(transition->'after_row','null'::jsonb),false);
  END LOOP;
  PERFORM private.apply_first_class_public_rows_v1(journal.acceptance_id,'controller');
  checked:=private.observe_first_class_choices_revision_v1(p_context,journal.acceptance_id);
  IF checked->>'phase' IS DISTINCT FROM 'assigned' OR checked->'parent' IS DISTINCT FROM envelope->'expected_graph'->'parent' THEN
    RAISE EXCEPTION 'first_class_choices_assignment_unavailable' USING ERRCODE='23514'; END IF;
  PERFORM private.apply_first_class_public_rows_v1(journal.acceptance_id,'active');
  before_origin:=pg_catalog.jsonb_populate_record(NULL::private.character_class_origin_v1,envelope->'before_origin');
  UPDATE private.character_class_origin_v1 o SET command_revision=1 WHERE o.character_id=target
    AND pg_catalog.to_jsonb(o)=pg_catalog.to_jsonb(before_origin) RETURNING * INTO after_origin;
  IF NOT FOUND OR (pg_catalog.to_jsonb(after_origin)||pg_catalog.jsonb_build_object('command_revision',after_origin.command_revision::text))
      IS DISTINCT FROM envelope->'expected_graph'->'origin' THEN
    RAISE EXCEPTION 'first_class_origin_returning_mismatch' USING ERRCODE='23514'; END IF;
  selected:=envelope->'native_rows'->'occurrences'->0;
  occurrence:=pg_catalog.jsonb_populate_record(NULL::private.character_class_occurrences_v1,selected);
  INSERT INTO private.character_class_occurrences_v1 SELECT occurrence.* RETURNING * INTO actual_occurrence;
  IF NOT FOUND OR pg_catalog.to_jsonb(actual_occurrence) IS DISTINCT FROM selected THEN
    RAISE EXCEPTION 'first_class_occurrence_returning_mismatch' USING ERRCODE='23514'; END IF;
  receipt_row.character_id:=target; receipt_row.operation_id:=(p_intent->>'operation_id')::uuid; receipt_row.receipt:=journal.receipt;
  INSERT INTO private.character_class_commands_v1 SELECT receipt_row.* RETURNING * INTO actual_receipt;
  IF NOT FOUND OR pg_catalog.to_jsonb(actual_receipt) IS DISTINCT FROM pg_catalog.to_jsonb(receipt_row) THEN
    RAISE EXCEPTION 'first_class_receipt_returning_mismatch' USING ERRCODE='23514'; END IF;
  PERFORM private.finish_first_class_choices_revision_v1(p_context,journal.acceptance_id);
  PERFORM private.class_first_acquisition_observed_v1(journal.acceptance_id);
  PERFORM private.consume_first_class_choices_revision_v1(journal.acceptance_id);
  UPDATE private.class_writer_acceptance_v1 SET finalized=true WHERE acceptance_id=journal.acceptance_id
    AND transaction_id=pg_catalog.pg_current_xact_id() AND revision_transition_consumed AND NOT finalized;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_finalize_missing' USING ERRCODE='23514'; END IF;
  PERFORM private.class_origin_finalize_acceptance_v1(journal.acceptance_id);
  PERFORM private.assert_first_class_choices_revision_v1(journal.acceptance_id);
  PERFORM private.require_character_creation_context_v1(p_context);
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',journal.receipt);
END $$;

CREATE FUNCTION private.coordinate_first_class_command_v1(p_context jsonb,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; target uuid; operation uuid; prepared private.class_first_protected_plans_v1%ROWTYPE;
BEGIN
  IF pg_catalog.jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR pg_catalog.octet_length(p_request::text)>32768 THEN
    RETURN '{"status":"invalid"}'::jsonb; END IF;
  IF p_request->>'command'='add_class' THEN
    PERFORM private.validate_first_class_calculation_intent_v1(p_request);
  ELSIF p_request->>'command'='resolve_class' THEN
    IF NOT private.first_class_calculation_exact_keys_v1(p_request,ARRAY['contract_version','command','character_id','operation_id'])
      OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb
      OR NOT private.first_class_calculation_uuid_v1(p_request->'character_id')
      OR NOT private.first_class_calculation_uuid_v1(p_request->'operation_id') THEN
      RAISE EXCEPTION 'strict_first_class_recovery_required' USING ERRCODE='22023'; END IF;
  ELSE RETURN '{"status":"invalid"}'::jsonb; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid;
  PERFORM private.lock_character_command_actor_rows_v1(p_context);
  result:=private.resolve_first_class_command_v1(p_context,target,operation,
    CASE WHEN p_request->>'command'='add_class' THEN p_request ELSE NULL END);
  IF result->>'status'='recorded' THEN
    IF p_request->>'command'='add_class' THEN result:=result||'{"status":"replayed"}'::jsonb; END IF;
  ELSIF result->>'status'='absent' AND p_request->>'command'='add_class' THEN
    prepared:=private.prepare_first_class_protected_plan_v1(p_context,p_request);
    result:=private.begin_class_origin_acceptance_v1(p_context,p_request);
    IF result->>'status' IS DISTINCT FROM 'applied' OR result->'receipt' IS DISTINCT FROM prepared.allocation_envelope->'receipt' THEN
      RAISE EXCEPTION 'first_class_coordinator_result_mismatch' USING ERRCODE='23514'; END IF;
  ELSIF result->>'status' IS DISTINCT FROM 'absent' THEN
    RAISE EXCEPTION 'first_class_coordinator_result_unavailable' USING ERRCODE='P0001';
  END IF;
  PERFORM private.lock_character_command_actor_rows_v1(p_context);
  IF result IS NULL OR pg_catalog.octet_length(result::text)>65536 THEN
    RAISE EXCEPTION 'first_class_coordinator_result_unavailable' USING ERRCODE='P0001'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.character_class_command_v1(p_context jsonb,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM private.lock_character_command_actor_rows_gateway_v1(p_context);
  result:=private.coordinate_first_class_command_v1(p_context,p_request);
  PERFORM private.lock_character_command_actor_rows_gateway_v1(p_context);
  IF result IS NULL OR pg_catalog.jsonb_typeof(result) IS DISTINCT FROM 'object' OR pg_catalog.octet_length(result::text)>65536 THEN
    RAISE EXCEPTION 'first_class_bridge_result_unavailable' USING ERRCODE='P0001'; END IF;
  RETURN result;
END $$;


CREATE OR REPLACE FUNCTION private.class_first_acquisition_inputs_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE j private.class_writer_acceptance_v1%ROWTYPE; bootstrap private.class_writer_acceptance_v1%ROWTYPE;
  creation private.character_creation_commands_v1%ROWTYPE; occurrence jsonb; matches bigint; sealed jsonb; envelope jsonb; BEGIN
  -- Finite native-plan admission; the original static historical checks remain below.
  -- Retained exact static bootstrap/first-command closure after sealed-plan admission.
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_journal_unavailable' USING ERRCODE='42501'; END IF;
  sealed:=private.read_first_class_plan_snapshot_v1(j.target_character_id,p_acceptance); envelope:=sealed->'allocation_envelope';
  IF sealed->>'transaction_id' IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text
    OR sealed->>'transaction_id' IS DISTINCT FROM j.transaction_id::text
    OR sealed->>'verified_actor_id' IS DISTINCT FROM j.verified_actor_id::text
    OR sealed->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR sealed->'canonical_intent' IS DISTINCT FROM j.receipt->'canonical_intent'
    OR envelope->'before_parent' IS DISTINCT FROM j.before_parent OR envelope->'before_origin' IS DISTINCT FROM j.before_origin
    OR envelope->'expected_graph' IS DISTINCT FROM j.expected_graph OR envelope->'planned_transitions' IS DISTINCT FROM j.planned_transitions
    OR envelope->'receipt' IS DISTINCT FROM j.receipt THEN
    RAISE EXCEPTION 'first_class_journal_native_plan_mismatch' USING ERRCODE='23514'; END IF;
  PERFORM private.require_character_creation_context_v1(sealed->'verified_context');
  IF NOT FOUND OR j.acceptance_kind IS DISTINCT FROM 'class_transition' OR j.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
    OR j.preinsert_proof IS NOT NULL OR NOT COALESCE(private.class_origin_receipt_shape_v1(j.receipt),false)
    OR j.receipt#>>'{canonical_intent,command}' IS DISTINCT FROM 'add_class'
    OR j.receipt->>'verified_actor_id' IS DISTINCT FROM j.verified_actor_id::text
    OR j.receipt->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR j.receipt#>>'{canonical_intent,character_id}' IS DISTINCT FROM j.target_character_id::text
    OR j.receipt#>>'{canonical_intent,operation_id}' IS DISTINCT FROM j.receipt->>'operation_id'
    OR j.before_parent->>'id' IS DISTINCT FROM j.target_character_id::text
    OR j.before_parent->>'user_id' IS DISTINCT FROM j.verified_actor_id::text
    OR j.before_parent->>'action_revision' IS DISTINCT FROM '0' OR j.before_parent->'choices' IS DISTINCT FROM '{}'::jsonb
    OR j.before_parent->'campaign_id' IS DISTINCT FROM 'null'::jsonb
    OR j.before_origin->>'creation_provenance' IS DISTINCT FROM 'new_character'
    OR j.before_origin->>'origin_status' IS DISTINCT FROM 'draft' OR j.before_origin->>'command_revision' IS DISTINCT FROM '0'
    OR j.before_origin->'origin_occurrence_id' IS DISTINCT FROM 'null'::jsonb OR j.before_origin->'role_proof' IS DISTINCT FROM 'null'::jsonb
    OR j.receipt->'confirmation' IS DISTINCT FROM 'null'::jsonb
    OR j.receipt#>'{canonical_intent,fields,subclass}' IS DISTINCT FROM 'null'::jsonb
    OR j.receipt->>'before_action_revision' IS DISTINCT FROM '0' OR j.receipt->>'after_action_revision' IS DISTINCT FROM '1'
    OR j.receipt->>'before_class_revision' IS DISTINCT FROM '0' OR j.receipt->>'after_class_revision' IS DISTINCT FROM '1'
    OR j.receipt#>>'{canonical_intent,expected_action_revision}' IS DISTINCT FROM '0'
    OR j.receipt#>>'{canonical_intent,expected_class_revision}' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'Exact first acquisition journal identity required' USING ERRCODE='23514'; END IF;
  SELECT * INTO creation FROM private.character_creation_commands_v1 AS command
    WHERE command.verified_actor_id=j.verified_actor_id AND command.target_character_id=j.target_character_id
    AND command.operation_id=(j.before_origin->>'creation_operation_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Genuine empty bootstrap receipt unavailable' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*) INTO matches FROM private.class_writer_acceptance_v1 AS original
    WHERE original.target_character_id=j.target_character_id AND original.verified_actor_id=j.verified_actor_id
    AND original.receipt=creation.receipt AND original.acceptance_kind='bootstrap_new' AND original.finalized;
  IF matches<>1 THEN RAISE EXCEPTION 'Genuine empty bootstrap journal unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO bootstrap FROM private.class_writer_acceptance_v1 AS original
    WHERE original.target_character_id=j.target_character_id AND original.verified_actor_id=j.verified_actor_id
    AND original.receipt=creation.receipt AND original.acceptance_kind='bootstrap_new' AND original.finalized;
  IF bootstrap.before_parent IS NOT NULL OR bootstrap.before_origin IS NOT NULL OR bootstrap.revision_transition_consumed
    OR bootstrap.expected_graph->'parent' IS DISTINCT FROM j.before_parent OR bootstrap.expected_graph->'origin' IS DISTINCT FROM j.before_origin
    OR bootstrap.preinsert_proof->>'acceptance_id' IS DISTINCT FROM bootstrap.acceptance_id::text
    OR bootstrap.preinsert_proof->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR bootstrap.preinsert_proof->>'transaction_id' IS DISTINCT FROM bootstrap.transaction_id::text
    OR NOT COALESCE(private.class_origin_receipt_shape_v1(creation.receipt),false)
    OR creation.receipt->>'receipt_kind' IS DISTINCT FROM 'bootstrap_new'
    OR creation.receipt->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR creation.receipt->>'verified_actor_id' IS DISTINCT FROM j.verified_actor_id::text
    OR creation.receipt->>'operation_id' IS DISTINCT FROM j.before_origin->>'creation_operation_id'
    OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=bootstrap.acceptance_id AND t.consumed
      AND t.relation_key='creation_receipt' AND t.row_key=pg_catalog.jsonb_build_array(j.verified_actor_id,creation.operation_id)
      AND t.before_row IS NULL AND t.after_row=pg_catalog.to_jsonb(creation))
    OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=bootstrap.acceptance_id AND t.consumed
      AND t.relation_key='origin' AND t.row_key=pg_catalog.jsonb_build_array(j.target_character_id)
      AND t.before_row IS NULL AND t.after_row=j.before_origin)
    OR NOT COALESCE(private.class_origin_exact_keys_v1(bootstrap.expected_graph,
      ARRAY['parent','origin','order','occurrences','refs','inventory','spells','feature_grants','spell_grants','versions']),false)
    OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['occurrences','refs','inventory','spells','feature_grants','spell_grants','versions']) domain(name)
      WHERE bootstrap.expected_graph->name IS DISTINCT FROM '[]'::jsonb)
    OR bootstrap.expected_graph->'order' IS DISTINCT FROM pg_catalog.jsonb_build_object('character_id',j.target_character_id,
      'producer_version',1,'producer_revision','0','pins','[]'::jsonb,'inventory','[]'::jsonb,'spells','[]'::jsonb,
      'feature_grants','[]'::jsonb,'spell_grants','[]'::jsonb)
    OR ((j.expected_graph->'parent')-ARRAY['choices','action_revision']) IS DISTINCT FROM (j.before_parent-ARRAY['choices','action_revision'])
    OR j.expected_graph#>>'{parent,action_revision}' IS DISTINCT FROM '1'
    OR j.expected_graph->'origin' IS DISTINCT FROM (j.before_origin||pg_catalog.jsonb_build_object('command_revision','1'))
    OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['occurrences','refs','inventory','spells','feature_grants','spell_grants','versions']) domain(name)
      WHERE pg_catalog.jsonb_typeof(j.expected_graph->name) IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(j.expected_graph->name)>4096) THEN
    RAISE EXCEPTION 'Original empty bootstrap proofs required' USING ERRCODE='23514'; END IF;
  IF pg_catalog.jsonb_typeof(j.expected_graph#>'{parent,choices,classes}') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(j.expected_graph#>'{parent,choices,classes}')<>1
    OR pg_catalog.jsonb_array_length(j.expected_graph->'occurrences')<>1 THEN
    RAISE EXCEPTION 'One genuine first selected occurrence required' USING ERRCODE='23514'; END IF;
  occurrence:=j.expected_graph#>'{occurrences,0}';
  IF occurrence->>'character_id' IS DISTINCT FROM j.target_character_id::text
    OR occurrence->>'system_id' IS DISTINCT FROM j.before_parent->>'system_id'
    OR occurrence->>'content_id' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,content_id}'
    OR occurrence->'content_version' IS DISTINCT FROM j.receipt#>'{canonical_intent,fields,content_version}'
    OR occurrence->>'lifecycle' IS DISTINCT FROM 'provisional'
    OR occurrence->'accepted_at' IS DISTINCT FROM 'null'::jsonb OR occurrence->'ended_at' IS DISTINCT FROM 'null'::jsonb
    OR occurrence->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb
    OR occurrence->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb OR occurrence->'subclass_ref_id' IS DISTINCT FROM 'null'::jsonb
    OR NOT COALESCE(private.class_origin_uuid_v1(occurrence->'id'),false)
    OR NOT COALESCE(private.class_origin_uuid_v1(occurrence->'controller_ref_id'),false)
    OR NOT COALESCE(private.class_origin_instant_v1(occurrence->'selected_at'),false)
    OR j.expected_graph#>>'{parent,choices,classes,0,occurrence_id}' IS DISTINCT FROM occurrence->>'id'
    OR j.expected_graph#>>'{parent,choices,classes,0,slug}' IS DISTINCT FROM occurrence->>'class_slug'
    OR j.expected_graph#>'{parent,choices,classes,0,level}' IS DISTINCT FROM '1'::jsonb THEN
    RAISE EXCEPTION 'Exact provisional occurrence and controller identity required' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*) INTO matches FROM pg_catalog.jsonb_array_elements(j.expected_graph->'refs') pins(ref)
    JOIN pg_catalog.jsonb_array_elements(j.expected_graph->'versions') versions(version)
    ON version->'content_id'=ref->'content_id' AND version->'version'=ref->'content_version'
    WHERE ref->'id'=occurrence->'controller_ref_id' AND ref->>'character_id'=j.target_character_id::text
      AND ref->'content_id'=occurrence->'content_id' AND ref->'content_version'=occurrence->'content_version'
      AND ref#>>'{context,source}'='class' AND version->>'content_type_snapshot'='class'
      AND version->>'system_id_snapshot'=j.before_parent->>'system_id' AND version->>'slug_snapshot'=occurrence->>'class_slug';
  IF matches<>1 THEN RAISE EXCEPTION 'Frozen exact first controller version required' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('acceptance_id',j.acceptance_id,'transaction_id',j.transaction_id::text,
    'target_character_id',j.target_character_id,'verified_actor_id',j.verified_actor_id,'operation_id',j.receipt->>'operation_id',
    'before_parent',j.before_parent,'before_order',bootstrap.expected_graph->'order','expected_after_graph',j.expected_graph,'planned_rows',j.planned_transitions,'verified_context',sealed->'verified_context');
END $$;

CREATE OR REPLACE FUNCTION private.class_origin_finalize_transition_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; graph jsonb; before_shared bigint; before_class bigint;
  selected_id uuid; selected_proof private.class_writer_row_transitions_v1%ROWTYPE; selected_occurrence private.character_class_occurrences_v1%ROWTYPE; matching bigint; BEGIN
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact acceptance required' USING ERRCODE='23514'; END IF;
  IF j.receipt#>>'{canonical_intent,command}'='add_class' THEN
    PERFORM private.assert_first_class_choices_revision_v1(p_acceptance);
  ELSIF j.receipt#>>'{canonical_intent,command}'='confirm_origin' THEN
    PERFORM private.class_origin_assert_metadata_revision_v1(p_acceptance);
  ELSE RAISE EXCEPTION 'Class command prerequisite unavailable' USING ERRCODE='P0001'; END IF;
  graph:=private.class_origin_assert_common_v1(p_acceptance);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  before_shared:=(j.before_parent->>'action_revision')::bigint; before_class:=(j.before_origin->>'command_revision')::bigint;
  IF j.acceptance_kind<>'class_transition' OR NOT j.revision_transition_consumed OR j.preinsert_proof IS NOT NULL
    OR before_shared=9223372036854775807 OR before_class=9223372036854775807
    OR (graph#>>'{parent,action_revision}')::bigint<>before_shared+1 OR (graph#>>'{origin,command_revision}')::bigint<>before_class+1
    OR j.receipt->>'before_action_revision' IS DISTINCT FROM before_shared::text OR j.receipt->>'before_class_revision' IS DISTINCT FROM before_class::text
    OR j.receipt->>'after_action_revision' IS DISTINCT FROM graph#>>'{parent,action_revision}'
    OR j.receipt->>'after_class_revision' IS DISTINCT FROM graph#>>'{origin,command_revision}'
    OR j.receipt#>>'{canonical_intent,character_id}' IS DISTINCT FROM j.target_character_id::text
    OR j.receipt#>>'{canonical_intent,expected_action_revision}' IS DISTINCT FROM before_shared::text
    OR j.receipt#>>'{canonical_intent,expected_class_revision}' IS DISTINCT FROM before_class::text
    OR NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1 WHERE character_id=j.target_character_id AND operation_id=(j.receipt->>'operation_id')::uuid AND receipt=j.receipt) THEN
    RAISE EXCEPTION 'Changed transition receipt/revision mismatch' USING ERRCODE='23514'; END IF;
  IF j.receipt#>>'{canonical_intent,command}'='confirm_origin' THEN
    IF j.before_origin->>'origin_status'<>'draft' OR graph#>>'{origin,origin_status}'<>'recorded'
      OR graph#>>'{origin,origin_occurrence_id}' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,selected_occurrence_id}'
      OR j.receipt#>>'{confirmation,canonical_intent,expected_revision}' IS DISTINCT FROM before_class::text
      OR j.receipt#>>'{confirmation,applied_revision}' IS DISTINCT FROM (before_class+1)::text
      OR j.receipt#>>'{confirmation,canonical_intent,character_id}' IS DISTINCT FROM j.target_character_id::text
      OR j.receipt#>>'{confirmation,canonical_intent,operation_id}' IS DISTINCT FROM j.receipt->>'operation_id'
      OR j.receipt#>>'{confirmation,canonical_intent,selected_occurrence_id}' IS DISTINCT FROM graph#>>'{origin,origin_occurrence_id}'
      OR j.receipt#>>'{confirmation,accepted_at}' IS DISTINCT FROM j.receipt->>'accepted_at'
      OR graph#>'{origin,role_proof}' IS DISTINCT FROM pg_catalog.jsonb_build_object('kind','confirmation','receipt',j.receipt->'confirmation') THEN
      RAISE EXCEPTION 'Actual metadata confirmation delta missing' USING ERRCODE='23514'; END IF;
    selected_id:=(j.receipt#>>'{canonical_intent,fields,selected_occurrence_id}')::uuid;
    SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
      AND relation_key='occurrence' AND row_key=pg_catalog.jsonb_build_array(selected_id) AND consumed;
    IF matching<>1 THEN RAISE EXCEPTION 'Consumed selected occurrence confirmation required' USING ERRCODE='23514'; END IF;
    SELECT * INTO selected_proof FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
      AND relation_key='occurrence' AND row_key=pg_catalog.jsonb_build_array(selected_id) AND consumed;
    SELECT * INTO selected_occurrence FROM private.character_class_occurrences_v1 WHERE id=selected_id AND character_id=j.target_character_id;
    IF NOT FOUND OR selected_proof.before_row IS NULL OR selected_proof.before_row->>'lifecycle' IS DISTINCT FROM 'provisional'
      OR selected_proof.before_row->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb
      OR selected_proof.before_row->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb
      OR selected_proof.before_row->'accepted_at' IS DISTINCT FROM 'null'::jsonb
      OR selected_occurrence.lifecycle IS DISTINCT FROM 'accepted' OR selected_occurrence.acquired_character_level IS DISTINCT FROM 1
      OR selected_occurrence.acquisition_operation_id IS DISTINCT FROM (j.receipt->>'operation_id')::uuid
      OR selected_occurrence.accepted_at IS DISTINCT FROM (j.receipt->>'accepted_at')::timestamptz
      OR selected_occurrence.selected_at>selected_occurrence.accepted_at
      OR selected_proof.after_row IS DISTINCT FROM pg_catalog.to_jsonb(selected_occurrence)
      OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['id','character_id','system_id','content_id','content_version','class_slug','selected_at','controller_ref_id']) key(name)
        WHERE selected_proof.before_row->name IS DISTINCT FROM selected_proof.after_row->name) THEN
      RAISE EXCEPTION 'Selected confirmation occurrence transition mismatch' USING ERRCODE='23514'; END IF;
  ELSIF (j.before_origin-ARRAY['command_revision']) IS DISTINCT FROM ((graph->'origin')-ARRAY['command_revision']) THEN
    RAISE EXCEPTION 'Other command cannot reseal origin' USING ERRCODE='23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.class_first_acquisition_proof_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inputs jsonb; parent_json jsonb; order_json jsonb; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Acquisition proof retained' USING ERRCODE='42501'; END IF;
  -- Independent refusal, including forged self-consistent journal/isolated role callers.
  IF TG_OP='UPDATE' AND OLD.phase='pending' AND NEW.phase='assigned' AND pg_catalog.pg_trigger_depth()<>2 THEN
    RAISE EXCEPTION 'first_class_assignment_requires_native_callback' USING ERRCODE='42501'; END IF;
  -- Exact sealed identity and actual phase tuples remain independent of caller-supplied evidence.
  inputs:=private.class_first_acquisition_inputs_v1(NEW.acceptance_id);
  IF NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
    OR NEW.transaction_id::text IS DISTINCT FROM inputs->>'transaction_id'
    OR NEW.target_character_id::text IS DISTINCT FROM inputs->>'target_character_id'
    OR NEW.verified_actor_id::text IS DISTINCT FROM inputs->>'verified_actor_id'
    OR NEW.operation_id::text IS DISTINCT FROM inputs->>'operation_id'
    OR NEW.before_parent IS DISTINCT FROM inputs->'before_parent' OR NEW.before_order IS DISTINCT FROM inputs->'before_order'
    OR NEW.expected_after_graph IS DISTINCT FROM inputs->'expected_after_graph' OR NEW.planned_rows IS DISTINCT FROM inputs->'planned_rows'
    OR pg_catalog.octet_length(pg_catalog.to_jsonb(NEW)::text)>8388608 THEN
    RAISE EXCEPTION 'Bounded native acquisition proof identity required' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (pg_catalog.to_jsonb(NEW)-ARRAY['phase','observed_parent','observed_order'])
    IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)-ARRAY['phase','observed_parent','observed_order']) THEN
    RAISE EXCEPTION 'Immutable acquisition proof identity' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text) INTO parent_json
    FROM public.characters c WHERE c.id=NEW.target_character_id AND c.user_id=NEW.verified_actor_id;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text) INTO order_json
    FROM private.character_projection_order_v1 o WHERE o.character_id=NEW.target_character_id;
  IF TG_OP='INSERT' AND (NEW.phase<>'pending' OR parent_json IS DISTINCT FROM NEW.before_parent OR order_json IS DISTINCT FROM NEW.before_order)
    OR TG_OP='UPDATE' AND NOT COALESCE((OLD.phase='pending' AND NEW.phase='assigned'
      AND parent_json=NEW.before_parent AND order_json=NEW.before_order)
      OR (OLD.phase='assigned' AND NEW.phase='observed' AND parent_json=NEW.expected_after_graph->'parent'
        AND order_json=NEW.expected_after_graph->'order' AND NEW.observed_parent=parent_json AND NEW.observed_order=order_json),false) THEN
    RAISE EXCEPTION 'Exact pending assigned observed sequence required' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.hit_die_character_revision_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event private.class_origin_revision_events_v1%ROWTYPE; event_count bigint; candidate jsonb; first_proof private.class_first_acquisition_proofs_v1%ROWTYPE;
  first_count bigint; first_inputs jsonb; actual_before jsonb; actual_after jsonb;
BEGIN
  -- Finite first-class native BEFORE callback. The old metadata and ordinary
  -- branches remain byte-identical below this branch.
  SELECT pg_catalog.count(*) INTO first_count FROM private.class_first_acquisition_proofs_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=OLD.id;
  IF first_count>0 THEN
    IF first_count<>1 OR EXISTS(SELECT 1 FROM private.class_origin_revision_events_v1
        WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=OLD.id) THEN
      RAISE EXCEPTION 'first_class_revision_event_conflict' USING ERRCODE='23514'; END IF;
    SELECT * INTO first_proof FROM private.class_first_acquisition_proofs_v1
      WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=OLD.id;
    first_inputs:=private.class_first_acquisition_inputs_v1(first_proof.acceptance_id);
    actual_before:=pg_catalog.to_jsonb(OLD)||pg_catalog.jsonb_build_object('action_revision',OLD.action_revision::text);
    IF first_proof.phase<>'pending' OR OLD.action_revision<>0 OR NEW.action_revision IS DISTINCT FROM OLD.action_revision
      OR first_proof.verified_actor_id IS DISTINCT FROM OLD.user_id
      OR first_proof.before_parent IS DISTINCT FROM actual_before OR actual_before IS DISTINCT FROM first_inputs->'before_parent'
      OR NEW.choices IS NOT DISTINCT FROM OLD.choices
      OR NEW.choices IS DISTINCT FROM first_inputs->'expected_after_graph'->'parent'->'choices'
      OR (pg_catalog.to_jsonb(NEW)-ARRAY['choices','action_revision']) IS DISTINCT FROM
        (pg_catalog.to_jsonb(OLD)-ARRAY['choices','action_revision']) THEN
      RAISE EXCEPTION 'first_class_native_old_new_mismatch' USING ERRCODE='23514'; END IF;
    NEW.action_revision:=OLD.action_revision+1;
    actual_after:=pg_catalog.to_jsonb(NEW)||pg_catalog.jsonb_build_object('action_revision',NEW.action_revision::text);
    IF actual_after IS DISTINCT FROM first_inputs->'expected_after_graph'->'parent' THEN
      RAISE EXCEPTION 'first_class_native_new_mismatch' USING ERRCODE='23514'; END IF;
    UPDATE private.class_first_acquisition_proofs_v1 SET phase='assigned'
      WHERE acceptance_id=first_proof.acceptance_id AND phase='pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'first_class_assignment_missing' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;

  SELECT pg_catalog.count(*) INTO event_count FROM private.class_origin_revision_events_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=OLD.id;
  IF event_count>0 THEN
    SELECT * INTO event FROM private.class_origin_revision_events_v1
      WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=OLD.id;
    IF event_count<>1 OR event.phase<>'pending' OR OLD.action_revision=9223372036854775807
      OR NEW.action_revision IS DISTINCT FROM OLD.action_revision+1
      OR event.before_action_revision IS DISTINCT FROM OLD.action_revision OR event.after_action_revision IS DISTINCT FROM NEW.action_revision
      OR event.verified_actor_id IS DISTINCT FROM OLD.user_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR event.before_parent IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)||pg_catalog.jsonb_build_object('action_revision',OLD.action_revision::text))
      OR event.expected_after_parent IS DISTINCT FROM (pg_catalog.to_jsonb(NEW)||pg_catalog.jsonb_build_object('action_revision',NEW.action_revision::text)) THEN
      RAISE EXCEPTION 'Exact one pending metadata revision required' USING ERRCODE='23514'; END IF;
    candidate:=private.class_origin_metadata_delta_v1(event.acceptance_id);
    IF candidate->'acceptance_finalized' IS DISTINCT FROM 'false'::jsonb OR candidate->'revision_transition_consumed' IS DISTINCT FROM 'false'::jsonb
      OR candidate->>'target_character_id' IS DISTINCT FROM OLD.id::text
      OR (pg_catalog.to_jsonb(OLD)-'action_revision') IS DISTINCT FROM (pg_catalog.to_jsonb(NEW)-'action_revision') THEN
      RAISE EXCEPTION 'No mixed mechanical metadata branch' USING ERRCODE='23514'; END IF;
    NEW.action_revision:=OLD.action_revision+1;
    UPDATE private.class_origin_revision_events_v1 SET phase='assigned' WHERE acceptance_id=event.acceptance_id AND phase='pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'Metadata revision already assigned' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  IF (NEW.state,NEW.base_stats,NEW.choices,NEW.level,NEW.system_id,NEW.campaign_id,NEW.archived,NEW.user_id)
    IS DISTINCT FROM (OLD.state,OLD.base_stats,OLD.choices,OLD.level,OLD.system_id,OLD.campaign_id,OLD.archived,OLD.user_id) THEN
    IF OLD.action_revision = 9223372036854775807 THEN RAISE EXCEPTION 'Revision exhausted' USING ERRCODE = '22003'; END IF;
    NEW.action_revision := OLD.action_revision + 1;
  ELSE
    IF NEW.action_revision IS DISTINCT FROM OLD.action_revision THEN RAISE EXCEPTION 'Revision is database controlled' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.prune_inactive_asi_choices_before_choices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retained_choices jsonb; first_envelope jsonb; first_before jsonb; first_after jsonb;
BEGIN
  -- NULL means an unenrolled legacy target only; an enrolled target without
  -- the exact current-xid plan/journal/actor/grants state refuses in B2.
  first_envelope:=private.first_class_materialization_inputs_v1(NEW.id,'grants');
  IF first_envelope IS NOT NULL THEN
    first_before:=pg_catalog.to_jsonb(OLD)||pg_catalog.jsonb_build_object('action_revision',OLD.action_revision::text);
    first_after:=pg_catalog.to_jsonb(NEW)||pg_catalog.jsonb_build_object('action_revision',NEW.action_revision::text);
    IF TG_OP<>'UPDATE' OR OLD.action_revision<>0 OR NEW.action_revision<>1
      OR OLD.choices IS DISTINCT FROM '{}'::jsonb
      OR first_before IS DISTINCT FROM first_envelope->'before_parent'
      OR first_after IS DISTINCT FROM first_envelope->'expected_graph'->'parent'
      OR NEW.choices IS DISTINCT FROM pg_catalog.jsonb_build_object('classes',NEW.choices->'classes')
      OR pg_catalog.jsonb_array_length(NEW.choices->'classes')<>1
      OR NEW.choices#>'{classes,0,level}' IS DISTINCT FROM '1'::jsonb THEN
      RAISE EXCEPTION 'first_class_asi_prune_native_tuple_mismatch' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF pg_catalog.jsonb_typeof(NEW.choices->'asi_choices') <> 'object' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_object_agg(choice.key, choice.value), '{}'::jsonb)
  INTO retained_choices
  FROM pg_catalog.jsonb_each(NEW.choices->'asi_choices') AS choice(key, value)
  WHERE EXISTS (
    SELECT 1
    FROM public.character_feature_grants AS grant_row
    JOIN public.character_content_refs AS controller_ref
      ON controller_ref.id = grant_row.controller_ref_id
     AND controller_ref.character_id = grant_row.character_id
    JOIN public.content_versions AS controller
      ON controller.content_id = controller_ref.content_id
     AND controller.version = controller_ref.content_version
     AND controller.content_type_snapshot = grant_row.controller_type
     AND controller.slug_snapshot = grant_row.controller_slug
    JOIN public.content_versions AS feature
      ON feature.content_id = grant_row.feature_content_id
     AND feature.version = grant_row.feature_version
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(NEW.choices->'classes') = 'array'
          THEN NEW.choices->'classes'
        ELSE '[]'::jsonb
      END
    ) AS class_choice(value)
    WHERE grant_row.character_id = NEW.id
      AND grant_row.feature_slug = choice.key
      AND feature.data_snapshot->>'feature_type' = 'asi'
      AND COALESCE(class_choice.value->>'level', '') ~ '^[0-9]+$'
      AND (class_choice.value->>'level')::integer >= grant_row.unlock_level
      AND (
        (
          controller.content_type_snapshot = 'class'
          AND class_choice.value->>'slug' = controller.slug_snapshot
        )
        OR (
          controller.content_type_snapshot = 'subclass'
          AND class_choice.value->>'slug' = controller.data_snapshot->>'parent_class'
          AND class_choice.value->>'subclass' = controller.slug_snapshot
        )
      )
  );

  NEW.choices := pg_catalog.jsonb_set(
    NEW.choices,
    '{asi_choices}',
    retained_choices,
    true
  );
  RETURN NEW;
END;
$$;
ALTER FUNCTION private.read_first_class_plan_snapshot_v1(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION private.apply_first_class_public_rows_v1(uuid,text) OWNER TO postgres;
ALTER FUNCTION private.coordinate_first_class_command_v1(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION private.resolve_first_class_command_v1(jsonb,uuid,uuid,jsonb) OWNER TO inkborne_class_origin_owner;
ALTER FUNCTION private.begin_class_origin_acceptance_v1(jsonb,jsonb) OWNER TO inkborne_class_origin_owner;
ALTER FUNCTION private.class_first_acquisition_inputs_v1(uuid) OWNER TO inkborne_class_origin_owner;
ALTER FUNCTION private.class_origin_finalize_transition_v1(uuid) OWNER TO inkborne_class_origin_owner;
ALTER FUNCTION private.finish_first_class_choices_revision_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.observe_first_class_choices_revision_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.class_first_acquisition_proof_guard_v1() OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.hit_die_character_revision_v1() OWNER TO inkborne_hit_die_authority_owner;
ALTER FUNCTION private.prune_inactive_asi_choices_before_choices() OWNER TO postgres;
ALTER FUNCTION public.character_class_command_v1(jsonb,jsonb) OWNER TO inkborne_character_command_gateway_owner;

REVOKE ALL ON FUNCTION private.read_first_class_plan_snapshot_v1(uuid,uuid),private.apply_first_class_public_rows_v1(uuid,text),
  private.coordinate_first_class_command_v1(jsonb,jsonb),private.resolve_first_class_command_v1(jsonb,uuid,uuid,jsonb),
  private.finish_first_class_choices_revision_v1(jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner,inkborne_character_command_gateway_owner;
GRANT EXECUTE ON FUNCTION private.read_first_class_plan_snapshot_v1(uuid,uuid),private.apply_first_class_public_rows_v1(uuid,text)
  TO inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION private.begin_class_origin_acceptance_v1(jsonb,jsonb),
  private.resolve_first_class_command_v1(jsonb,uuid,uuid,jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION private.finish_first_class_choices_revision_v1(jsonb,uuid) TO inkborne_class_origin_owner;
-- Grouped closure above also revokes the two non-postgres owners. Restore only
-- their own expected EXECUTE; ownership alone does not imply an ACL EXEC right.
GRANT EXECUTE ON FUNCTION private.resolve_first_class_command_v1(jsonb,uuid,uuid,jsonb) TO inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION private.finish_first_class_choices_revision_v1(jsonb,uuid) TO inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.coordinate_first_class_command_v1(jsonb,jsonb) TO inkborne_character_command_gateway_owner;
REVOKE ALL ON FUNCTION public.character_class_command_v1(jsonb,jsonb)
  FROM PUBLIC,anon,authenticated,service_role,postgres;
GRANT EXECUTE ON FUNCTION public.character_class_command_v1(jsonb,jsonb) TO service_role;

-- Exactly one new parent column and four semantic arrays. Class and gateway
-- receive no public-child DML or choices/order semantic mutation capability.
GRANT UPDATE(choices) ON public.characters TO inkborne_hit_die_authority_owner;
GRANT UPDATE(pins,spells,feature_grants,spell_grants) ON private.character_projection_order_v1
  TO inkborne_hit_die_authority_owner;

-- These are finite row-scope RLS checks, not Auth or call-stack claims. The
-- independent BEFORE proof guard validates all native plan/phase/actual tuples.
ALTER POLICY class_first_proof_insert ON private.class_first_acquisition_proofs_v1 WITH CHECK
  (transaction_id=pg_catalog.pg_current_xact_id() AND mode='first_add_class_choices'
    AND before_action_revision=0 AND after_action_revision=1 AND before_class_revision=0 AND after_class_revision=1
    AND pg_catalog.jsonb_build_object('acceptance_id',acceptance_id,'transaction_id',transaction_id::text,
      'target_character_id',target_character_id,'verified_actor_id',verified_actor_id,'operation_id',operation_id,
      'before_parent',before_parent,'before_order',before_order,'expected_after_graph',expected_after_graph,'planned_rows',planned_rows)
      = (private.class_first_acquisition_inputs_v1(acceptance_id)-'verified_context'));
ALTER POLICY class_first_proof_insert_denied ON private.class_first_acquisition_proofs_v1 WITH CHECK
  (transaction_id=pg_catalog.pg_current_xact_id() AND mode='first_add_class_choices'
    AND before_action_revision=0 AND after_action_revision=1 AND before_class_revision=0 AND after_class_revision=1
    AND pg_catalog.jsonb_build_object('acceptance_id',acceptance_id,'transaction_id',transaction_id::text,
      'target_character_id',target_character_id,'verified_actor_id',verified_actor_id,'operation_id',operation_id,
      'before_parent',before_parent,'before_order',before_order,'expected_after_graph',expected_after_graph,'planned_rows',planned_rows)
      = (private.class_first_acquisition_inputs_v1(acceptance_id)-'verified_context'));
ALTER POLICY class_first_proof_update ON private.class_first_acquisition_proofs_v1 USING(true) WITH CHECK
  (transaction_id=pg_catalog.pg_current_xact_id() AND mode='first_add_class_choices'
    AND before_action_revision=0 AND after_action_revision=1 AND before_class_revision=0 AND after_class_revision=1
    AND pg_catalog.jsonb_build_object('acceptance_id',acceptance_id,'transaction_id',transaction_id::text,
      'target_character_id',target_character_id,'verified_actor_id',verified_actor_id,'operation_id',operation_id,
      'before_parent',before_parent,'before_order',before_order,'expected_after_graph',expected_after_graph,'planned_rows',planned_rows)
      = (private.class_first_acquisition_inputs_v1(acceptance_id)-'verified_context'));
ALTER POLICY class_first_proof_update_denied ON private.class_first_acquisition_proofs_v1 USING(true) WITH CHECK
  (transaction_id=pg_catalog.pg_current_xact_id() AND mode='first_add_class_choices'
    AND before_action_revision=0 AND after_action_revision=1 AND before_class_revision=0 AND after_class_revision=1
    AND pg_catalog.jsonb_build_object('acceptance_id',acceptance_id,'transaction_id',transaction_id::text,
      'target_character_id',target_character_id,'verified_actor_id',verified_actor_id,'operation_id',operation_id,
      'before_parent',before_parent,'before_order',before_order,'expected_after_graph',expected_after_graph,'planned_rows',planned_rows)
      = (private.class_first_acquisition_inputs_v1(acceptance_id)-'verified_context'));

DO $closure$
DECLARE wanted record; actual record; caller text;
BEGIN
 FOR wanted IN SELECT * FROM (VALUES
   ('private.read_first_class_plan_snapshot_v1(uuid,uuid)','postgres',ARRAY['postgres','inkborne_class_origin_owner']::text[]),
   ('private.apply_first_class_public_rows_v1(uuid,text)','postgres',ARRAY['postgres','inkborne_class_origin_owner']::text[]),
   ('private.coordinate_first_class_command_v1(jsonb,jsonb)','postgres',ARRAY['postgres','inkborne_character_command_gateway_owner']::text[]),
   ('private.resolve_first_class_command_v1(jsonb,uuid,uuid,jsonb)','inkborne_class_origin_owner',ARRAY['inkborne_class_origin_owner','postgres']::text[]),
   ('private.finish_first_class_choices_revision_v1(jsonb,uuid)','inkborne_hit_die_authority_owner',ARRAY['inkborne_hit_die_authority_owner','inkborne_class_origin_owner']::text[]),
   ('private.begin_class_origin_acceptance_v1(jsonb,jsonb)','inkborne_class_origin_owner',ARRAY['inkborne_class_origin_owner','postgres']::text[]),
   ('private.class_first_acquisition_inputs_v1(uuid)','inkborne_class_origin_owner',ARRAY['inkborne_class_origin_owner','inkborne_hit_die_authority_owner']::text[]),
   ('private.observe_first_class_choices_revision_v1(jsonb,uuid)','inkborne_hit_die_authority_owner',ARRAY['inkborne_hit_die_authority_owner','inkborne_class_origin_owner']::text[]),
   ('private.class_first_acquisition_proof_guard_v1()','inkborne_hit_die_authority_owner',ARRAY['inkborne_hit_die_authority_owner']::text[]),
   ('private.hit_die_character_revision_v1()','inkborne_hit_die_authority_owner',ARRAY['inkborne_hit_die_authority_owner']::text[]),
   ('public.character_class_command_v1(jsonb,jsonb)','inkborne_character_command_gateway_owner',ARRAY['inkborne_character_command_gateway_owner','service_role']::text[])
 ) expected(signature,owner_name,callers) LOOP
   SELECT * INTO actual FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(wanted.signature);
   IF pg_catalog.pg_get_userbyid(actual.proowner)<>wanted.owner_name OR NOT actual.prosecdef
     OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(actual.proacl,pg_catalog.acldefault('f',actual.proowner))) a
       WHERE a.grantee=0 OR NOT pg_catalog.pg_get_userbyid(a.grantee)=ANY(wanted.callers)
         OR (a.grantee<>actual.proowner AND a.is_grantable)) THEN
     RAISE EXCEPTION 'first_class_writer_unexpected_acl' USING ERRCODE='42501'; END IF;
   FOREACH caller IN ARRAY wanted.callers LOOP
     IF NOT pg_catalog.has_function_privilege(caller,actual.oid,'EXECUTE') THEN
       RAISE EXCEPTION 'first_class_writer_missing_execute' USING ERRCODE='42501',
         DETAIL=pg_catalog.format('signature=%s caller=%s',wanted.signature,caller); END IF;
   END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN
     ('anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner')
   AND (pg_catalog.has_function_privilege(r.oid,'private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','EXECUTE')
     OR pg_catalog.has_table_privilege(r.oid,'private.class_first_protected_plans_v1','SELECT')
     OR pg_catalog.has_table_privilege(r.oid,'private.class_first_protected_plans_v1','INSERT')))
   OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
   RAISE EXCEPTION 'first_class_writer_no_mint_boundary' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN
   ('anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner')
   AND (pg_catalog.has_any_column_privilege(r.oid,'private.class_first_protected_plans_v1','SELECT,INSERT,UPDATE,REFERENCES')
     OR pg_catalog.has_table_privilege(r.oid,'private.class_first_protected_plans_v1','DELETE,TRUNCATE,TRIGGER,MAINTAIN'))) THEN
   RAISE EXCEPTION 'first_class_writer_no_mint_column_boundary' USING ERRCODE='42501'; END IF;
END; $closure$;

COMMIT;
