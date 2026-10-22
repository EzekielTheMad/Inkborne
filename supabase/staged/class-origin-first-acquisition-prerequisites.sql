-- SOURCE ONLY / UNAPPLIED. Reviewed PLAN bc9ec36; fixed root710c3fc.
-- Dependency Git blobs; STATIC source bindings, NOT native installation receipts:
-- class-origin-command-schema.ts d935b7c1bb14dedce381499ab3f21abb50efa96a
-- Producer/bootstrap include the reviewed 2026-10-22 SQL corrections and pin update.
-- class-origin-producer.sql 3ad143c239c404f2393a14fb98eb46fc223c46cd
-- class-origin-joint-revision.sql d07ce2f53b0af06950ae3eb46006906e804701ed
-- class-origin-fresh-bootstrap.sql 8d48cb0c8f3e41a3e186e9bf2046cd114c90ffcc
-- hit-die-authority-and-writers.sql 7f8650efc96617063cf03e6ea4c5763f684ce72c
-- 20260720185127_feature_grant_integrity.sql 57aeceb8b06aa0dd13a597e3e24747991ef58a73
-- 20260720185149_feature_spell_grants.sql 2c1a957971b0b677e48d3303c0ea99c4285b482d
-- 20260720185305_character_content_boundary_guards.sql 7a99c4e92fbb3005f13c7fd2052e6d06a96017b5
-- AFTER unchanged bootstrap. No materializer/native updater/row planner/issuer.
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

DO $$ DECLARE item record; installation_owner oid; class_oid oid; authority_oid oid; BEGIN
  SELECT oid INTO class_oid FROM pg_catalog.pg_roles WHERE rolname='inkborne_class_origin_owner';
  SELECT oid INTO authority_oid FROM pg_catalog.pg_roles WHERE rolname='inkborne_hit_die_authority_owner';
  SELECT relowner INTO installation_owner FROM pg_catalog.pg_class WHERE oid='private.class_writer_acceptance_v1'::regclass;
  IF installation_owner IS DISTINCT FROM current_user::regrole::oid OR installation_owner IN(class_oid,authority_oid)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid IN('private.character_class_origin_v1'::regclass,
      'private.character_class_occurrences_v1'::regclass,'private.character_class_commands_v1'::regclass,
      'private.character_creation_commands_v1'::regclass) AND relowner IS DISTINCT FROM installation_owner) THEN
    RAISE EXCEPTION 'Exact original installation table owner required' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('private.class_origin_finalize_transition_v1(uuid)','inkborne_class_origin_owner','77280d37e324bc8f47225da854e2212a',false,'void'),
    ('private.class_origin_observed_revision_v1(uuid)','inkborne_class_origin_owner','f1c8f1e48f8ca3e02fea25b41acebcea',true,'jsonb'),
    ('private.class_origin_assert_metadata_revision_v1(uuid)','inkborne_class_origin_owner','2e69575a1068fdf2e67891143783e2eb',true,'void'),
    ('private.hit_die_character_revision_v1()','inkborne_hit_die_authority_owner','337273b12b34e058c3563116cb134580',true,'trigger')
  ) frozen(signature,owner_name,body_md5,is_definer,return_type) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner JOIN pg_catalog.pg_language l ON l.oid=p.prolang
      WHERE p.oid=pg_catalog.to_regprocedure(item.signature) AND r.rolname=item.owner_name AND p.prosecdef=item.is_definer
      AND p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[] AND l.lanname='plpgsql'
      AND NOT p.proretset AND p.prokind='f' AND p.provolatile='v' AND p.prorettype=pg_catalog.to_regtype(item.return_type)
      AND pg_catalog.md5(pg_catalog.replace(p.prosrc,E'\r\n',E'\n'))=item.body_md5) THEN
      RAISE EXCEPTION 'Original joint dependency drift: %',item.signature USING ERRCODE='42501'; END IF;
  END LOOP;
END $$;

