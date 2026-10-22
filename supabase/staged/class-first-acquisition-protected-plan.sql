-- CANDIDATE / STAGED ONLY. Closed B1 plan storage, never JWT or save authority.
-- A same-token server-verified context is a trusted caller precondition. No
-- caller receives EXECUTE here. B2/B3, original Auth denials and gates stay intact.
BEGIN;

DO $prerequisites$
DECLARE wanted record; actual record; installation_owner oid;
BEGIN
  IF CURRENT_USER IS DISTINCT FROM SESSION_USER OR CURRENT_USER NOT IN ('postgres','supabase_admin')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER AND rolsuper)
    OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner'))<>6 THEN
    RAISE EXCEPTION 'first_class_plan_prerequisite_unavailable' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('inkborne_class_origin_owner','inkborne_hit_die_authority_owner')
      AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE
      m.roleid IN ('inkborne_class_origin_owner'::pg_catalog.regrole::oid,'inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid)
      OR m.member IN ('inkborne_class_origin_owner'::pg_catalog.regrole::oid,'inkborne_hit_die_authority_owner'::pg_catalog.regrole::oid)) THEN
    RAISE EXCEPTION 'first_class_plan_isolated_owners_required' USING ERRCODE='42501';
  END IF;
  FOR wanted IN SELECT * FROM (VALUES
    ('private.check_character_command_clock_v1(timestamp with time zone)','055cc671ff088cbea202eaa44dd4b497','v',false,'timestamp with time zone','plpgsql','postgres',true),
    ('private.lock_character_command_rows_v1(jsonb,uuid)','36776958bd26ed3886c3526458051cec','v',false,'void','plpgsql','postgres',true),
    ('private.lock_character_command_actor_rows_v1(jsonb)','20723debd6bff48414c085efd2b984af','v',false,'timestamp with time zone','plpgsql','postgres',true),
    ('private.read_first_class_bootstrap_history_v1(uuid)','4e92bac6294aba053404bdc3fe0077c4','s',false,'jsonb','plpgsql','postgres',true),
    ('private.validate_first_class_calculation_intent_v1(jsonb)','f6039cbe5ad8fe1b54e6465a50329bf0','i',false,'void','plpgsql','postgres',true),
    ('private.first_class_calculation_exact_keys_v1(jsonb,text[])','f650d04d66adb2f6194f411a9fafc3bd','i',false,'boolean','sql','postgres',true),
    ('private.first_class_calculation_uuid_v1(jsonb)','1446f832936a7b6d4681dc8f4068de5c','i',false,'boolean','sql','postgres',true),
    ('private.first_class_calculation_instant_v1(jsonb)','326895ee2cba270ebe166f28350ab65d','i',false,'boolean','plpgsql','postgres',true),
    ('private.allocate_first_class_save_envelope_v1(jsonb)','e728785f895588b13867fa85de94d284','v',false,'jsonb','plpgsql','postgres',true),
    ('private.resolve_first_class_dependencies_v1(uuid,uuid,integer)','a8189d4c55edaedda65d1e3a22906682','s',false,'jsonb','plpgsql','postgres',true),
    ('private.character_can_access_content_version(uuid,uuid,integer)','52e552ce7b8e8294d50cefb84c44bada','s',true,'boolean','sql','postgres',true),
    ('private.require_class_origin_auth_v1(jsonb)','34837118aa95bedd7fd9a85d8b066e9d','v',false,'void','plpgsql','inkborne_class_origin_owner',false),
    ('private.require_verified_hit_die_auth_v1(jsonb)','972773f897b4f6630b5d7c948a0c851c','v',false,'void','plpgsql','inkborne_hit_die_authority_owner',false),
    ('private.class_origin_acceptance_guard_v1()','bc20794c94950dd69e4b402505299039','v',true,'trigger','plpgsql','inkborne_class_origin_owner',false),
    ('private.class_origin_deferred_finalizer_v1()','48058f01ba8e27be3794a627c4655e2f','v',true,'trigger','plpgsql','inkborne_class_origin_owner',false)
  ) dependencies(signature,body_md5,volatility,is_definer,result_type,language_name,owner_name,needs_execute)
  LOOP
    SELECT p.*,l.lanname INTO actual FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure(wanted.signature);
    IF NOT FOUND OR pg_catalog.pg_get_userbyid(actual.proowner)<>wanted.owner_name
      OR actual.prokind<>'f' OR actual.proretset OR actual.lanname<>wanted.language_name
      OR pg_catalog.format_type(actual.prorettype,NULL)<>wanted.result_type
      OR actual.proisstrict OR actual.pronargdefaults<>0 OR actual.provariadic<>0
      OR actual.provolatile::text<>wanted.volatility OR actual.prosecdef IS DISTINCT FROM wanted.is_definer
      OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR pg_catalog.md5(pg_catalog.replace(actual.prosrc,E'\r\n',E'\n'))<>wanted.body_md5
      OR (wanted.needs_execute AND NOT pg_catalog.has_function_privilege('postgres',actual.oid,'EXECUTE')) THEN
      RAISE EXCEPTION 'first_class_plan_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE
      tgrelid='private.class_writer_acceptance_v1'::pg_catalog.regclass AND tgname='class_origin_acceptance_guard'
      AND tgfoid='private.class_origin_acceptance_guard_v1()'::pg_catalog.regprocedure
      AND tgtype=31 AND tgenabled='O' AND NOT tgdeferrable AND NOT tgisinternal)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE
      tgrelid='private.class_writer_acceptance_v1'::pg_catalog.regclass AND tgname='class_origin_acceptance_closure'
      AND tgfoid='private.class_origin_deferred_finalizer_v1()'::pg_catalog.regprocedure
      AND tgtype=21 AND tgenabled='O' AND tgdeferrable AND tginitdeferred AND NOT tgisinternal)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE
      tgrelid='private.class_writer_row_transitions_v1'::pg_catalog.regclass AND tgname='class_origin_transition_closure'
      AND tgfoid='private.class_origin_deferred_finalizer_v1()'::pg_catalog.regprocedure
      AND tgtype=21 AND tgenabled='O' AND tgdeferrable AND tginitdeferred AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'first_class_plan_original_journal_guards_required' USING ERRCODE='42501';
  END IF;
  SELECT relowner INTO installation_owner FROM pg_catalog.pg_class
    WHERE oid='private.class_writer_acceptance_v1'::pg_catalog.regclass;
  IF installation_owner IS DISTINCT FROM CURRENT_USER::pg_catalog.regrole::oid THEN
    RAISE EXCEPTION 'first_class_plan_original_installation_owner_required' USING ERRCODE='42501';
  END IF;
  -- Native original private tables belong to the direct SUPER installer, often
  -- supabase_admin. No private SELECT/ownership repair is granted to postgres.
  FOR wanted IN SELECT * FROM (VALUES
    ('private.character_class_origin_v1'),('private.character_class_occurrences_v1'),
    ('private.character_class_commands_v1'),('private.character_creation_commands_v1'),
    ('private.class_writer_acceptance_v1'),('private.class_writer_row_transitions_v1'),
    ('private.character_projection_order_v1')
  ) relations(name)
  LOOP
    SELECT c.* INTO actual FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(wanted.name);
    IF NOT FOUND OR actual.relkind<>'r' OR actual.relowner IS DISTINCT FROM installation_owner
      OR NOT pg_catalog.has_table_privilege('inkborne_class_origin_owner',wanted.name,'SELECT') THEN
      RAISE EXCEPTION 'first_class_plan_prerequisite_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOR wanted IN SELECT * FROM (VALUES ('public.characters'),('public.content_versions'),('public.game_systems')) relations(name)
  LOOP
    SELECT c.* INTO actual FROM pg_catalog.pg_class c WHERE c.oid=pg_catalog.to_regclass(wanted.name);
    IF NOT FOUND OR actual.relkind<>'r' OR pg_catalog.pg_get_userbyid(actual.relowner)<>'postgres' THEN
      RAISE EXCEPTION 'first_class_plan_public_owner_unavailable' USING ERRCODE='42501';
    END IF;
  END LOOP;
  FOR wanted IN SELECT * FROM (VALUES
    ('private.character_class_origin_v1'),('private.character_class_occurrences_v1'),
    ('private.character_class_commands_v1'),('private.character_creation_commands_v1'),
    ('private.class_writer_acceptance_v1'),('private.class_writer_row_transitions_v1'),
    ('private.character_projection_order_v1'),('public.characters'),('public.content_versions'),
    ('public.character_content_refs'),('public.character_inventory'),('public.character_spells'),
    ('public.character_feature_grants'),('public.character_spell_grants')
  ) visibility(name)
  LOOP
    IF NOT pg_catalog.has_table_privilege('inkborne_class_origin_owner',wanted.name,'SELECT')
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=wanted.name::pg_catalog.regclass AND relrowsecurity)
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=wanted.name::pg_catalog.regclass
        AND p.polcmd IN ('r','*') AND p.polpermissive
        AND 'inkborne_class_origin_owner'::pg_catalog.regrole::oid=ANY(p.polroles)
        AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true')
      OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=wanted.name::pg_catalog.regclass
        AND p.polcmd IN ('r','*') AND NOT p.polpermissive
        AND (0::oid=ANY(p.polroles) OR 'inkborne_class_origin_owner'::pg_catalog.regrole::oid=ANY(p.polroles))) THEN
      RAISE EXCEPTION 'first_class_plan_original_visibility_required' USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM private.class_origin_gate_v1)<>1
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND NOT enabled)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready OR protocol_version<>1) THEN
    RAISE EXCEPTION 'first_class_plan_requires_unchanged_closed_gates' USING ERRCODE='42501';
  END IF;
