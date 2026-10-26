-- STAGED ONLY: finite enrolled parent UPDATE admission, after builder HP parity.
-- Child, access, copy, campaign and provider/RI lifecycle closure remain OPEN.
BEGIN;
DO $preflight$
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regclass('private.character_parent_admissions_v1') IS NOT NULL
    OR pg_catalog.to_regprocedure('private.describe_builder_subclass_update_v1(uuid,uuid,integer)') IS NULL
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)')
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))='6f4e810b99cfd755babcc0fc058c2431')
    OR pg_catalog.has_schema_privilege('anon','private','USAGE')
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls)
    OR NOT pg_catalog.has_table_privilege('postgres','private.character_class_origin_v1','SELECT')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='inkborne_class_origin_owner'
      AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid='inkborne_class_origin_owner'::pg_catalog.regrole OR member='inkborne_class_origin_owner'::pg_catalog.regrole)
    OR NOT pg_catalog.has_table_privilege('inkborne_class_origin_owner','private.character_class_origin_v1','SELECT')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='private.character_class_origin_v1'::pg_catalog.regclass
      AND polname='class_origin_internal_read' AND polcmd='r' AND polpermissive
      AND polroles=ARRAY['inkborne_class_origin_owner'::pg_catalog.regrole::oid] AND pg_catalog.pg_get_expr(polqual,polrelid)='true')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='private.character_class_origin_v1'::pg_catalog.regclass
      AND NOT polpermissive AND polcmd IN ('r','*') AND (polroles @> ARRAY['inkborne_class_origin_owner'::pg_catalog.regrole::oid] OR polroles @> ARRAY[0::oid]))
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid='private.lock_character_writer_guard_v1()'::pg_catalog.regprocedure
      AND proowner='inkborne_hit_die_authority_owner'::pg_catalog.regrole AND NOT prosecdef AND provolatile='v'
      AND proconfig=ARRAY['search_path=""']::text[] AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))='f7efb029110ebb9e486b1a3b9b8f8779') THEN
    RAISE EXCEPTION 'parent_admission_installation_unavailable' USING ERRCODE='42501'; END IF;
END $preflight$;

-- Migration 00041 deliberately grants authenticated USAGE for campaign policy
-- helpers. Preserve that admitted schema profile; do not revoke it or grant
-- schema access as a side effect of installing the guard-only public bridge.
CREATE TEMP TABLE pg_temp.parent_private_schema_v1 ON COMMIT DROP AS
  SELECT pg_catalog.to_jsonb(n) AS profile FROM pg_catalog.pg_namespace n WHERE n.nspname='private';
CREATE TEMP TABLE pg_temp.parent_private_schema_roles_v1 ON COMMIT DROP AS
  SELECT role_name,pg_catalog.has_schema_privilege(role_name,'private','USAGE') AS usage_allowed,
    pg_catalog.has_schema_privilege(role_name,'private','CREATE') AS create_allowed
  FROM pg_catalog.unnest(ARRAY['anon','authenticated','service_role']) role_name;

-- Capture the seven original trigger wires and callback definitions for exact
-- post-install preservation. The install admits no extra pre-existing trigger.
CREATE TEMP TABLE pg_temp.parent_original_triggers_v1 ON COMMIT DROP AS
  SELECT t.tgname,pg_catalog.to_jsonb(t)-'oid' AS wire,p.prosrc,p.proowner,p.proacl,p.proconfig,p.prosecdef,p.provolatile
  FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
  WHERE t.tgrelid='public.characters'::pg_catalog.regclass AND NOT t.tgisinternal;
DO $trigger_preflight$
DECLARE actual jsonb;
BEGIN
  SELECT pg_catalog.jsonb_object_agg(t.tgname,pg_catalog.jsonb_build_array(t.tgtype,t.tgfoid::pg_catalog.regprocedure::text,
    COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY c.position)
      FROM pg_catalog.unnest(t.tgattr::smallint[]) WITH ORDINALITY c(attnum,position)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=c.attnum),'[]'::jsonb))) INTO actual
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.characters'::pg_catalog.regclass AND NOT t.tgisinternal;
  IF (SELECT array_agg(tgname::text ORDER BY tgname) FROM pg_temp.parent_original_triggers_v1) IS DISTINCT FROM ARRAY[
    'enforce_asi_choice_map_boundary','enforce_background_choice_map_boundary','hit_die_character_revision',
    'hit_die_order_revision_rebind','prune_inactive_asi_choices_before_choices','prune_inactive_feature_refs_after_choices','validate_character_content_boundaries']::text[]
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.characters'::pg_catalog.regclass AND NOT tgisinternal
      AND (tgenabled<>'O' OR tgdeferrable OR tginitdeferred OR tgnargs<>0 OR pg_catalog.octet_length(tgargs)<>0 OR tgqual IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid='private.hit_die_character_revision_v1()'::pg_catalog.regprocedure
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))='857950f1a88305838220494f068e5cf5')
    OR actual IS DISTINCT FROM '{
      "enforce_asi_choice_map_boundary":[19,"private.enforce_asi_choice_map_boundary()",["choices"]],
      "enforce_background_choice_map_boundary":[23,"private.enforce_background_choice_map_boundary()",["choices"]],
      "hit_die_character_revision":[19,"private.hit_die_character_revision_v1()",[]],
      "hit_die_order_revision_rebind":[17,"private.hit_die_order_revision_rebind_v1()",[]],
      "prune_inactive_asi_choices_before_choices":[19,"private.prune_inactive_asi_choices_before_choices()",["choices"]],
      "prune_inactive_feature_refs_after_choices":[17,"private.prune_inactive_feature_refs_after_choices()",["choices"]],
      "validate_character_content_boundaries":[17,"private.validate_character_content_boundaries()",["campaign_id","system_id"]]
    }'::jsonb THEN
    RAISE EXCEPTION 'parent_admission_trigger_preimage_changed' USING ERRCODE='42501'; END IF;