-- New installation-owned proof relation: normal existing-parent FK, no bootstrap variant.
CREATE TABLE private.class_first_acquisition_proofs_v1 (
  acceptance_id uuid PRIMARY KEY REFERENCES private.class_writer_acceptance_v1(acceptance_id),
  transaction_id xid8 NOT NULL,
  target_character_id uuid NOT NULL REFERENCES public.characters(id),
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
);
-- Implicit owner is the EXACT original installation owner checked above; never a runtime role.
ALTER TABLE private.class_first_acquisition_proofs_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.class_first_acquisition_proofs_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.class_first_acquisition_proofs_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY class_first_proof_authority_read ON private.class_first_acquisition_proofs_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING(true);
CREATE POLICY class_first_proof_class_read ON private.class_first_acquisition_proofs_v1 FOR SELECT TO inkborne_class_origin_owner USING(true);
CREATE POLICY class_first_proof_insert ON private.class_first_acquisition_proofs_v1 FOR INSERT TO inkborne_hit_die_authority_owner WITH CHECK(false);
CREATE POLICY class_first_proof_insert_denied ON private.class_first_acquisition_proofs_v1 AS RESTRICTIVE FOR INSERT TO inkborne_hit_die_authority_owner WITH CHECK(false);
CREATE POLICY class_first_proof_update ON private.class_first_acquisition_proofs_v1 FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(false);
CREATE POLICY class_first_proof_update_denied ON private.class_first_acquisition_proofs_v1 AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(false);

-- Class-private inputs. No current-row/fixture graph can establish NEW native lineage.
CREATE FUNCTION private.class_first_acquisition_inputs_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE j private.class_writer_acceptance_v1%ROWTYPE; bootstrap private.class_writer_acceptance_v1%ROWTYPE;
  creation private.character_creation_commands_v1%ROWTYPE; occurrence jsonb; matches bigint; BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND enabled) THEN
    RAISE EXCEPTION 'first_acquisition_prerequisite_unavailable' USING ERRCODE='P0001'; END IF;
  RAISE EXCEPTION 'first_acquisition_prerequisite_unavailable' USING ERRCODE='P0001';
  -- Unreachable shape/closure contract; canonical row planning/materializer/native writer bridge absent.
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
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
    OR (j.expected_graph->'parent'-ARRAY['choices','action_revision']) IS DISTINCT FROM (j.before_parent-ARRAY['choices','action_revision'])
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
    'before_parent',j.before_parent,'before_order',bootstrap.expected_graph->'order','expected_after_graph',j.expected_graph,'planned_rows',j.planned_transitions);
END $$;
ALTER FUNCTION private.class_first_acquisition_inputs_v1(uuid) OWNER TO inkborne_class_origin_owner;

