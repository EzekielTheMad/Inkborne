-- P1b.1 SOURCE ONLY, UNAPPLIED. Load AFTER UNCHANGED R09 authority and P1a.
-- Auth remains unavailable; no caller issuer, activation, bootstrap or order producer.
-- One source writer; both original object-owner families require independent review.
BEGIN;
DO $$ DECLARE signature text; BEGIN
  FOREACH signature IN ARRAY ARRAY['private.lock_character_writer_guard_v1()',
    'private.hit_die_character_revision_v1()','private.hit_die_order_revision_rebind_v1()',
    'private.class_origin_acceptance_guard_v1()','private.class_origin_finalize_transition_v1(uuid)',
    'private.class_origin_finalize_acceptance_v1(uuid)','private.class_origin_receipt_shape_v1(jsonb)'] LOOP
    IF pg_catalog.to_regprocedure(signature) IS NULL THEN RAISE EXCEPTION 'Joint prerequisite absent' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid IN (
      'private.hit_die_character_revision_v1()'::pg_catalog.regprocedure,
      'private.hit_die_order_revision_rebind_v1()'::pg_catalog.regprocedure)
    AND proowner<>'inkborne_hit_die_authority_owner'::pg_catalog.regrole)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid IN (
      'private.class_origin_acceptance_guard_v1()'::pg_catalog.regprocedure,
      'private.class_origin_finalize_transition_v1(uuid)'::pg_catalog.regprocedure,
      'private.class_origin_finalize_acceptance_v1(uuid)'::pg_catalog.regprocedure)
    AND proowner<>'inkborne_class_origin_owner'::pg_catalog.regrole) THEN
    RAISE EXCEPTION 'Original joint owner mismatch' USING ERRCODE='42501'; END IF;
  IF (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1 WHERE NOT ready)<>13
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'Joint stage cannot activate writers' USING ERRCODE='23514'; END IF;
END $$;

-- 1: native constraints and policies first. No forward function references in CHECK.
CREATE TABLE private.class_origin_revision_events_v1 (
  event_version integer NOT NULL CHECK(event_version=1), mode text NOT NULL CHECK(mode='metadata_only_confirm'),
  acceptance_id uuid PRIMARY KEY REFERENCES private.class_writer_acceptance_v1(acceptance_id) ON DELETE RESTRICT,
  transaction_id xid8 NOT NULL, target_character_id uuid NOT NULL, verified_actor_id uuid NOT NULL, operation_id uuid NOT NULL,
  before_action_revision bigint NOT NULL CHECK(before_action_revision>=0 AND before_action_revision<9223372036854775807),
  after_action_revision bigint NOT NULL CHECK(after_action_revision=before_action_revision+1),
  origin_transition_key jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(origin_transition_key)='array' AND pg_catalog.jsonb_array_length(origin_transition_key)=1),
  occurrence_transition_key jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(occurrence_transition_key)='array' AND pg_catalog.jsonb_array_length(occurrence_transition_key)=1),
  before_parent jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(before_parent)='object'),
  expected_after_parent jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(expected_after_parent)='object'),
  before_order jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(before_order)='object'),
  phase text NOT NULL CHECK(phase IN ('pending','assigned','observed')),
  observed_parent jsonb, observed_order jsonb,
  CHECK((phase='observed')=(observed_parent IS NOT NULL AND observed_order IS NOT NULL)),
  CHECK(phase='observed' OR (observed_parent IS NULL AND observed_order IS NULL)),
  UNIQUE(transaction_id,target_character_id)
);
ALTER TABLE private.class_origin_revision_events_v1 OWNER TO inkborne_hit_die_authority_owner;
ALTER TABLE private.class_origin_revision_events_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.class_origin_revision_events_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON private.class_origin_revision_events_v1 TO inkborne_hit_die_authority_owner;
GRANT UPDATE(phase,observed_parent,observed_order) ON private.class_origin_revision_events_v1 TO inkborne_hit_die_authority_owner;
GRANT SELECT ON private.class_origin_revision_events_v1 TO inkborne_class_origin_owner;
CREATE POLICY class_origin_event_authority_read ON private.class_origin_revision_events_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING(true);
CREATE POLICY class_origin_event_authority_insert ON private.class_origin_revision_events_v1 FOR INSERT TO inkborne_hit_die_authority_owner WITH CHECK(true);
CREATE POLICY class_origin_event_authority_update ON private.class_origin_revision_events_v1 FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(true);
CREATE POLICY class_origin_event_class_read ON private.class_origin_revision_events_v1 FOR SELECT TO inkborne_class_origin_owner USING(true);