END;
$prerequisites$;

-- Exact read-only calculation capabilities under the already isolated class
-- owner. These are not plan-minting privileges. No role membership is granted.
GRANT EXECUTE ON FUNCTION private.check_character_command_clock_v1(timestamptz),
  private.validate_first_class_calculation_intent_v1(jsonb),
  private.first_class_calculation_exact_keys_v1(jsonb,text[]),private.first_class_calculation_uuid_v1(jsonb),
  private.first_class_calculation_instant_v1(jsonb),private.read_first_class_bootstrap_history_v1(uuid),
  private.allocate_first_class_save_envelope_v1(jsonb),private.resolve_first_class_dependencies_v1(uuid,uuid,integer),
  private.character_can_access_content_version(uuid,uuid,integer) TO inkborne_class_origin_owner;
-- Existing class SELECT remains unchanged. Only lock-key UPDATE visibility is
-- added; restrictive WITH CHECK(false) prohibits any actual class-role update.
GRANT UPDATE(character_id) ON private.character_projection_order_v1 TO inkborne_class_origin_owner;
CREATE POLICY first_class_plan_order_lock ON private.character_projection_order_v1 FOR UPDATE
  TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
CREATE POLICY first_class_plan_order_no_update ON private.character_projection_order_v1 AS RESTRICTIVE FOR UPDATE
  TO inkborne_class_origin_owner USING(true) WITH CHECK(false);