-- No UPDATE here. Genuine OLD/RETURNING provenance is unavailable until separately reviewed child B.
CREATE FUNCTION private.observe_first_class_choices_revision_v1(p_context jsonb,p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE inputs jsonb; c public.characters%ROWTYPE; ordering private.character_projection_order_v1%ROWTYPE; BEGIN
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  PERFORM private.lock_character_writer_guard_v1();
  inputs:=private.class_first_acquisition_inputs_v1(p_acceptance);
  SELECT * INTO c FROM public.characters WHERE id=(inputs->>'target_character_id')::uuid AND user_id=(p_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND OR c.user_id::text IS DISTINCT FROM inputs->>'verified_actor_id' THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  IF pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'native_auth_expired' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'first_acquisition_write_provenance_unavailable' USING ERRCODE='P0001';
  -- Readback cannot substitute for actual guarded UPDATE OLD + typed RETURNING.
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=c.id;
  IF NOT FOUND OR c.action_revision<>1 OR ordering.producer_version<>1 OR ordering.producer_revision<>1
    OR (inputs#>'{before_parent,choices,classes}') IS NOT DISTINCT FROM (pg_catalog.to_jsonb(c)#>'{choices,classes}')
    OR c.action_revision<>(inputs#>>'{before_parent,action_revision}')::bigint+1
    OR (pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text)) IS DISTINCT FROM inputs#>'{expected_after_graph,parent}'
    OR (pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text)) IS DISTINCT FROM inputs#>'{expected_after_graph,order}' THEN
    RAISE EXCEPTION 'Ordinary changed choices OLD+1 and order readback required' USING ERRCODE='23514'; END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_context);
  IF pg_catalog.clock_timestamp()>=(p_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'native_auth_expired' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'first_acquisition_write_provenance_unavailable' USING ERRCODE='P0001';
END $$;
ALTER FUNCTION private.observe_first_class_choices_revision_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.class_first_acquisition_proof_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inputs jsonb; parent_json jsonb; order_json jsonb; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Acquisition proof retained' USING ERRCODE='42501'; END IF;
  -- Independent refusal, including forged self-consistent journal/isolated role callers.
  RAISE EXCEPTION 'first_acquisition_prerequisite_unavailable' USING ERRCODE='P0001';
  -- Future protocol checks do not prove an actual UPDATE. Independent denial remains above them.
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
ALTER FUNCTION private.class_first_acquisition_proof_guard_v1() OWNER TO inkborne_hit_die_authority_owner;

-- INTERNAL pre-finalized evidence validator: no receipt INSERT/finalized requirement.
CREATE FUNCTION private.class_first_acquisition_observed_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE inputs jsonb; proof private.class_first_acquisition_proofs_v1%ROWTYPE; parent_json jsonb; order_json jsonb; graph jsonb; BEGIN
  inputs:=private.class_first_acquisition_inputs_v1(p_acceptance); -- Independently unavailable.
  SELECT * INTO proof FROM private.class_first_acquisition_proofs_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND OR proof.mode<>'first_add_class_choices' OR proof.phase<>'observed'
    OR proof.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
    OR proof.transaction_id::text IS DISTINCT FROM inputs->>'transaction_id'
    OR proof.target_character_id::text IS DISTINCT FROM inputs->>'target_character_id'
    OR proof.verified_actor_id::text IS DISTINCT FROM inputs->>'verified_actor_id'
    OR proof.operation_id::text IS DISTINCT FROM inputs->>'operation_id'
    OR proof.before_parent IS DISTINCT FROM inputs->'before_parent' OR proof.before_order IS DISTINCT FROM inputs->'before_order'
    OR proof.expected_after_graph IS DISTINCT FROM inputs->'expected_after_graph' OR proof.planned_rows IS DISTINCT FROM inputs->'planned_rows' THEN
    RAISE EXCEPTION 'Observed ordinary acquisition proof identity required' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text) INTO parent_json
    FROM public.characters c WHERE c.id=proof.target_character_id AND c.user_id=proof.verified_actor_id;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text) INTO order_json
    FROM private.character_projection_order_v1 o WHERE o.character_id=proof.target_character_id;
  graph:=private.class_origin_read_final_graph_v1(proof.target_character_id,ARRAY(
    SELECT (value->>'id')::uuid FROM pg_catalog.jsonb_array_elements(proof.expected_after_graph->'occurrences')));
  IF parent_json IS DISTINCT FROM proof.expected_after_graph->'parent' OR parent_json IS DISTINCT FROM proof.observed_parent
    OR order_json IS DISTINCT FROM proof.expected_after_graph->'order' OR order_json IS DISTINCT FROM proof.observed_order
    OR graph IS DISTINCT FROM proof.expected_after_graph
    OR parent_json->>'action_revision' IS DISTINCT FROM '1' OR order_json->>'producer_revision' IS DISTINCT FROM '1'
    OR parent_json#>'{choices,classes}' IS NOT DISTINCT FROM proof.before_parent#>'{choices,classes}' THEN
    RAISE EXCEPTION 'Actual ordinary parent order full graph mismatch' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.to_jsonb(proof);
END $$;
ALTER FUNCTION private.class_first_acquisition_observed_v1(uuid) OWNER TO inkborne_class_origin_owner;

CREATE FUNCTION private.assert_first_class_choices_revision_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; graph jsonb; BEGIN
  PERFORM private.class_first_acquisition_observed_v1(p_acceptance);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND OR NOT j.finalized OR NOT j.revision_transition_consumed
    OR NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1 AS command WHERE command.character_id=j.target_character_id
      AND command.operation_id=(j.receipt->>'operation_id')::uuid AND command.receipt=j.receipt) THEN
    RAISE EXCEPTION 'Finalized ordinary acquisition receipt required' USING ERRCODE='23514'; END IF;
  graph:=private.class_origin_assert_common_v1(p_acceptance);
  IF graph IS DISTINCT FROM j.expected_graph THEN RAISE EXCEPTION 'Finalized acquisition full graph required' USING ERRCODE='23514'; END IF;