-- 2: class validator derives genuine actual stored metadata; no event/parent write.
CREATE FUNCTION private.class_origin_metadata_delta_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE j private.class_writer_acceptance_v1%ROWTYPE; c public.characters%ROWTYPE;
  origin private.character_class_origin_v1%ROWTYPE; occurrence private.character_class_occurrences_v1%ROWTYPE;
  origin_proof private.class_writer_row_transitions_v1%ROWTYPE; occurrence_proof private.class_writer_row_transitions_v1%ROWTYPE;
  selected uuid; matches bigint; origin_json jsonb; before_shared bigint; before_class bigint; BEGIN
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND OR j.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR j.acceptance_kind<>'class_transition'
    OR j.receipt#>>'{canonical_intent,command}' IS DISTINCT FROM 'confirm_origin'
    OR NOT private.class_origin_receipt_shape_v1(j.receipt) THEN
    RAISE EXCEPTION 'Exact metadata acceptance required' USING ERRCODE='23514'; END IF;
  before_shared:=(j.before_parent->>'action_revision')::bigint; before_class:=(j.before_origin->>'command_revision')::bigint;
  IF before_shared=9223372036854775807 OR before_class=9223372036854775807 THEN
    RAISE EXCEPTION 'Revision exhausted' USING ERRCODE='22003'; END IF;
  selected:=(j.receipt#>>'{canonical_intent,fields,selected_occurrence_id}')::uuid;
  SELECT * INTO c FROM public.characters WHERE id=j.target_character_id;
  IF NOT FOUND OR c.user_id IS DISTINCT FROM j.verified_actor_id OR c.system_id::text IS DISTINCT FROM j.before_parent->>'system_id'
    OR j.receipt->>'target_character_id' IS DISTINCT FROM c.id::text OR j.receipt->>'verified_actor_id' IS DISTINCT FROM c.user_id::text
    OR j.receipt#>>'{canonical_intent,character_id}' IS DISTINCT FROM c.id::text
    OR j.receipt#>>'{canonical_intent,operation_id}' IS DISTINCT FROM j.receipt->>'operation_id'
    OR j.receipt->>'before_action_revision' IS DISTINCT FROM before_shared::text
    OR j.receipt->>'after_action_revision' IS DISTINCT FROM (before_shared+1)::text
    OR j.receipt->>'before_class_revision' IS DISTINCT FROM before_class::text
    OR j.receipt->>'after_class_revision' IS DISTINCT FROM (before_class+1)::text
    OR j.receipt#>>'{canonical_intent,expected_action_revision}' IS DISTINCT FROM before_shared::text
    OR j.receipt#>>'{canonical_intent,expected_class_revision}' IS DISTINCT FROM before_class::text
    OR j.before_parent#>>'{choices,classes,0,occurrence_id}' IS DISTINCT FROM selected::text
    OR j.expected_graph#>'{parent}' IS DISTINCT FROM (j.before_parent||pg_catalog.jsonb_build_object('action_revision',(before_shared+1)::text)) THEN
    RAISE EXCEPTION 'Already-first metadata-only identity required' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*) INTO matches FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
    AND relation_key='origin' AND row_key=pg_catalog.jsonb_build_array(c.id) AND consumed;
  IF matches<>1 THEN RAISE EXCEPTION 'Consumed actual origin proof required' USING ERRCODE='23514'; END IF;
  SELECT * INTO origin_proof FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
    AND relation_key='origin' AND row_key=pg_catalog.jsonb_build_array(c.id) AND consumed;
  SELECT * INTO origin FROM private.character_class_origin_v1 WHERE character_id=c.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actual origin missing' USING ERRCODE='23514'; END IF;
  origin_json:=pg_catalog.to_jsonb(origin)||pg_catalog.jsonb_build_object('command_revision',origin.command_revision::text);
  IF origin_proof.before_row IS DISTINCT FROM j.before_origin OR origin_proof.after_row IS DISTINCT FROM origin_json
    OR origin_json IS DISTINCT FROM j.expected_graph->'origin' OR j.before_origin->>'origin_status' IS DISTINCT FROM 'draft'
    OR j.before_origin->'origin_occurrence_id' IS DISTINCT FROM 'null'::jsonb
    OR j.before_origin->'role_proof' IS DISTINCT FROM 'null'::jsonb
    OR origin.origin_status<>'recorded' OR origin.origin_occurrence_id IS DISTINCT FROM selected
    OR origin.creation_provenance IS NULL OR origin.creation_provenance NOT IN ('new_character','fresh_draft_copy') OR origin.creation_operation_id IS NULL
    OR origin.system_id IS DISTINCT FROM c.system_id OR origin.command_revision<>before_class+1
    OR origin.role_proof IS DISTINCT FROM pg_catalog.jsonb_build_object('kind','confirmation','receipt',j.receipt->'confirmation')
    OR (origin_json-ARRAY['command_revision','origin_status','origin_occurrence_id','role_proof'])
      IS DISTINCT FROM (j.before_origin-ARRAY['command_revision','origin_status','origin_occurrence_id','role_proof'])
    OR j.receipt#>>'{confirmation,canonical_intent,character_id}' IS DISTINCT FROM c.id::text
    OR j.receipt#>>'{confirmation,canonical_intent,operation_id}' IS DISTINCT FROM j.receipt->>'operation_id'
    OR j.receipt#>>'{confirmation,canonical_intent,selected_occurrence_id}' IS DISTINCT FROM selected::text
    OR j.receipt#>>'{confirmation,canonical_intent,expected_revision}' IS DISTINCT FROM before_class::text
    OR j.receipt#>>'{confirmation,applied_revision}' IS DISTINCT FROM (before_class+1)::text
    OR j.receipt#>>'{confirmation,accepted_at}' IS DISTINCT FROM j.receipt->>'accepted_at' THEN
    RAISE EXCEPTION 'Stored origin transition mismatch' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*) INTO matches FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
    AND relation_key='occurrence' AND row_key=pg_catalog.jsonb_build_array(selected) AND consumed;
  IF matches<>1 THEN RAISE EXCEPTION 'Consumed selected occurrence required' USING ERRCODE='23514'; END IF;
  SELECT * INTO occurrence_proof FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
    AND relation_key='occurrence' AND row_key=pg_catalog.jsonb_build_array(selected) AND consumed;
  SELECT * INTO occurrence FROM private.character_class_occurrences_v1 WHERE id=selected AND character_id=c.id;
  IF NOT FOUND OR occurrence_proof.before_row IS NULL OR occurrence_proof.before_row->>'lifecycle' IS DISTINCT FROM 'provisional'
    OR occurrence_proof.before_row->'accepted_at' IS DISTINCT FROM 'null'::jsonb
    OR occurrence_proof.before_row->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb
    OR occurrence_proof.before_row->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb
    OR occurrence_proof.before_row->'ended_at' IS DISTINCT FROM 'null'::jsonb
    OR occurrence.lifecycle<>'accepted' OR occurrence.acquired_character_level IS DISTINCT FROM 1
    OR occurrence.system_id IS DISTINCT FROM c.system_id OR occurrence.ended_at IS NOT NULL
    OR occurrence.acquisition_operation_id IS DISTINCT FROM (j.receipt->>'operation_id')::uuid
    OR occurrence.accepted_at IS DISTINCT FROM (j.receipt->>'accepted_at')::timestamptz
    OR occurrence.selected_at>occurrence.accepted_at
    OR occurrence_proof.after_row IS DISTINCT FROM pg_catalog.to_jsonb(occurrence)
    OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['id','character_id','system_id','content_id','content_version','class_slug','selected_at','controller_ref_id']) key(name)
      WHERE occurrence_proof.before_row->name IS DISTINCT FROM occurrence_proof.after_row->name)
    OR NOT EXISTS(SELECT 1 FROM public.character_content_refs ref JOIN public.content_versions version
      ON version.content_id=ref.content_id AND version.version=ref.content_version WHERE ref.id=occurrence.controller_ref_id
      AND ref.character_id=c.id AND ref.content_id=occurrence.content_id AND ref.content_version=occurrence.content_version
      AND ref.context->>'source'='class' AND version.content_type_snapshot='class' AND version.system_id_snapshot=c.system_id
      AND version.slug_snapshot=occurrence.class_slug) THEN
    RAISE EXCEPTION 'Stored selected acquisition mismatch' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('acceptance_id',j.acceptance_id,'transaction_id',j.transaction_id::text,
    'target_character_id',c.id,'verified_actor_id',c.user_id,'operation_id',j.receipt->>'operation_id',
    'before_action_revision',before_shared::text,'after_action_revision',(before_shared+1)::text,
    'origin_transition_key',pg_catalog.jsonb_build_array(c.id),'occurrence_transition_key',pg_catalog.jsonb_build_array(selected),
    'before_parent',j.before_parent,'expected_after_parent',j.expected_graph->'parent',
    'acceptance_finalized',j.finalized,'revision_transition_consumed',j.revision_transition_consumed);