END $trigger_preflight$;
CREATE TEMP TABLE pg_temp.parent_bridge_roles_v1 ON COMMIT DROP AS
  SELECT role_name FROM pg_catalog.unnest(ARRAY['authenticated','service_role']) role_name
  WHERE pg_catalog.has_function_privilege(role_name,'public.save_character_abilities(uuid,text,jsonb,text,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege(role_name,'public.patch_character_state_if_current(uuid,jsonb,jsonb)','EXECUTE');

-- Existing native postgres has BYPASSRLS but is not a superuser. Pin that
-- posture on every call: policy drift cannot hide enrollment, while owner or
-- visibility drift raises rather than becoming apparent legacy absence.
CREATE FUNCTION private.enrolled_character_parent_v1(target uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=off AS $$
BEGIN
  IF CURRENT_USER<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname=CURRENT_USER AND NOT rolsuper AND rolbypassrls) THEN
    RAISE EXCEPTION 'parent_enrollment_visibility_unavailable' USING ERRCODE='42501'; END IF;
  RETURN EXISTS(SELECT 1 FROM private.character_class_origin_v1 WHERE character_id=target);
END;
$$;
ALTER FUNCTION private.enrolled_character_parent_v1(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enrolled_character_parent_v1(uuid) FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

CREATE FUNCTION private.lock_enrolled_parent_guard_v1() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.lock_character_writer_guard_v1(); END $$;
ALTER FUNCTION private.lock_enrolled_parent_guard_v1() OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.lock_enrolled_parent_guard_v1() FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION private.lock_enrolled_parent_guard_v1() TO postgres;

-- SECURITY INVOKER legacy RPCs keep their owner/RLS semantics. This NOARG
-- bridge only locks the existing singleton before their first parent lock.
-- It grants no mutation, enrollment lookup, plan, actor or revision authority.
CREATE FUNCTION public.lock_character_parent_write_guard_v1() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.lock_character_writer_guard_v1(); END $$;
ALTER FUNCTION public.lock_character_parent_write_guard_v1() OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION public.lock_character_parent_write_guard_v1() FROM PUBLIC,anon,authenticated,service_role,postgres,inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION public.lock_character_parent_write_guard_v1() TO postgres;
DO $bridge_roles$ DECLARE entry record; BEGIN
  FOR entry IN SELECT role_name FROM pg_temp.parent_bridge_roles_v1 LOOP
    EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION public.lock_character_parent_write_guard_v1() TO %I',entry.role_name);
  END LOOP;
END $bridge_roles$;

CREATE FUNCTION private.character_parent_mechanics_v1(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT pg_catalog.jsonb_build_object('id',value->'id','user_id',value->'user_id','system_id',value->'system_id',
    'campaign_id',value->'campaign_id','archived',value->'archived','level',value->'level','choices',value->'choices',
    'state',value->'state','base_stats',value->'base_stats','action_revision',value->>'action_revision')
$$;

CREATE TABLE private.character_parent_admissions_v1(
  transaction_id xid8 NOT NULL,character_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence BETWEEN 1 AND 2),source text NOT NULL CHECK(source IN ('builder','first_class')),
  before_parent jsonb NOT NULL,expected_parent jsonb NOT NULL,before_order jsonb NOT NULL,
  phase text NOT NULL CHECK(phase IN ('pending','checked','observed')),write_required boolean NOT NULL,
  PRIMARY KEY(transaction_id,character_id,sequence),
  CHECK(pg_catalog.octet_length(pg_catalog.jsonb_build_array(before_parent,expected_parent,before_order)::text)<=8388608)
);
ALTER TABLE private.character_parent_admissions_v1 OWNER TO postgres;
ALTER TABLE private.character_parent_admissions_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_parent_admissions_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY parent_admission_owner ON private.character_parent_admissions_v1 TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON private.character_parent_admissions_v1 FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

CREATE FUNCTION private.first_class_parent_admission_v1(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE proof private.class_first_acquisition_proofs_v1%ROWTYPE; inputs jsonb; matches integer;
BEGIN
  SELECT count(*) INTO matches FROM private.class_first_acquisition_proofs_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=target;
  IF matches=0 THEN RETURN NULL; END IF;
  IF matches<>1 THEN RAISE EXCEPTION 'parent_admission_first_class_conflict' USING ERRCODE='23514'; END IF;
  SELECT * INTO proof FROM private.class_first_acquisition_proofs_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=target;
  inputs:=private.class_first_acquisition_inputs_v1(proof.acceptance_id);
  IF proof.before_parent IS DISTINCT FROM inputs->'before_parent' OR proof.before_order IS DISTINCT FROM inputs->'before_order'
    OR proof.expected_after_graph IS DISTINCT FROM inputs->'expected_after_graph'
    OR proof.verified_actor_id::text IS DISTINCT FROM inputs#>>'{before_parent,user_id}' THEN
    RAISE EXCEPTION 'parent_admission_first_class_invalid' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('phase',proof.phase,'before_parent',inputs->'before_parent',
    'expected_parent',inputs#>'{expected_after_graph,parent}','before_order',inputs->'before_order');
END $$;
ALTER FUNCTION private.first_class_parent_admission_v1(uuid) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.first_class_parent_admission_v1(uuid) FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.first_class_parent_admission_v1(uuid) TO postgres;

-- Called only from exact finite validated compiler/write sites installed below.
-- The capability by itself never supplies an expected parent or admission.
CREATE FUNCTION private.seal_builder_parent_admission_v1(target uuid,expected jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE; before_value jsonb; after_value jsonb; advance boolean;
  prior private.character_parent_admissions_v1%ROWTYPE; next_sequence integer; ordering jsonb;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR private.first_class_parent_admission_v1(target) IS NOT NULL THEN
    RAISE EXCEPTION 'parent_admission_builder_proof_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent_admission_builder_preimage_changed' USING ERRCODE='23514'; END IF;
  before_value:=private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent)); after_value:=private.character_parent_mechanics_v1(expected);
  SELECT * INTO prior FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target ORDER BY sequence DESC LIMIT 1;
  IF FOUND THEN
    IF prior.sequence<>1 OR prior.source<>'builder' OR prior.phase<>'observed' OR prior.expected_parent IS DISTINCT FROM before_value THEN
      RAISE EXCEPTION 'parent_admission_chain_unavailable' USING ERRCODE='23514'; END IF;
    next_sequence:=2;
  ELSE
    IF before_value IS DISTINCT FROM private.character_parent_mechanics_v1(cap.before_parent) THEN
      RAISE EXCEPTION 'parent_admission_builder_preimage_changed' USING ERRCODE='23514'; END IF;
    next_sequence:=1;
  END IF;
  IF (before_value-ARRAY['choices','state','base_stats','level']) IS DISTINCT FROM (after_value-ARRAY['choices','state','base_stats','level']) THEN
    RAISE EXCEPTION 'parent_admission_builder_preimage_changed' USING ERRCODE='23514'; END IF;
  advance:=(before_value-'action_revision') IS DISTINCT FROM (after_value-'action_revision') OR cap.correction_operation_id IS NOT NULL;
  after_value:=after_value||pg_catalog.jsonb_build_object('action_revision',CASE WHEN advance THEN (parent.action_revision::numeric+1)::text ELSE parent.action_revision::text END);
  SELECT pg_catalog.to_jsonb(o) INTO ordering FROM private.character_projection_order_v1 o WHERE character_id=target;
  IF ordering IS NULL OR ordering->>'producer_revision' IS DISTINCT FROM parent.action_revision::text
    OR (ordering-'producer_revision') IS DISTINCT FROM (cap.before_order-'producer_revision') THEN
    RAISE EXCEPTION 'parent_admission_chain_order_changed' USING ERRCODE='23514'; END IF;
  INSERT INTO private.character_parent_admissions_v1 VALUES(pg_catalog.pg_current_xact_id(),target,next_sequence,'builder',before_value,after_value,ordering,'pending',true);
END $$;

-- The exact legacy background RPC has a validated unchanged-selection return
-- before any parent DML. Preserve its zero-increment receipt path explicitly.
-- An observed no-write proof cannot admit an UPDATE; only the known conditional
-- second Expertise site can arm the next bounded exact native write.
CREATE FUNCTION private.observe_unchanged_builder_background_v1(target uuid,content uuid,version integer) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE; matches integer; pin jsonb; definition public.content_versions%ROWTYPE;
  seal private.character_parent_admissions_v1%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND OR cap.correction_operation_id IS NOT NULL THEN RAISE EXCEPTION 'parent_admission_no_write_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(cap.context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND OR pg_catalog.to_jsonb(parent) IS DISTINCT FROM cap.before_parent
    OR private.builder_protected_graph_v1(target) IS DISTINCT FROM cap.protected_graph THEN
    RAISE EXCEPTION 'parent_admission_no_write_preimage_changed' USING ERRCODE='23514'; END IF;
  SELECT count(*),pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r))->0 INTO matches,pin FROM public.character_content_refs r
    JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
    WHERE r.character_id=target AND v.content_type_snapshot='background';
  IF content IS NULL THEN
    IF version IS NOT NULL OR matches<>0 OR parent.choices ? 'background' THEN RAISE EXCEPTION 'parent_admission_no_write_background_changed' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO definition FROM public.content_versions WHERE content_id=content AND content_versions.version=observe_unchanged_builder_background_v1.version;
    IF NOT FOUND OR matches<>1 OR pin->>'content_id' IS DISTINCT FROM content::text OR pin->>'content_version' IS DISTINCT FROM version::text
      OR definition.content_type_snapshot<>'background' OR definition.system_id_snapshot IS DISTINCT FROM parent.system_id
      OR definition.slug_snapshot IS DISTINCT FROM parent.choices->>'background' THEN
      RAISE EXCEPTION 'parent_admission_no_write_background_changed' USING ERRCODE='23514'; END IF;
  END IF;
  PERFORM private.seal_builder_parent_admission_v1(target,pg_catalog.to_jsonb(parent));
  SELECT * INTO seal FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF seal.sequence<>1 OR seal.phase<>'pending' OR seal.before_parent IS DISTINCT FROM seal.expected_parent THEN
    RAISE EXCEPTION 'parent_admission_no_write_seal_changed' USING ERRCODE='23514'; END IF;
  UPDATE private.character_parent_admissions_v1 SET phase='checked',write_required=false WHERE transaction_id=seal.transaction_id AND character_id=target AND sequence=1 AND phase='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'parent_admission_no_write_check_missing' USING ERRCODE='23514'; END IF;
  IF pg_catalog.to_jsonb(parent) IS DISTINCT FROM (SELECT pg_catalog.to_jsonb(c) FROM public.characters c WHERE id=target)
    OR seal.before_order IS DISTINCT FROM (SELECT pg_catalog.to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=target) THEN
    RAISE EXCEPTION 'parent_admission_no_write_observation_changed' USING ERRCODE='23514'; END IF;
  UPDATE private.character_parent_admissions_v1 SET phase='observed' WHERE transaction_id=seal.transaction_id AND character_id=target AND sequence=1 AND phase='checked' AND NOT write_required;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent_admission_no_write_observation_missing' USING ERRCODE='23514'; END IF;
END $$;

CREATE FUNCTION private.enrolled_parent_statement_guard_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.lock_character_writer_guard_v1(); RETURN NULL; END $$;
ALTER FUNCTION private.enrolled_parent_statement_guard_v1() OWNER TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.enrolled_parent_before_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE before_value jsonb; after_value jsonb; first_proof jsonb; cap_count integer; seal private.character_parent_admissions_v1%ROWTYPE;
BEGIN
  IF NOT private.enrolled_character_parent_v1(OLD.id) AND (TG_OP='DELETE' OR NOT private.enrolled_character_parent_v1(NEW.id)) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'enrolled_parent_delete_unavailable' USING ERRCODE='42501'; END IF;
  before_value:=private.character_parent_mechanics_v1(pg_catalog.to_jsonb(OLD)); after_value:=private.character_parent_mechanics_v1(pg_catalog.to_jsonb(NEW));
  SELECT count(*) INTO cap_count FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=OLD.id;
  first_proof:=private.first_class_parent_admission_v1(OLD.id);
  IF cap_count>0 AND first_proof IS NOT NULL THEN RAISE EXCEPTION 'parent_admission_proof_conflict' USING ERRCODE='23514'; END IF;
  IF cap_count=0 AND first_proof IS NULL AND before_value=after_value THEN RETURN NEW; END IF;
  IF first_proof IS NOT NULL THEN
    IF first_proof->>'phase' IS DISTINCT FROM 'pending' OR before_value IS DISTINCT FROM private.character_parent_mechanics_v1(first_proof->'before_parent') THEN
      RAISE EXCEPTION 'parent_admission_first_class_pending_required' USING ERRCODE='23514'; END IF;
    INSERT INTO private.character_parent_admissions_v1 VALUES(pg_catalog.pg_current_xact_id(),OLD.id,1,'first_class',before_value,
      private.character_parent_mechanics_v1(first_proof->'expected_parent'),first_proof->'before_order','pending',true);
  END IF;
  SELECT * INTO seal FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=OLD.id ORDER BY sequence DESC LIMIT 1;
  IF NOT FOUND OR seal.phase<>'pending' OR NOT seal.write_required OR seal.before_parent IS DISTINCT FROM before_value OR NEW.action_revision IS DISTINCT FROM OLD.action_revision
    OR (after_value-'action_revision') IS DISTINCT FROM (seal.expected_parent-'action_revision')
    OR seal.source IS DISTINCT FROM (CASE WHEN first_proof IS NULL THEN 'builder' ELSE 'first_class' END) THEN
    RAISE EXCEPTION 'enrolled_parent_update_not_admitted' USING ERRCODE='42501'; END IF;
  UPDATE private.character_parent_admissions_v1 SET phase='checked' WHERE transaction_id=seal.transaction_id AND character_id=seal.character_id AND sequence=seal.sequence AND phase='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'parent_admission_already_checked' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.enrolled_parent_after_revision_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE seal private.character_parent_admissions_v1%ROWTYPE; first_proof jsonb;
BEGIN
  IF NOT private.enrolled_character_parent_v1(OLD.id) AND NOT private.enrolled_character_parent_v1(NEW.id) THEN RETURN NEW; END IF;
  SELECT * INTO seal FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=OLD.id ORDER BY sequence DESC LIMIT 1;
  IF NOT FOUND THEN
    IF private.character_parent_mechanics_v1(pg_catalog.to_jsonb(OLD))=private.character_parent_mechanics_v1(pg_catalog.to_jsonb(NEW)) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'parent_admission_late_proof_required' USING ERRCODE='42501'; END IF;
  first_proof:=private.first_class_parent_admission_v1(OLD.id);
  IF seal.phase<>'checked' OR NOT seal.write_required OR seal.before_parent IS DISTINCT FROM private.character_parent_mechanics_v1(pg_catalog.to_jsonb(OLD))
    OR seal.expected_parent IS DISTINCT FROM private.character_parent_mechanics_v1(pg_catalog.to_jsonb(NEW))
    OR (seal.source='first_class' AND first_proof->>'phase' IS DISTINCT FROM 'assigned')
    OR (seal.source='builder' AND first_proof IS NOT NULL) THEN
    RAISE EXCEPTION 'parent_admission_native_tuple_changed' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.enrolled_parent_observed_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE seal private.character_parent_admissions_v1%ROWTYPE; parent public.characters%ROWTYPE; ordering jsonb; before_order jsonb;
BEGIN
  IF NOT private.enrolled_character_parent_v1(OLD.id) AND NOT private.enrolled_character_parent_v1(NEW.id) THEN RETURN NEW; END IF;
  SELECT * INTO seal FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=OLD.id ORDER BY sequence DESC LIMIT 1;
  IF NOT FOUND THEN
    IF private.character_parent_mechanics_v1(pg_catalog.to_jsonb(OLD))=private.character_parent_mechanics_v1(pg_catalog.to_jsonb(NEW)) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'parent_admission_observation_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO parent FROM public.characters WHERE id=NEW.id;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text) INTO ordering
    FROM private.character_projection_order_v1 o WHERE character_id=NEW.id;
  before_order:=seal.before_order||pg_catalog.jsonb_build_object('producer_revision',seal.expected_parent->>'action_revision');
  IF seal.phase<>'checked' OR NOT seal.write_required OR seal.expected_parent IS DISTINCT FROM private.character_parent_mechanics_v1(pg_catalog.to_jsonb(NEW))
    OR seal.expected_parent IS DISTINCT FROM private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent)) OR ordering IS DISTINCT FROM before_order THEN
    RAISE EXCEPTION 'parent_admission_observation_changed' USING ERRCODE='23514'; END IF;
  UPDATE private.character_parent_admissions_v1 SET phase='observed' WHERE transaction_id=seal.transaction_id AND character_id=seal.character_id AND sequence=seal.sequence AND phase='checked';
  IF NOT FOUND THEN RAISE EXCEPTION 'parent_admission_already_observed' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.finish_parent_admission_v1(target uuid,source_name text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE seal private.character_parent_admissions_v1%ROWTYPE; parent public.characters%ROWTYPE; first_proof jsonb;
BEGIN
  SELECT * INTO seal FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target ORDER BY sequence DESC LIMIT 1;
  SELECT * INTO parent FROM public.characters WHERE id=target;
  IF seal.phase IS DISTINCT FROM 'observed' OR seal.source IS DISTINCT FROM source_name
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target AND (phase<>'observed' OR source<>source_name))
    OR seal.expected_parent IS DISTINCT FROM private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent))
    OR NOT EXISTS(SELECT 1 FROM private.character_projection_order_v1 WHERE character_id=target AND producer_revision=parent.action_revision) THEN
    RAISE EXCEPTION 'parent_admission_finish_observed_required' USING ERRCODE='23514'; END IF;
  IF source_name='builder' THEN
    IF NOT EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target)
      OR private.first_class_parent_admission_v1(target) IS NOT NULL THEN RAISE EXCEPTION 'parent_admission_finish_conflict' USING ERRCODE='23514'; END IF;
  ELSIF source_name='first_class' THEN
    first_proof:=private.first_class_parent_admission_v1(target);
    IF first_proof->>'phase' IS DISTINCT FROM 'assigned' OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target) THEN
      RAISE EXCEPTION 'parent_admission_finish_conflict' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'parent_admission_source_unavailable' USING ERRCODE='23514'; END IF;
  DELETE FROM private.character_parent_admissions_v1 WHERE transaction_id=seal.transaction_id AND character_id=target AND phase='observed';