END $$;
ALTER FUNCTION private.assert_first_class_choices_revision_v1(uuid) OWNER TO inkborne_class_origin_owner;

CREATE FUNCTION private.consume_first_class_choices_revision_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE changed bigint; BEGIN
  PERFORM private.class_first_acquisition_observed_v1(p_acceptance);
  UPDATE private.class_writer_acceptance_v1 SET revision_transition_consumed=true
    WHERE acceptance_id=p_acceptance AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized AND NOT revision_transition_consumed;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Revision proof is one use' USING ERRCODE='42501'; END IF;
END $$;
ALTER FUNCTION private.consume_first_class_choices_revision_v1(uuid) OWNER TO inkborne_class_origin_owner;

CREATE FUNCTION private.class_first_acquisition_proof_closure_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  -- Re-read retained current event; historical pending row versions are never acceptance.
  PERFORM private.assert_first_class_choices_revision_v1(NEW.acceptance_id);
  RETURN NULL;
END $$;
ALTER FUNCTION private.class_first_acquisition_proof_closure_v1() OWNER TO inkborne_class_origin_owner;

-- Only these TWO original class callbacks change; bootstrap/metadata/R09 revision bodies stay frozen.

CREATE OR REPLACE FUNCTION private.class_origin_acceptance_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE parent public.characters%ROWTYPE; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Journal retained' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.finalized OR (pg_catalog.to_jsonb(NEW)-ARRAY['finalized','revision_transition_consumed'])
      IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)-ARRAY['finalized','revision_transition_consumed'])
      OR (OLD.revision_transition_consumed AND NOT NEW.revision_transition_consumed) THEN
      RAISE EXCEPTION 'Immutable acceptance evidence' USING ERRCODE='42501';
    END IF;
    IF NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() THEN RAISE EXCEPTION 'Transaction mismatch' USING ERRCODE='42501'; END IF;
    IF NOT OLD.revision_transition_consumed AND NEW.revision_transition_consumed THEN
      IF NEW.receipt#>>'{canonical_intent,command}'='add_class' THEN
        PERFORM private.class_first_acquisition_observed_v1(NEW.acceptance_id);
      ELSIF NEW.receipt#>>'{canonical_intent,command}'='confirm_origin' THEN
        PERFORM private.class_origin_observed_revision_v1(NEW.acceptance_id);
      ELSE RAISE EXCEPTION 'Class command prerequisite unavailable' USING ERRCODE='P0001'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  PERFORM private.lock_character_writer_guard_v1();
  IF NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR NEW.finalized OR NEW.revision_transition_consumed THEN
    RAISE EXCEPTION 'Invalid initial acceptance' USING ERRCODE='23514'; END IF;
  IF (SELECT pg_catalog.count(DISTINCT pg_catalog.jsonb_build_array(value->'relation_key',value->'row_key')) FROM pg_catalog.jsonb_array_elements(NEW.planned_transitions))
      <>pg_catalog.jsonb_array_length(NEW.planned_transitions)
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.planned_transitions) WHERE NOT COALESCE(private.class_origin_exact_keys_v1(value,
      ARRAY['relation_key','row_key','before_row','after_row']),false)) THEN
    RAISE EXCEPTION 'Unique exact planned transitions required' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.planned_transitions) transition
    WHERE NOT private.class_origin_row_scope_v1(transition->>'relation_key',NULLIF(transition->'before_row','null'::jsonb),NEW.target_character_id,NEW.verified_actor_id)
      OR NOT private.class_origin_row_scope_v1(transition->>'relation_key',NULLIF(transition->'after_row','null'::jsonb),NEW.target_character_id,NEW.verified_actor_id)
      OR transition->'before_row' IS DISTINCT FROM 'null'::jsonb AND private.class_origin_row_key_v1(transition->>'relation_key',transition->'before_row') IS DISTINCT FROM transition->'row_key'
      OR transition->'after_row' IS DISTINCT FROM 'null'::jsonb AND private.class_origin_row_key_v1(transition->>'relation_key',transition->'after_row') IS DISTINCT FROM transition->'row_key') THEN
    RAISE EXCEPTION 'Planned row target actor or immutable key mismatch' USING ERRCODE='42501'; END IF;
  IF NEW.acceptance_kind='class_transition' THEN
    SELECT * INTO parent FROM public.characters WHERE id=NEW.target_character_id FOR UPDATE;
    IF NOT FOUND OR parent.user_id<>NEW.verified_actor_id
      OR (pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object('action_revision',parent.action_revision::text)) IS DISTINCT FROM NEW.before_parent
      OR NEW.preinsert_proof IS NOT NULL THEN RAISE EXCEPTION 'Actual before parent mismatch' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM private.character_class_origin_v1 origin WHERE origin.character_id=parent.id AND
      (pg_catalog.to_jsonb(origin)||pg_catalog.jsonb_build_object('command_revision',origin.command_revision::text))=NEW.before_origin) THEN
      RAISE EXCEPTION 'Actual before origin mismatch' USING ERRCODE='23514'; END IF;
  ELSE
    -- Immediate pre-INSERT capture under exclusive guard + internal all-row SELECT;
    -- no caller boolean, supplied proof, or later hidden-RLS absence inference.
    IF NEW.before_parent IS NOT NULL OR NEW.before_origin IS NOT NULL OR NEW.preinsert_proof IS NOT NULL
      OR EXISTS(SELECT 1 FROM public.characters WHERE id=NEW.target_character_id)
      OR EXISTS(SELECT 1 FROM private.character_class_origin_v1 WHERE character_id=NEW.target_character_id)
      OR EXISTS(SELECT 1 FROM private.character_projection_order_v1 WHERE character_id=NEW.target_character_id) THEN
      RAISE EXCEPTION 'Bootstrap target not absent before INSERT' USING ERRCODE='23514'; END IF;
    NEW.preinsert_proof:=pg_catalog.jsonb_build_object('acceptance_id',NEW.acceptance_id,'target_character_id',NEW.target_character_id,
      'transaction_id',NEW.transaction_id::text,'captured_at',pg_catalog.clock_timestamp());
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION private.class_origin_acceptance_guard_v1() OWNER TO inkborne_class_origin_owner;
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
  ELSIF (j.before_origin-ARRAY['command_revision']) IS DISTINCT FROM (graph->'origin'-ARRAY['command_revision']) THEN
    RAISE EXCEPTION 'Other command cannot reseal origin' USING ERRCODE='23514';
  END IF;