END $$;
ALTER FUNCTION private.class_origin_metadata_delta_v1(uuid) OWNER TO inkborne_class_origin_owner;

-- 3: actual observed evidence may precede receipt insertion/finalization.
CREATE FUNCTION private.class_origin_observed_revision_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE event private.class_origin_revision_events_v1%ROWTYPE; candidate jsonb; parent_json jsonb; order_json jsonb; BEGIN
  candidate:=private.class_origin_metadata_delta_v1(p_acceptance);
  SELECT * INTO event FROM private.class_origin_revision_events_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND OR event.phase<>'observed' OR event.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
    OR (pg_catalog.to_jsonb(event)-ARRAY['event_version','mode','phase','observed_parent','observed_order','before_order','before_action_revision','after_action_revision','transaction_id'])
      IS DISTINCT FROM (candidate-ARRAY['before_action_revision','after_action_revision','transaction_id','acceptance_finalized','revision_transition_consumed'])
    OR event.before_action_revision::text IS DISTINCT FROM candidate->>'before_action_revision'
    OR event.after_action_revision::text IS DISTINCT FROM candidate->>'after_action_revision' THEN
    RAISE EXCEPTION 'Observed event identity required' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text) INTO parent_json
    FROM public.characters c WHERE c.id=event.target_character_id AND c.user_id=event.verified_actor_id;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text) INTO order_json
    FROM private.character_projection_order_v1 o WHERE o.character_id=event.target_character_id;
  IF parent_json IS DISTINCT FROM event.expected_after_parent OR event.observed_parent IS DISTINCT FROM parent_json
    OR order_json IS DISTINCT FROM (event.before_order||pg_catalog.jsonb_build_object('producer_revision',event.after_action_revision::text))
    OR event.observed_order IS DISTINCT FROM order_json THEN
    RAISE EXCEPTION 'Observed actual parent order mismatch' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.to_jsonb(event);