CREATE FUNCTION private.lock_first_class_plan_sources_v1(p_context jsonb,p_intent jsonb,p_allocate boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; target uuid; operation uuid; expires timestamptz; parent public.characters%ROWTYPE;
  history jsonb; after_history jsonb; envelope jsonb;
BEGIN
  PERFORM private.validate_first_class_calculation_intent_v1(p_intent);
  IF p_allocate IS NULL OR pg_catalog.jsonb_typeof(p_context) IS DISTINCT FROM 'object'
    OR NOT private.first_class_calculation_exact_keys_v1(p_context,ARRAY['context_version','actor_id','session_id','jwt_expires_at'])
    OR p_context->'context_version' IS DISTINCT FROM '1'::jsonb
    OR COALESCE(p_context->>'actor_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_context->>'session_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_context->>'jwt_expires_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.000000Z$' THEN
    RAISE EXCEPTION 'first_class_plan_context_unavailable' USING ERRCODE='P0001';
  END IF;
  actor:=(p_context->>'actor_id')::uuid; target:=(p_intent->>'character_id')::uuid;
  operation:=(p_intent->>'operation_id')::uuid;
  BEGIN expires:=(p_context->>'jwt_expires_at')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'first_class_plan_context_unavailable' USING ERRCODE='P0001';
  END;
  IF pg_catalog.to_char(expires AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    IS DISTINCT FROM p_context->>'jwt_expires_at' THEN
    RAISE EXCEPTION 'first_class_plan_context_unavailable' USING ERRCODE='P0001';
  END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  PERFORM private.lock_character_writer_guard_v1();
  PERFORM private.check_character_command_clock_v1(expires);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_plan_owner_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  IF EXISTS(SELECT 1 FROM private.character_class_commands_v1 WHERE character_id=target AND operation_id=operation) THEN
    RAISE EXCEPTION 'existing_command_requires_authenticated_recovery' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM private.class_writer_acceptance_v1
      WHERE target_character_id=target AND transaction_id=pg_catalog.pg_current_xact_id()) THEN
    RAISE EXCEPTION 'first_class_plan_must_precede_journal' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM private.character_class_origin_v1 WHERE character_id=target FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_plan_origin_missing' USING ERRCODE='23514'; END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  PERFORM 1 FROM private.character_projection_order_v1 WHERE character_id=target FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_plan_order_missing' USING ERRCODE='23514'; END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  history:=private.read_first_class_bootstrap_history_v1(target);
  IF p_allocate THEN
    envelope:=private.allocate_first_class_save_envelope_v1(p_intent);
    after_history:=private.read_first_class_bootstrap_history_v1(target);
    IF after_history IS DISTINCT FROM history THEN
      RAISE EXCEPTION 'first_class_plan_history_changed' USING ERRCODE='23514';
    END IF;
  END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  RETURN pg_catalog.jsonb_build_object('history',history,'envelope',envelope);
END;
$$;
ALTER FUNCTION private.lock_first_class_plan_sources_v1(jsonb,jsonb,boolean) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.lock_first_class_plan_sources_v1(jsonb,jsonb,boolean)
  FROM PUBLIC,anon,authenticated,service_role,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.lock_first_class_plan_sources_v1(jsonb,jsonb,boolean) TO postgres;

-- No journal FK: this distinct native allocation MUST exist before the pending
-- acceptance. Its acceptance_id will be the exact journal identity, not a claim
-- that a journal exists. No calculation_id/adoption column or adoption path.
CREATE TABLE private.class_first_protected_plans_v1 (
  acceptance_id uuid PRIMARY KEY,
  plan_kind text NOT NULL CHECK(plan_kind='first_class_native_plan_v1'),
  transaction_id xid8 NOT NULL,
  verified_actor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  jwt_expires_at timestamptz NOT NULL,
  target_character_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  bootstrap_acceptance_id uuid NOT NULL,
  verified_context jsonb NOT NULL CHECK(pg_catalog.octet_length(verified_context::text)<=2048),
  canonical_intent jsonb NOT NULL CHECK(pg_catalog.octet_length(canonical_intent::text)<=32768),
  bootstrap_history jsonb NOT NULL CHECK(pg_catalog.octet_length(bootstrap_history::text)<=8388608),
  allocation_envelope jsonb NOT NULL CHECK(pg_catalog.octet_length(allocation_envelope::text)<=8388608),
  created_at timestamptz NOT NULL,
  UNIQUE(transaction_id,target_character_id),
  CHECK(pg_catalog.octet_length(pg_catalog.to_jsonb(verified_context)::text)
    +pg_catalog.octet_length(canonical_intent::text)+pg_catalog.octet_length(bootstrap_history::text)
    +pg_catalog.octet_length(allocation_envelope::text)<=16777216)
);
ALTER TABLE private.class_first_protected_plans_v1 OWNER TO postgres;
ALTER TABLE private.class_first_protected_plans_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.class_first_protected_plans_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY first_class_plan_owner_only ON private.class_first_protected_plans_v1
  FOR ALL TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON TABLE private.class_first_protected_plans_v1
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

CREATE FUNCTION private.guard_first_class_plan_insert_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE history jsonb; envelope jsonb; sources jsonb; target uuid; operation uuid;
  system_key uuid; system_slug text; system_status text; expires timestamptz;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(pg_catalog.to_jsonb(NEW)-ARRAY['verified_context','canonical_intent']) field
    WHERE field.value IS DISTINCT FROM 'null'::jsonb) THEN
    RAISE EXCEPTION 'first_class_plan_native_fields_only' USING ERRCODE='42501';
  END IF;
  PERFORM private.validate_first_class_calculation_intent_v1(NEW.canonical_intent);
  target:=(NEW.canonical_intent->>'character_id')::uuid;
  operation:=(NEW.canonical_intent->>'operation_id')::uuid;
  expires:=private.lock_character_command_actor_rows_v1(NEW.verified_context);
  sources:=private.lock_first_class_plan_sources_v1(NEW.verified_context,NEW.canonical_intent,false);
  history:=sources->'history';
  SELECT system_id INTO system_key FROM public.characters WHERE id=target;
  SELECT slug,status INTO system_slug,system_status FROM public.game_systems WHERE id=system_key FOR SHARE;
  IF NOT FOUND OR system_slug IS DISTINCT FROM 'dnd-5e-2014' OR system_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'first_class_plan_published_system_required' USING ERRCODE='23514';
  END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  -- Selected row locks alone cannot exclude a newly inserted ranked candidate.
  -- Retain this bounded command's SHARE table lock until transaction end.
  LOCK TABLE public.content_versions IN SHARE MODE;
  PERFORM private.check_character_command_clock_v1(expires);
  sources:=private.lock_first_class_plan_sources_v1(NEW.verified_context,NEW.canonical_intent,true);
  IF history IS DISTINCT FROM sources->'history' THEN
    RAISE EXCEPTION 'first_class_plan_history_changed' USING ERRCODE='23514';
  END IF;
  IF history#>>'{before_parent,user_id}' IS DISTINCT FROM NEW.verified_context->>'actor_id' THEN
    RAISE EXCEPTION 'first_class_plan_actor_mismatch' USING ERRCODE='42501';
  END IF;
  envelope:=sources->'envelope';
  IF envelope->'before_parent' IS DISTINCT FROM history->'before_parent'
    OR envelope->'before_origin' IS DISTINCT FROM history->'before_origin'
    OR envelope->'before_order' IS DISTINCT FROM history->'before_order'
    OR envelope#>'{receipt,canonical_intent}' IS DISTINCT FROM NEW.canonical_intent
    OR envelope#>>'{receipt,verified_actor_id}' IS DISTINCT FROM NEW.verified_context->>'actor_id'
    OR envelope->>'transaction_id' IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'first_class_plan_derivation_mismatch' USING ERRCODE='23514';
  END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  NEW.acceptance_id:=(envelope->>'acceptance_id')::uuid;
  NEW.plan_kind:='first_class_native_plan_v1';
  NEW.transaction_id:=pg_catalog.pg_current_xact_id();
  NEW.verified_actor_id:=(NEW.verified_context->>'actor_id')::uuid;
  NEW.session_id:=(NEW.verified_context->>'session_id')::uuid;
  NEW.jwt_expires_at:=expires;
  NEW.target_character_id:=target; NEW.operation_id:=operation;
  NEW.bootstrap_acceptance_id:=(history->>'bootstrap_acceptance_id')::uuid;
  NEW.bootstrap_history:=history; NEW.allocation_envelope:=envelope;
  NEW.created_at:=pg_catalog.transaction_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.refuse_first_class_plan_mutation_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'first_class_plan_is_immutable' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER first_class_plan_insert BEFORE INSERT ON private.class_first_protected_plans_v1
  FOR EACH ROW EXECUTE FUNCTION private.guard_first_class_plan_insert_v1();
CREATE TRIGGER first_class_plan_immutable BEFORE UPDATE OR DELETE ON private.class_first_protected_plans_v1
  FOR EACH ROW EXECUTE FUNCTION private.refuse_first_class_plan_mutation_v1();
CREATE TRIGGER first_class_plan_no_truncate BEFORE TRUNCATE ON private.class_first_protected_plans_v1
  FOR EACH STATEMENT EXECUTE FUNCTION private.refuse_first_class_plan_mutation_v1();

CREATE FUNCTION private.prepare_first_class_protected_plan_v1(p_context jsonb,p_intent jsonb)
RETURNS private.class_first_protected_plans_v1
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE existing private.class_first_protected_plans_v1%ROWTYPE; inserted private.class_first_protected_plans_v1%ROWTYPE;
  target uuid; operation uuid;
BEGIN
  PERFORM private.validate_first_class_calculation_intent_v1(p_intent);
  target:=(p_intent->>'character_id')::uuid; operation:=(p_intent->>'operation_id')::uuid;
  PERFORM private.lock_character_command_actor_rows_v1(p_context);
  -- Receipt recovery must precede empty-draft/source planning. It is left to
  -- the authenticated recovery producer, never inferred from calculation rows.
  SELECT * INTO existing FROM private.class_first_protected_plans_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND target_character_id=target;
  IF FOUND THEN
    IF existing.verified_context IS DISTINCT FROM p_context OR existing.canonical_intent IS DISTINCT FROM p_intent
      OR existing.bootstrap_history IS DISTINCT FROM private.lock_first_class_plan_sources_v1(p_context,p_intent,false)->'history' THEN
      RAISE EXCEPTION 'first_class_plan_same_transaction_conflict' USING ERRCODE='23514';
    END IF;
    RETURN existing;
  END IF;
  INSERT INTO private.class_first_protected_plans_v1(verified_context,canonical_intent) VALUES(p_context,p_intent)
    RETURNING * INTO inserted;
  RETURN inserted;
END;
$$;

-- Additive binding, not a replacement of any frozen original function. This
-- trigger sorts after class_origin_acceptance_guard, whose unchanged body has
-- validated actual before-parent/origin correspondence. It needs no class-role
-- SELECT on the plan table and grants no ability to invoke the planner.
CREATE FUNCTION private.bind_first_class_plan_journal_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE plan private.class_first_protected_plans_v1%ROWTYPE;
BEGIN
  IF NEW.acceptance_kind<>'class_transition' THEN RETURN NEW; END IF;
  IF NEW.before_parent->'choices' IS DISTINCT FROM '{}'::jsonb
    OR NEW.before_origin->>'command_revision' IS DISTINCT FROM '0' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO plan FROM private.class_first_protected_plans_v1 WHERE acceptance_id=NEW.acceptance_id;
  IF NOT FOUND OR plan.plan_kind<>'first_class_native_plan_v1'
    OR plan.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
    OR NEW.transaction_id IS DISTINCT FROM plan.transaction_id
    OR NEW.verified_actor_id IS DISTINCT FROM plan.verified_actor_id
    OR NEW.target_character_id IS DISTINCT FROM plan.target_character_id
    OR NEW.receipt->>'operation_id' IS DISTINCT FROM plan.operation_id::text
    OR NEW.receipt->'canonical_intent' IS DISTINCT FROM plan.canonical_intent
    OR NEW.before_parent IS DISTINCT FROM plan.allocation_envelope->'before_parent'
    OR NEW.before_origin IS DISTINCT FROM plan.allocation_envelope->'before_origin'
    OR NEW.expected_graph IS DISTINCT FROM plan.allocation_envelope->'expected_graph'
    OR NEW.planned_transitions IS DISTINCT FROM plan.allocation_envelope->'planned_transitions'
    OR NEW.receipt IS DISTINCT FROM plan.allocation_envelope->'receipt'
    OR NEW.preinsert_proof IS NOT NULL OR NEW.finalized OR NEW.revision_transition_consumed THEN
    RAISE EXCEPTION 'first_class_plan_journal_mismatch' USING ERRCODE='42501';
  END IF;
  PERFORM private.lock_character_command_actor_rows_v1(plan.verified_context);
  IF private.lock_first_class_plan_sources_v1(plan.verified_context,plan.canonical_intent,false)->'history' IS DISTINCT FROM plan.bootstrap_history THEN
    RAISE EXCEPTION 'first_class_plan_history_changed' USING ERRCODE='23514';
  END IF;
  PERFORM private.check_character_command_clock_v1(plan.jwt_expires_at);
  RETURN NEW;
END;
$$;
CREATE TRIGGER class_origin_first_plan_binding BEFORE INSERT ON private.class_writer_acceptance_v1
  FOR EACH ROW EXECUTE FUNCTION private.bind_first_class_plan_journal_v1();

ALTER FUNCTION private.guard_first_class_plan_insert_v1() OWNER TO postgres;
ALTER FUNCTION private.refuse_first_class_plan_mutation_v1() OWNER TO postgres;
ALTER FUNCTION private.prepare_first_class_protected_plan_v1(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION private.bind_first_class_plan_journal_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.guard_first_class_plan_insert_v1(),private.refuse_first_class_plan_mutation_v1(),
  private.prepare_first_class_protected_plan_v1(jsonb,jsonb),private.bind_first_class_plan_journal_v1()
  FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
DO $closed_acl$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,
      LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) privilege
    WHERE p.oid IN ('private.guard_first_class_plan_insert_v1()'::pg_catalog.regprocedure,
      'private.refuse_first_class_plan_mutation_v1()'::pg_catalog.regprocedure,
      'private.prepare_first_class_protected_plan_v1(jsonb,jsonb)'::pg_catalog.regprocedure,
      'private.bind_first_class_plan_journal_v1()'::pg_catalog.regprocedure)
      AND privilege.grantee<>p.proowner)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p,
      LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) privilege
      WHERE p.oid='private.lock_first_class_plan_sources_v1(jsonb,jsonb,boolean)'::pg_catalog.regprocedure
        AND privilege.grantee NOT IN (p.proowner,'postgres'::pg_catalog.regrole::oid))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
      LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) privilege
    WHERE c.oid='private.class_first_protected_plans_v1'::pg_catalog.regclass AND privilege.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'first_class_plan_unexpected_default_acl' USING ERRCODE='42501';
  END IF;
END;
$closed_acl$;
COMMIT;