END $$;
ALTER FUNCTION private.class_origin_finalize_transition_v1(uuid) OWNER TO inkborne_class_origin_owner;

CREATE TRIGGER class_first_acquisition_proof_guard BEFORE INSERT OR UPDATE OR DELETE ON private.class_first_acquisition_proofs_v1
  FOR EACH ROW EXECUTE FUNCTION private.class_first_acquisition_proof_guard_v1();
CREATE CONSTRAINT TRIGGER class_first_acquisition_proof_closure AFTER INSERT OR UPDATE ON private.class_first_acquisition_proofs_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.class_first_acquisition_proof_closure_v1();
REVOKE ALL ON FUNCTION private.class_first_acquisition_inputs_v1(uuid),private.observe_first_class_choices_revision_v1(jsonb,uuid),
  private.class_first_acquisition_proof_guard_v1(),private.class_first_acquisition_observed_v1(uuid),
  private.assert_first_class_choices_revision_v1(uuid),private.consume_first_class_choices_revision_v1(uuid),private.class_first_acquisition_proof_closure_v1()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON private.class_first_acquisition_proofs_v1 TO inkborne_hit_die_authority_owner;
GRANT UPDATE(phase,observed_parent,observed_order) ON private.class_first_acquisition_proofs_v1 TO inkborne_hit_die_authority_owner;
GRANT SELECT ON private.class_first_acquisition_proofs_v1 TO inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION private.class_first_acquisition_inputs_v1(uuid) TO inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.observe_first_class_choices_revision_v1(jsonb,uuid) TO inkborne_class_origin_owner;
-- No issuer/updater/materializer/ref grants/public entry. All original 13 readiness rows remain false.
COMMIT;