END $$;
ALTER FUNCTION private.class_origin_observed_revision_v1(uuid) OWNER TO inkborne_class_origin_owner;

-- 4: finalized assertion and one Boolean consumer are intentionally distinct.
CREATE FUNCTION private.class_origin_assert_metadata_revision_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; BEGIN
  PERFORM private.class_origin_observed_revision_v1(p_acceptance);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT j.finalized OR NOT j.revision_transition_consumed OR NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1
    WHERE character_id=j.target_character_id AND operation_id=(j.receipt->>'operation_id')::uuid AND receipt=j.receipt) THEN
    RAISE EXCEPTION 'Finalized event receipt required' USING ERRCODE='23514'; END IF;
END $$;
ALTER FUNCTION private.class_origin_assert_metadata_revision_v1(uuid) OWNER TO inkborne_class_origin_owner;
CREATE FUNCTION private.class_origin_consume_metadata_revision_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE changed bigint; BEGIN
  PERFORM private.class_origin_observed_revision_v1(p_acceptance);
  UPDATE private.class_writer_acceptance_v1 SET revision_transition_consumed=true
    WHERE acceptance_id=p_acceptance AND transaction_id=pg_catalog.pg_current_xact_id() AND NOT finalized AND NOT revision_transition_consumed;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Revision proof is one use' USING ERRCODE='42501'; END IF;