END $$;

CREATE FUNCTION private.require_parent_admission_finished_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM private.character_parent_admissions_v1 WHERE transaction_id=NEW.transaction_id AND character_id=NEW.character_id)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=NEW.transaction_id AND character_id=NEW.character_id) THEN
    RAISE EXCEPTION 'parent_admission_unfinished' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER parent_admission_finished AFTER INSERT ON private.character_parent_admissions_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.require_parent_admission_finished_v1();
CREATE CONSTRAINT TRIGGER builder_parent_admission_finished AFTER INSERT ON private.character_builder_capabilities_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.require_parent_admission_finished_v1();

-- Closed finite instrumentation preserves every original function owner, ACL,
-- invoker/definer flag, config, volatility and all unmodified body bytes.
DO $source_profiles$
DECLARE item record; original pg_catalog.pg_proc%ROWTYPE; repaired pg_catalog.pg_proc%ROWTYPE;
  source text; replacement text; needle text; insertion text; suffix text; signature text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)','d55825fd6cf14472f9154a363991b62a','postgres',true,'catalog'),
    ('private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)','896866e89cf4c74a7a4098f053f5a1d8','postgres',true,'progression'),
    ('private.apply_builder_details_v1(uuid,jsonb)','ece8f0561ce13e917cc874a4b68468f1','postgres',true,'details'),
    ('public.character_builder_command_before_catalog_v1(jsonb,jsonb)','8cceb057257f8ce9eed3af251c0c3cb6','postgres',true,'simple'),
    ('public.commit_character_builder_equipment_v1(jsonb,jsonb)','3020e791f498285a66116f909168cf75','postgres',true,'award'),
    ('private.finish_builder_step_v1(jsonb,uuid)','b8f2a900dde82e63baebc1d2228fa75e','postgres',true,'finish'),
    ('private.observe_first_class_choices_revision_v1(jsonb,uuid)','3849453fa5641c0e63a3612a264c57eb','inkborne_hit_die_authority_owner',true,'first_class'),
    ('public.save_character_abilities(uuid,text,jsonb,text,jsonb)','263b4d41d2b49c6fb6bb91b86d8c5c2b','postgres',false,'abilities_guard'),
    ('public.patch_character_state_if_current(uuid,jsonb,jsonb)','87b93c0009e096fb9e3552a8bf9afa0a','postgres',false,'state_guard'),
    ('public.set_character_background(uuid,uuid,integer)','e48cef8c7bc12cfed0f019d06ddd69ed','postgres',true,'background'),
    ('public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer)','d0a1417fb272a28cc28cbbe7dd535c70','postgres',true,'asi_guard')
  ) wanted(signature,body_md5,owner_name,is_definer,kind) LOOP
    SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature);
    IF NOT FOUND OR original.proowner<>item.owner_name::pg_catalog.regrole OR original.prosecdef IS DISTINCT FROM item.is_definer
      OR original.provolatile<>'v' OR original.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR pg_catalog.md5(pg_catalog.replace(original.prosrc,E'\r\n',E'\n'))<>item.body_md5
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(original.proacl,pg_catalog.acldefault('f',original.proowner))) a
        WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR (a.grantee<>original.proowner AND NOT (
          item.kind IN ('abilities_guard','state_guard','background','asi_guard') AND a.grantee IN ('authenticated'::pg_catalog.regrole,'service_role'::pg_catalog.regrole)
          OR item.kind='award' AND a.grantee='service_role'::pg_catalog.regrole
          OR item.kind='first_class' AND a.grantee='inkborne_class_origin_owner'::pg_catalog.regrole))) THEN
      RAISE EXCEPTION 'parent_admission_source_preimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
    source:=pg_catalog.replace(original.prosrc,E'\r\n',E'\n'); replacement:=source;
    IF item.kind IN ('catalog','progression','details','award') THEN
      needle:=CASE item.kind
        WHEN 'catalog' THEN '  UPDATE public.characters SET choices=next_choices WHERE id=target;'
        WHEN 'progression' THEN '  UPDATE public.characters SET choices=apply_builder_progression_graph_v1.choices,state=apply_builder_progression_graph_v1.state,'
        WHEN 'details' THEN '  UPDATE public.characters SET name=chosen_name,choices=next_choices WHERE id=target AND user_id=cap.actor_id;'
        ELSE '  UPDATE public.characters SET state=next_state,choices=pg_catalog.jsonb_set(parent.choices,''{starting_equipment}'',' END;
      insertion:=CASE item.kind
        WHEN 'catalog' THEN '  PERFORM private.seal_builder_parent_admission_v1(target,cap.before_parent||pg_catalog.jsonb_build_object(''choices'',next_choices));'
        WHEN 'progression' THEN '  PERFORM private.seal_builder_parent_admission_v1(target,cap.before_parent||pg_catalog.jsonb_build_object(''choices'',choices,''state'',state,''level'',level));'
        WHEN 'details' THEN '  PERFORM private.seal_builder_parent_admission_v1(target,cap.before_parent||pg_catalog.jsonb_build_object(''choices'',next_choices));'
        ELSE '  PERFORM private.seal_builder_parent_admission_v1(target,pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object(''state'',next_state,''choices'',pg_catalog.jsonb_set(parent.choices,''{starting_equipment}'',(parent.choices->''starting_equipment'')||''{"confirmed":true}''::jsonb,true)));' END;
    ELSIF item.kind='finish' THEN
      needle:='  DELETE FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;';
      insertion:='  PERFORM private.finish_parent_admission_v1(target,''builder'');';
    ELSIF item.kind='first_class' THEN
      needle:='  RETURN pg_catalog.jsonb_build_object(''phase'',''assigned'',''parent'',after_json,''order'',order_json);';
      insertion:='  PERFORM private.finish_parent_admission_v1(before_row.id,''first_class'');';
    ELSIF item.kind='abilities_guard' THEN
      needle:='  select coalesce(c.choices, ''{}''::jsonb), coalesce(c.base_stats, ''{}''::jsonb), c.system_id';
      insertion:='  perform public.lock_character_parent_write_guard_v1();';
    ELSIF item.kind='state_guard' THEN
      needle:='  SELECT coalesce(c.state, ''{}''::jsonb)';
      insertion:='  PERFORM public.lock_character_parent_write_guard_v1();';
    ELSIF item.kind IN ('background','asi_guard') THEN
      needle:='  SELECT character.*'; insertion:='  PERFORM private.lock_enrolled_parent_guard_v1();';
    ELSE
      needle:='    PERFORM public.save_character_abilities(target,fields->>''method'',fields->''scores'',fields->>''expected_method'',fields->''expected_scores'');';
      insertion:='    PERFORM private.seal_builder_parent_admission_v1(target,pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object(''base_stats'',fields->''scores'',''choices'',pg_catalog.jsonb_set(next_choices,''{ability_method}'',fields->''method'',true)));';
    END IF;
    IF (length(replacement)-length(pg_catalog.replace(replacement,needle,'')))/length(needle)<>1 THEN
      RAISE EXCEPTION 'parent_admission_source_fragment_changed: %',item.kind USING ERRCODE='42501'; END IF;
    replacement:=pg_catalog.replace(replacement,needle,insertion||E'\n'||needle);
    IF item.kind='background' THEN
      needle:='  IF NOT selection_changed THEN';
      insertion:=$background_no_change$  IF NOT selection_changed THEN
    IF EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target_character_id) THEN
      PERFORM private.observe_unchanged_builder_background_v1(target_character_id,target_content_id,target_content_version);
    END IF;$background_no_change$;
      IF (length(replacement)-length(pg_catalog.replace(replacement,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'parent_admission_background_no_change_fragment_changed'; END IF;
      replacement:=pg_catalog.replace(replacement,needle,insertion);
      needle:='  UPDATE public.characters AS character';
      insertion:=$background$  IF EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target_character_id) THEN
    PERFORM private.seal_builder_parent_admission_v1(target_character_id,pg_catalog.to_jsonb(locked_character)||pg_catalog.jsonb_build_object('choices',next_choices));
  END IF;
$background$;
      IF (length(replacement)-length(pg_catalog.replace(replacement,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'parent_admission_background_fragment_changed'; END IF;
      replacement:=pg_catalog.replace(replacement,needle,insertion||needle);
    ELSIF item.kind='simple' THEN
      -- These normalized choices are compiled in the retained simple source.
      FOREACH needle IN ARRAY ARRAY[
        E'\n      UPDATE public.characters SET choices=next_choices WHERE id=target;',
        E'\n    UPDATE public.characters SET choices=next_choices WHERE id=target;'
      ] LOOP
        IF (length(replacement)-length(pg_catalog.replace(replacement,needle,'')))/length(needle)<>(CASE WHEN needle LIKE E'\n      %' THEN 1 ELSE 2 END) THEN
          RAISE EXCEPTION 'parent_admission_simple_choices_fragment_changed'; END IF;
        replacement:=pg_catalog.replace(replacement,needle,E'\n    PERFORM private.seal_builder_parent_admission_v1(target,pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object(''choices'',next_choices));'||needle);
      END LOOP;
      needle:='    UPDATE public.characters SET choices=pg_catalog.jsonb_set(next_choices,''{starting_equipment}'',fields||''{"confirmed":false}''::jsonb,true) WHERE id=target;';
      insertion:='    PERFORM private.seal_builder_parent_admission_v1(target,pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object(''choices'',pg_catalog.jsonb_set(next_choices,''{starting_equipment}'',fields||''{"confirmed":false}''::jsonb,true)));';
      IF pg_catalog.strpos(replacement,needle)=0 THEN RAISE EXCEPTION 'parent_admission_equipment_fragment_changed'; END IF;
      replacement:=pg_catalog.replace(replacement,needle,insertion||E'\n'||needle);
      needle:='    UPDATE public.characters SET choices=pg_catalog.jsonb_set(next_choices,ARRAY[narrative_key],fields->''values'',true) WHERE id=target;';
      insertion:='    PERFORM private.seal_builder_parent_admission_v1(target,pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object(''choices'',pg_catalog.jsonb_set(next_choices,ARRAY[narrative_key],fields->''values'',true)));';
      IF pg_catalog.strpos(replacement,needle)=0 THEN RAISE EXCEPTION 'parent_admission_narrative_fragment_changed'; END IF;
      replacement:=pg_catalog.replace(replacement,needle,insertion||E'\n'||needle);
      -- Existing Expertise normalization may make a genuine second UPDATE.
      -- Preserve its second native increment; never arm a zero-row predicate.
      needle:='    UPDATE public.characters SET choices=next_choices WHERE id=target AND user_id=actor AND choices IS DISTINCT FROM next_choices;';
      insertion:=$expertise$    IF EXISTS(SELECT 1 FROM public.characters WHERE id=target AND user_id=actor AND choices IS DISTINCT FROM next_choices) THEN
      PERFORM private.seal_builder_parent_admission_v1(target,(SELECT pg_catalog.to_jsonb(c) FROM public.characters c WHERE id=target)||pg_catalog.jsonb_build_object('choices',next_choices));
      UPDATE public.characters SET choices=next_choices WHERE id=target AND user_id=actor AND choices IS DISTINCT FROM next_choices;
    END IF;$expertise$;
      IF (length(replacement)-length(pg_catalog.replace(replacement,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'parent_admission_expertise_fragment_changed'; END IF;
      replacement:=pg_catalog.replace(replacement,needle,insertion);
    END IF;
    replacement:=pg_catalog.replace(replacement,E'\r\n',E'\n');
    EXECUTE pg_catalog.replace(pg_catalog.pg_get_functiondef(original.oid),original.prosrc,replacement);
    SELECT * INTO repaired FROM pg_catalog.pg_proc WHERE oid=original.oid;
    IF (pg_catalog.to_jsonb(repaired)-'prosrc') IS DISTINCT FROM (pg_catalog.to_jsonb(original)-'prosrc')
      OR repaired.prosrc IS DISTINCT FROM replacement OR pg_catalog.md5(repaired.prosrc)<>pg_catalog.md5(replacement) THEN
      RAISE EXCEPTION 'parent_admission_source_postimage_changed: %',item.kind USING ERRCODE='42501'; END IF;
  END LOOP;
END $source_profiles$;

CREATE TRIGGER aaa_enrolled_parent_statement_guard BEFORE UPDATE OR DELETE ON public.characters
  FOR EACH STATEMENT EXECUTE FUNCTION private.enrolled_parent_statement_guard_v1();
CREATE TRIGGER aaa_enrolled_parent_admission BEFORE UPDATE OR DELETE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION private.enrolled_parent_before_v1();
CREATE TRIGGER zzz_enrolled_parent_after_revision BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION private.enrolled_parent_after_revision_v1();
CREATE TRIGGER zzz_enrolled_parent_observed AFTER UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION private.enrolled_parent_observed_v1();

DO $new_function_closure$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.character_parent_mechanics_v1(jsonb)','private.seal_builder_parent_admission_v1(uuid,jsonb)','private.observe_unchanged_builder_background_v1(uuid,uuid,integer)',
    'private.enrolled_parent_before_v1()','private.enrolled_parent_after_revision_v1()','private.enrolled_parent_observed_v1()',
    'private.finish_parent_admission_v1(uuid,text)','private.require_parent_admission_finished_v1()'
  ] LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner',signature);
  END LOOP;
  REVOKE ALL ON FUNCTION private.enrolled_parent_statement_guard_v1() FROM PUBLIC,anon,authenticated,service_role,postgres,inkborne_class_origin_owner;
  GRANT EXECUTE ON FUNCTION private.finish_parent_admission_v1(uuid,text) TO inkborne_hit_die_authority_owner;
END $new_function_closure$;

DO $closed$
DECLARE entry record; actual jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid='private.enrolled_character_parent_v1(uuid)'::pg_catalog.regprocedure
    AND proowner='postgres'::pg_catalog.regrole AND prosecdef AND provolatile='v'
    AND proconfig=ARRAY['search_path=""','row_security=off']::text[])
    OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode((SELECT proacl FROM pg_catalog.pg_proc
      WHERE oid='private.enrolled_character_parent_v1(uuid)'::pg_catalog.regprocedure)) a
      WHERE a.grantee<>'postgres'::pg_catalog.regrole OR a.privilege_type<>'EXECUTE' OR a.is_grantable) THEN
    RAISE EXCEPTION 'parent_enrollment_visibility_profile_changed' USING ERRCODE='42501'; END IF;
  FOR entry IN SELECT * FROM pg_temp.parent_original_triggers_v1 LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid='public.characters'::pg_catalog.regclass AND t.tgname=entry.tgname
        AND pg_catalog.to_jsonb(t)-'oid'=entry.wire AND p.prosrc=entry.prosrc AND p.proowner=entry.proowner
        AND p.proacl IS NOT DISTINCT FROM entry.proacl AND p.proconfig IS NOT DISTINCT FROM entry.proconfig
        AND p.prosecdef=entry.prosecdef AND p.provolatile=entry.provolatile) THEN
      RAISE EXCEPTION 'parent_admission_original_trigger_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF (SELECT array_agg(tgname::text ORDER BY tgname) FROM pg_catalog.pg_trigger WHERE tgrelid='public.characters'::pg_catalog.regclass AND NOT tgisinternal) IS DISTINCT FROM ARRAY[
    'aaa_enrolled_parent_admission','aaa_enrolled_parent_statement_guard','enforce_asi_choice_map_boundary','enforce_background_choice_map_boundary',
    'hit_die_character_revision','hit_die_order_revision_rebind','prune_inactive_asi_choices_before_choices',
    'prune_inactive_feature_refs_after_choices','validate_character_content_boundaries','zzz_enrolled_parent_after_revision','zzz_enrolled_parent_observed']::text[]
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.characters'::pg_catalog.regclass AND tgname LIKE '%enrolled_parent%'
      AND (tgenabled<>'O' OR tgdeferrable OR tginitdeferred OR tgnargs<>0 OR pg_catalog.octet_length(tgargs)<>0 OR tgqual IS NOT NULL OR tgattr::text<>'')) THEN
    RAISE EXCEPTION 'parent_admission_trigger_order_changed' USING ERRCODE='42501'; END IF;
  FOR entry IN SELECT * FROM (VALUES
    ('aaa_enrolled_parent_statement_guard',26,'private.enrolled_parent_statement_guard_v1()'),
    ('aaa_enrolled_parent_admission',27,'private.enrolled_parent_before_v1()'),
    ('zzz_enrolled_parent_after_revision',19,'private.enrolled_parent_after_revision_v1()'),
    ('zzz_enrolled_parent_observed',17,'private.enrolled_parent_observed_v1()')
  ) wanted(name,event_mask,signature) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.characters'::pg_catalog.regclass AND tgname=entry.name
      AND tgtype=entry.event_mask AND tgfoid=pg_catalog.to_regprocedure(entry.signature)) THEN
      RAISE EXCEPTION 'parent_admission_trigger_wiring_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
  FOR entry IN SELECT role_name FROM pg_catalog.unnest(ARRAY['anon','authenticated','service_role']) role_name LOOP
    IF pg_catalog.has_function_privilege(entry.role_name,'public.lock_character_parent_write_guard_v1()','EXECUTE')
      IS DISTINCT FROM EXISTS(SELECT 1 FROM pg_temp.parent_bridge_roles_v1 captured WHERE captured.role_name=entry.role_name)
      OR (entry.role_name IN ('anon','service_role') AND pg_catalog.has_schema_privilege(entry.role_name,'private','USAGE')) THEN
      RAISE EXCEPTION 'parent_admission_bridge_acl_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF (SELECT pg_catalog.to_jsonb(n) FROM pg_catalog.pg_namespace n WHERE n.nspname='private')
      IS DISTINCT FROM (SELECT profile FROM pg_temp.parent_private_schema_v1)
    OR EXISTS(SELECT 1 FROM pg_temp.parent_private_schema_roles_v1 captured
      WHERE pg_catalog.has_schema_privilege(captured.role_name,'private','USAGE') IS DISTINCT FROM captured.usage_allowed
        OR pg_catalog.has_schema_privilege(captured.role_name,'private','CREATE') IS DISTINCT FROM captured.create_allowed) THEN
    RAISE EXCEPTION 'parent_admission_private_schema_changed' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.aclexplode((SELECT proacl FROM pg_catalog.pg_proc WHERE oid='public.lock_character_parent_write_guard_v1()'::pg_catalog.regprocedure)) a
    WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee NOT IN ('postgres'::pg_catalog.regrole,'inkborne_hit_die_authority_owner'::pg_catalog.regrole)
      AND NOT EXISTS(SELECT 1 FROM pg_temp.parent_bridge_roles_v1 captured WHERE captured.role_name::pg_catalog.regrole=a.grantee))
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1) OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13 OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'parent_admission_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