END $$;
ALTER FUNCTION private.class_origin_consume_metadata_revision_v1(uuid) OWNER TO inkborne_class_origin_owner;

-- 5: NEW observed row is checked directly before it replaces assigned.
CREATE FUNCTION private.class_origin_revision_event_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE candidate jsonb; parent_json jsonb; order_json jsonb; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Revision event retained' USING ERRCODE='42501'; END IF;
  IF NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR pg_catalog.octet_length(pg_catalog.to_jsonb(NEW)::text)>8388608 THEN
    RAISE EXCEPTION 'Bounded current event required' USING ERRCODE='23514'; END IF;
  candidate:=private.class_origin_metadata_delta_v1(NEW.acceptance_id);
  IF (pg_catalog.to_jsonb(NEW)-ARRAY['event_version','mode','phase','observed_parent','observed_order','before_order','before_action_revision','after_action_revision','transaction_id'])
      IS DISTINCT FROM (candidate-ARRAY['before_action_revision','after_action_revision','transaction_id','acceptance_finalized','revision_transition_consumed'])
    OR NEW.transaction_id::text IS DISTINCT FROM candidate->>'transaction_id'
    OR NEW.before_action_revision::text IS DISTINCT FROM candidate->>'before_action_revision'
    OR NEW.after_action_revision::text IS DISTINCT FROM candidate->>'after_action_revision' THEN
    RAISE EXCEPTION 'Event actual metadata correspondence required' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (pg_catalog.to_jsonb(NEW)-ARRAY['phase','observed_parent','observed_order'])
    IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)-ARRAY['phase','observed_parent','observed_order']) THEN
    RAISE EXCEPTION 'Immutable revision identity' USING ERRCODE='42501'; END IF;
  -- Protected journal facts come ONLY from class-owned validator; no authority journal SELECT/DML grant.
  SELECT pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text) INTO parent_json
    FROM public.characters c WHERE c.id=NEW.target_character_id AND c.user_id=NEW.verified_actor_id;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text) INTO order_json
    FROM private.character_projection_order_v1 o WHERE o.character_id=NEW.target_character_id;
  IF candidate->'acceptance_finalized' IS DISTINCT FROM 'false'::jsonb OR candidate->'revision_transition_consumed' IS DISTINCT FROM 'false'::jsonb
    OR TG_OP='INSERT' AND (NEW.phase<>'pending'
    OR parent_json IS DISTINCT FROM NEW.before_parent OR order_json IS DISTINCT FROM NEW.before_order)
    OR TG_OP='UPDATE' AND NOT COALESCE((OLD.phase='pending' AND NEW.phase='assigned' AND parent_json=NEW.before_parent AND order_json=NEW.before_order)
      OR (OLD.phase='assigned' AND NEW.phase='observed' AND parent_json=NEW.expected_after_parent
        AND order_json=(NEW.before_order||pg_catalog.jsonb_build_object('producer_revision',NEW.after_action_revision::text))
        AND NEW.observed_parent=parent_json AND NEW.observed_order=order_json),false) THEN
    RAISE EXCEPTION 'Exact pending assigned observed sequence required' USING ERRCODE='23514'; END IF;
  IF NEW.before_order->>'character_id' IS DISTINCT FROM NEW.target_character_id::text OR NEW.before_order->'producer_version' IS DISTINCT FROM '1'::jsonb
    OR NEW.before_order->>'producer_revision' IS DISTINCT FROM NEW.before_action_revision::text THEN
    RAISE EXCEPTION 'Existing semantic order required' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION private.class_origin_revision_event_guard_v1() OWNER TO inkborne_hit_die_authority_owner;

-- 6: sole meaningful counter mutation, owned by existing R09 authority role.
CREATE FUNCTION private.apply_class_metadata_revision_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate jsonb; c public.characters%ROWTYPE; after_row public.characters%ROWTYPE; ordering private.character_projection_order_v1%ROWTYPE;
  parent_json jsonb; after_json jsonb; order_json jsonb; before_shared bigint; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  candidate:=private.class_origin_metadata_delta_v1(p_acceptance);
  SELECT * INTO c FROM public.characters WHERE id=(candidate->>'target_character_id')::uuid AND user_id=(candidate->>'verified_actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned parent unavailable' USING ERRCODE='42501'; END IF;
  parent_json:=pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text);
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=c.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order producer unavailable' USING ERRCODE='23514'; END IF;
  order_json:=pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text);
  before_shared:=(candidate->>'before_action_revision')::bigint;
  IF parent_json IS DISTINCT FROM candidate->'before_parent' OR ordering.producer_version<>1 OR ordering.producer_revision<>before_shared THEN
    RAISE EXCEPTION 'Actual before parent order mismatch' USING ERRCODE='23514'; END IF;
  INSERT INTO private.class_origin_revision_events_v1(event_version,mode,acceptance_id,transaction_id,target_character_id,verified_actor_id,operation_id,
    before_action_revision,after_action_revision,origin_transition_key,occurrence_transition_key,before_parent,expected_after_parent,before_order,phase)
    VALUES(1,'metadata_only_confirm',p_acceptance,pg_catalog.pg_current_xact_id(),c.id,c.user_id,(candidate->>'operation_id')::uuid,
      before_shared,before_shared+1,candidate->'origin_transition_key',candidate->'occurrence_transition_key',parent_json,candidate->'expected_after_parent',order_json,'pending');
  UPDATE public.characters SET action_revision=before_shared+1 WHERE id=c.id AND user_id=c.user_id AND action_revision=before_shared RETURNING * INTO after_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sole revision update missing' USING ERRCODE='23514'; END IF;
  after_json:=pg_catalog.to_jsonb(after_row)||pg_catalog.jsonb_build_object('action_revision',after_row.action_revision::text);
  SELECT pg_catalog.to_jsonb(stored)||pg_catalog.jsonb_build_object('action_revision',stored.action_revision::text) INTO parent_json
    FROM public.characters stored WHERE stored.id=c.id AND stored.user_id=c.user_id;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text) INTO order_json
    FROM private.character_projection_order_v1 o WHERE o.character_id=c.id;
  IF after_json IS DISTINCT FROM candidate->'expected_after_parent' OR parent_json IS DISTINCT FROM after_json
    OR order_json IS DISTINCT FROM (pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',(before_shared+1)::text)) THEN
    RAISE EXCEPTION 'Actual returning stored order readback mismatch' USING ERRCODE='23514'; END IF;
  UPDATE private.class_origin_revision_events_v1 SET phase='observed',observed_parent=parent_json,observed_order=order_json
    WHERE acceptance_id=p_acceptance AND phase='assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'Assigned event missing' USING ERRCODE='23514'; END IF;
  PERFORM private.class_origin_consume_metadata_revision_v1(p_acceptance);
END $$;
ALTER FUNCTION private.apply_class_metadata_revision_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;

-- 7: no redundant base-finalizer call / no extra cross-owner EXECUTE grant.
CREATE FUNCTION private.class_origin_revision_event_closure_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM private.class_origin_assert_metadata_revision_v1(NEW.acceptance_id); RETURN NEW;
END $$;
ALTER FUNCTION private.class_origin_revision_event_closure_v1() OWNER TO inkborne_hit_die_authority_owner;
CREATE FUNCTION private.class_origin_metadata_revision_dispatch_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE candidate_id uuid; matches bigint; BEGIN
  IF OLD.origin_status='draft' AND NEW.origin_status='recorded' THEN
    SELECT pg_catalog.count(*),pg_catalog.min(j.acceptance_id::text)::uuid INTO matches,candidate_id
      FROM private.class_writer_acceptance_v1 j JOIN private.class_writer_row_transitions_v1 proof USING(acceptance_id)
      WHERE j.transaction_id=pg_catalog.pg_current_xact_id() AND j.target_character_id=NEW.character_id
        AND NOT j.finalized AND NOT j.revision_transition_consumed AND j.acceptance_kind='class_transition'
        AND proof.relation_key='origin' AND proof.consumed AND proof.row_key=pg_catalog.jsonb_build_array(NEW.character_id)
        AND proof.before_row=(pg_catalog.to_jsonb(OLD)||pg_catalog.jsonb_build_object('command_revision',OLD.command_revision::text))
        AND proof.after_row=(pg_catalog.to_jsonb(NEW)||pg_catalog.jsonb_build_object('command_revision',NEW.command_revision::text));
    IF matches<>1 THEN RAISE EXCEPTION 'One actual origin event required' USING ERRCODE='23514'; END IF;
    PERFORM private.class_origin_metadata_delta_v1(candidate_id);
    PERFORM private.apply_class_metadata_revision_v1(candidate_id);
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION private.class_origin_metadata_revision_dispatch_v1() OWNER TO inkborne_class_origin_owner;

-- Replacements and trigger installation follow ONLY after every helper exists.

-- 8: exact frozen class bodies, plus only the reviewed observed-proof calls.
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
      PERFORM private.class_origin_observed_revision_v1(NEW.acceptance_id);
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
  PERFORM private.class_origin_assert_metadata_revision_v1(p_acceptance);
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

-- 9: existing ordinary watched branch is retained verbatim below the protected path.
CREATE OR REPLACE FUNCTION private.hit_die_character_revision_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE event private.class_origin_revision_events_v1%ROWTYPE; event_count bigint; candidate jsonb;
BEGIN
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
ALTER FUNCTION private.hit_die_character_revision_v1() OWNER TO inkborne_hit_die_authority_owner;

-- 10: no new trigger until every function, replacement and dependency exists.
CREATE TRIGGER class_origin_revision_event_guard BEFORE INSERT OR UPDATE OR DELETE ON private.class_origin_revision_events_v1
  FOR EACH ROW EXECUTE FUNCTION private.class_origin_revision_event_guard_v1();
CREATE TRIGGER class_origin_metadata_revision_dispatch AFTER UPDATE ON private.character_class_origin_v1
  FOR EACH ROW EXECUTE FUNCTION private.class_origin_metadata_revision_dispatch_v1();
CREATE CONSTRAINT TRIGGER class_origin_revision_event_closure AFTER INSERT OR UPDATE ON private.class_origin_revision_events_v1
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.class_origin_revision_event_closure_v1();
-- Existing P1a acceptance/transition deferred triggers still supply full normal closure.
-- Existing R09 AFTER order-rebind trigger remains the only producer_revision UPDATE.

-- 11: same-transaction ACL closure, not caller activation.
REVOKE ALL ON FUNCTION private.class_origin_metadata_delta_v1(uuid),private.class_origin_observed_revision_v1(uuid),
  private.class_origin_assert_metadata_revision_v1(uuid),private.class_origin_consume_metadata_revision_v1(uuid),
  private.class_origin_revision_event_guard_v1(),private.apply_class_metadata_revision_v1(uuid),
  private.class_origin_revision_event_closure_v1(),private.class_origin_metadata_revision_dispatch_v1(),
  private.class_origin_acceptance_guard_v1(),private.class_origin_finalize_transition_v1(uuid),private.hit_die_character_revision_v1()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.class_origin_metadata_delta_v1(uuid),private.class_origin_consume_metadata_revision_v1(uuid),
  private.class_origin_assert_metadata_revision_v1(uuid) TO inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.apply_class_metadata_revision_v1(uuid) TO inkborne_class_origin_owner;
-- NO EXECUTE grant on class_origin_finalize_acceptance_v1, NO journal DML grant to authority.
-- NO caller grants/membership/schema CREATE, NO Auth/readiness/order/issuer change.
COMMIT;
