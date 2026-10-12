-- P1b.2 SOURCE ONLY; not a migration or executed grant. Load AFTER unchanged
-- R09 authority, P1a and joint stages. Auth always denies; all readiness stays false.
-- No bootstrap/add-class compiler/writer/copy/app cutover is supplied here.
BEGIN;
DO $$ BEGIN
  IF pg_catalog.to_regprocedure('private.apply_class_metadata_revision_v1(uuid)') IS NULL
    OR pg_catalog.to_regprocedure('private.class_origin_finalize_acceptance_v1(uuid)') IS NULL
    OR pg_catalog.to_regprocedure('private.require_verified_hit_die_auth_v1(jsonb)') IS NULL
    OR (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE singleton AND NOT enabled)
    OR (SELECT r.rolname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
        WHERE p.oid='private.apply_class_metadata_revision_v1(uuid)'::regprocedure) IS DISTINCT FROM 'inkborne_hit_die_authority_owner'
    OR (SELECT r.rolname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
        WHERE p.oid='private.class_origin_finalize_acceptance_v1(uuid)'::regprocedure) IS DISTINCT FROM 'inkborne_class_origin_owner' THEN
    RAISE EXCEPTION 'Frozen prerequisite/owner/disabled manifest required' USING ERRCODE='42501';
  END IF;
END $$;
-- Read-key lock visibility only. Restrictive WITH CHECK(false) still denies DML.
GRANT UPDATE(id) ON public.character_content_refs,public.character_inventory,public.character_spells,
  public.character_feature_grants,public.character_spell_grants TO inkborne_hit_die_authority_owner;
DO $$ DECLARE relation_name text; BEGIN
  FOREACH relation_name IN ARRAY ARRAY['character_content_refs','character_inventory','character_spells','character_feature_grants','character_spell_grants'] LOOP
    EXECUTE pg_catalog.format('CREATE POLICY class_confirmation_lock ON public.%I FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(false)',relation_name);
    EXECUTE pg_catalog.format('CREATE POLICY class_confirmation_no_mutation ON public.%I AS RESTRICTIVE FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(false)',relation_name);
  END LOOP;
END $$;

CREATE FUNCTION private.class_confirmation_private_inputs_v1(p_character_id uuid,p_selected_occurrence_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE origin private.character_class_origin_v1%ROWTYPE; occurrence private.character_class_occurrences_v1%ROWTYPE;
  creation private.character_creation_commands_v1%ROWTYPE; bootstrap private.class_writer_acceptance_v1%ROWTYPE;
  selection private.class_writer_acceptance_v1%ROWTYPE; insertion private.class_writer_row_transitions_v1%ROWTYPE;
  occurrence_ids uuid[]; required jsonb; result jsonb; matching bigint; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO origin FROM private.character_class_origin_v1 WHERE character_id=p_character_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'draft_provenance_unavailable' USING ERRCODE='23514'; END IF;
  PERFORM id FROM private.character_class_occurrences_v1 WHERE character_id=p_character_id ORDER BY id FOR UPDATE;
  SELECT * INTO occurrence FROM private.character_class_occurrences_v1 WHERE id=p_selected_occurrence_id AND character_id=p_character_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'selected_occurrence_unavailable' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.array_agg(id ORDER BY id),ARRAY[]::uuid[]) INTO occurrence_ids
    FROM private.character_class_occurrences_v1 WHERE character_id=p_character_id;
  IF pg_catalog.cardinality(occurrence_ids)>256 THEN RAISE EXCEPTION 'retained_occurrence_budget' USING ERRCODE='23514'; END IF;
  -- Receipts are immutable under unchanged P1a guards; no receipt UPDATE lock grant.
  SELECT * INTO creation FROM private.character_creation_commands_v1 WHERE target_character_id=p_character_id AND operation_id=origin.creation_operation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'creation_history_unavailable' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_acceptance_v1
    WHERE target_character_id=p_character_id AND acceptance_kind='bootstrap_new' AND finalized AND receipt=creation.receipt;
  IF matching<>1 THEN RAISE EXCEPTION 'bootstrap_history_unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO bootstrap FROM private.class_writer_acceptance_v1
    WHERE target_character_id=p_character_id AND acceptance_kind='bootstrap_new' AND finalized AND receipt=creation.receipt FOR SHARE;
  SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_row_transitions_v1 t JOIN private.class_writer_acceptance_v1 j USING(acceptance_id)
    WHERE t.relation_key='occurrence' AND t.row_key=pg_catalog.jsonb_build_array(p_selected_occurrence_id) AND t.before_row IS NULL AND t.consumed
      AND j.target_character_id=p_character_id AND j.acceptance_kind='class_transition' AND j.finalized
      AND j.receipt#>>'{canonical_intent,command}'='add_class';
  IF matching<>1 THEN RAISE EXCEPTION 'selection_history_unavailable' USING ERRCODE='23514'; END IF;
  SELECT t.* INTO insertion FROM private.class_writer_row_transitions_v1 t JOIN private.class_writer_acceptance_v1 j USING(acceptance_id)
    WHERE t.relation_key='occurrence' AND t.row_key=pg_catalog.jsonb_build_array(p_selected_occurrence_id) AND t.before_row IS NULL AND t.consumed
      AND j.target_character_id=p_character_id AND j.acceptance_kind='class_transition' AND j.finalized
      AND j.receipt#>>'{canonical_intent,command}'='add_class' FOR SHARE OF t;
  SELECT * INTO selection FROM private.class_writer_acceptance_v1 WHERE acceptance_id=insertion.acceptance_id FOR SHARE;
  PERFORM t.acceptance_id FROM private.class_writer_row_transitions_v1 t
    WHERE t.acceptance_id IN (bootstrap.acceptance_id,selection.acceptance_id) ORDER BY t.acceptance_id,t.relation_key,t.row_key FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1 WHERE character_id=p_character_id
      AND operation_id=(selection.receipt->>'operation_id')::uuid AND receipt=selection.receipt) THEN
    RAISE EXCEPTION 'selection_receipt_unavailable' USING ERRCODE='23514'; END IF;
  -- Internally derive ALL retained tuples, including inactive/ended sources.
  WITH tuples AS (
    SELECT content_id,content_version FROM public.character_content_refs WHERE character_id=p_character_id
    UNION SELECT content_id,content_version FROM public.character_inventory WHERE character_id=p_character_id AND content_id IS NOT NULL
    UNION SELECT content_id,content_version FROM public.character_spells WHERE character_id=p_character_id AND content_id IS NOT NULL
    UNION SELECT feature_content_id,feature_version FROM public.character_feature_grants WHERE character_id=p_character_id
    UNION SELECT spell_content_id,spell_version FROM public.character_spell_grants WHERE character_id=p_character_id
    UNION SELECT content_id,content_version FROM private.character_class_occurrences_v1 WHERE character_id=p_character_id
  ) SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('content_id',content_id,'content_version',content_version)
       ORDER BY content_id,content_version),'[]'::jsonb) INTO required FROM tuples;
  result:=pg_catalog.jsonb_build_object('occurrence_ids',occurrence_ids,'required',required,'creation',pg_catalog.to_jsonb(creation),
    'bootstrap',pg_catalog.to_jsonb(bootstrap),'selection',pg_catalog.to_jsonb(selection),'insertion',pg_catalog.to_jsonb(insertion));
  -- Exact retained planned/consumed history, no current-graph historical re-finalization.
  -- Proof identity is a set; do not sort/rewrite the original planned array.
  IF EXISTS(SELECT 1 FROM private.class_writer_acceptance_v1 j WHERE j.acceptance_id IN (bootstrap.acceptance_id,selection.acceptance_id)
      AND (NOT COALESCE(private.class_origin_receipt_shape_v1(j.receipt),false) OR pg_catalog.jsonb_array_length(j.planned_transitions)<1
        OR (SELECT pg_catalog.count(DISTINCT pg_catalog.jsonb_build_array(value->'relation_key',value->'row_key'))
          FROM pg_catalog.jsonb_array_elements(j.planned_transitions))<>pg_catalog.jsonb_array_length(j.planned_transitions)
        OR (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=j.acceptance_id)<>pg_catalog.jsonb_array_length(j.planned_transitions)
        OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=j.acceptance_id
          AND (NOT t.consumed OR NOT j.planned_transitions @> pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(t)-ARRAY['acceptance_id','consumed']))))) THEN
    RAISE EXCEPTION 'historical_consumption_mismatch' USING ERRCODE='23514';
  END IF;
  IF pg_catalog.octet_length(result::text)>4194304 THEN RAISE EXCEPTION 'private_input_budget' USING ERRCODE='23514'; END IF;
  RETURN result;
END $$;
ALTER FUNCTION private.class_confirmation_private_inputs_v1(uuid,uuid) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.class_confirmation_private_inputs_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.class_confirmation_private_inputs_v1(uuid,uuid) TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.lock_class_confirmation_sources_v1(p_verified_context jsonb,p_character_id uuid,p_selected_occurrence_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.characters%ROWTYPE; inputs jsonb; after_inputs jsonb; definition public.content_definitions%ROWTYPE;
  version public.content_versions%ROWTYPE; system_row public.game_systems%ROWTYPE; campaign public.campaigns%ROWTYPE;
  ordering private.character_projection_order_v1%ROWTYPE; occurrence jsonb; ref public.character_content_refs%ROWTYPE;
  selected_refs uuid[]; tuple jsonb; domain text; has_shared_access boolean; snapshot_allowed boolean; current_allowed boolean;
  versions jsonb; definitions jsonb; BEGIN
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO c FROM public.characters WHERE id=p_character_id AND user_id=(p_verified_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  IF pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'native_auth_expired' USING ERRCODE='42501'; END IF;
  inputs:=private.class_confirmation_private_inputs_v1(c.id,p_selected_occurrence_id);
  PERFORM d.id FROM public.content_definitions d WHERE d.id IN
    (SELECT (value->>'content_id')::uuid FROM pg_catalog.jsonb_array_elements(inputs->'required')) ORDER BY d.id FOR SHARE;
  SELECT * INTO system_row FROM public.game_systems WHERE id=c.system_id FOR SHARE;
  IF NOT FOUND OR system_row.slug IS DISTINCT FROM 'dnd-5e-2014' OR system_row.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'published_system_unavailable' USING ERRCODE='23514'; END IF;
  has_shared_access:=false;
  IF c.campaign_id IS NOT NULL THEN
    SELECT * INTO campaign FROM public.campaigns WHERE id=c.campaign_id FOR SHARE;
    IF NOT FOUND OR campaign.system_id IS DISTINCT FROM c.system_id THEN RAISE EXCEPTION 'campaign_system_mismatch' USING ERRCODE='23514'; END IF;
    PERFORM id FROM public.campaign_members WHERE campaign_id=c.campaign_id AND user_id=c.user_id ORDER BY id FOR SHARE;
    PERFORM id FROM public.content_shares WHERE campaign_id=c.campaign_id AND content_id IN
      (SELECT (value->>'content_id')::uuid FROM pg_catalog.jsonb_array_elements(inputs->'required')) ORDER BY id FOR SHARE;
    has_shared_access:=campaign.owner_id=c.user_id OR EXISTS(SELECT 1 FROM public.campaign_members WHERE campaign_id=c.campaign_id AND user_id=c.user_id);
  END IF;
  PERFORM v.content_id FROM public.content_versions v JOIN pg_catalog.jsonb_array_elements(inputs->'required') tuple(value)
    ON v.content_id=(tuple.value->>'content_id')::uuid AND v.version=(tuple.value->>'content_version')::integer ORDER BY v.content_id,v.version FOR SHARE OF v;
  FOREACH domain IN ARRAY ARRAY['character_content_refs','character_inventory','character_spells','character_feature_grants','character_spell_grants'] LOOP
    EXECUTE pg_catalog.format('SELECT id FROM public.%I WHERE character_id=$1 ORDER BY id FOR SHARE',domain) USING c.id;
  END LOOP;
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=c.id FOR SHARE;
  IF NOT FOUND OR ordering.producer_version<>1 OR ordering.producer_revision<>c.action_revision THEN RAISE EXCEPTION 'order_revision_mismatch' USING ERRCODE='23514'; END IF;
  after_inputs:=private.class_confirmation_private_inputs_v1(c.id,p_selected_occurrence_id);
  IF after_inputs IS DISTINCT FROM inputs THEN RAISE EXCEPTION 'retained_sources_changed_after_wait' USING ERRCODE='23514'; END IF;
  FOR tuple IN SELECT value FROM pg_catalog.jsonb_array_elements(inputs->'required') LOOP
    SELECT * INTO definition FROM public.content_definitions WHERE id=(tuple->>'content_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'current_source_identity_unavailable' USING ERRCODE='23514'; END IF;
    SELECT v.* INTO version FROM public.content_versions v WHERE v.content_id=definition.id AND v.version=(tuple->>'content_version')::integer;
    IF NOT FOUND OR version.system_id_snapshot IS DISTINCT FROM c.system_id OR definition.system_id IS DISTINCT FROM c.system_id
      OR definition.content_type IS DISTINCT FROM version.content_type_snapshot OR definition.slug IS DISTINCT FROM version.slug_snapshot THEN
      RAISE EXCEPTION 'retained_version_identity_mismatch' USING ERRCODE='23514'; END IF;
  END LOOP;
  -- Only selected origin class/subclass is a fresh confirmation acquisition.
  occurrence:=inputs#>'{insertion,after_row}';
  SELECT * INTO ref FROM public.character_content_refs WHERE id=(occurrence->>'controller_ref_id')::uuid AND character_id=c.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'selected_pin_unavailable' USING ERRCODE='23514'; END IF;
  selected_refs:=ARRAY[ref.id];
  -- Current subclass may legitimately differ from its historical add-class insertion.
  SELECT pg_catalog.to_jsonb(o) INTO occurrence FROM private.character_class_occurrences_v1 o WHERE o.character_id=c.id AND o.id=p_selected_occurrence_id;
  IF occurrence->>'subclass_ref_id' IS NOT NULL THEN selected_refs:=selected_refs||ARRAY[(occurrence->>'subclass_ref_id')::uuid]; END IF;
  FOR ref IN SELECT * FROM public.character_content_refs WHERE id=ANY(selected_refs) AND character_id=c.id ORDER BY id LOOP
      SELECT v.* INTO version FROM public.content_versions v WHERE v.content_id=ref.content_id AND v.version=ref.content_version;
      SELECT * INTO definition FROM public.content_definitions WHERE id=ref.content_id;
      snapshot_allowed:=version.scope_snapshot='platform' OR version.owner_id_snapshot=c.user_id
        OR (version.scope_snapshot='shared' AND has_shared_access AND EXISTS(SELECT 1 FROM public.content_shares WHERE campaign_id=c.campaign_id AND content_id=ref.content_id));
      current_allowed:=definition.scope='platform' OR definition.owner_id=c.user_id
        OR (definition.scope='shared' AND has_shared_access AND EXISTS(SELECT 1 FROM public.content_shares WHERE campaign_id=c.campaign_id AND content_id=ref.content_id));
      IF NOT COALESCE(snapshot_allowed AND current_allowed AND NOT definition.is_retired,false) THEN
        RAISE EXCEPTION 'confirmation_acquisition_unavailable' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF (SELECT pg_catalog.count(*) FROM public.character_content_refs WHERE id=ANY(selected_refs) AND character_id=c.id)<>pg_catalog.cardinality(selected_refs) THEN
    RAISE EXCEPTION 'selected_subclass_pin_unavailable' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY d.id),'[]'::jsonb) INTO definitions FROM public.content_definitions d
    WHERE d.id IN (SELECT (value->>'content_id')::uuid FROM pg_catalog.jsonb_array_elements(inputs->'required'));
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) ORDER BY v.content_id,v.version),'[]'::jsonb) INTO versions FROM public.content_versions v
    JOIN pg_catalog.jsonb_array_elements(inputs->'required') tuple(value) ON v.content_id=(tuple.value->>'content_id')::uuid AND v.version=(tuple.value->>'content_version')::integer;
  RETURN pg_catalog.jsonb_build_object('private_inputs',after_inputs,'definitions',definitions,'versions',versions);
END $$;
ALTER FUNCTION private.lock_class_confirmation_sources_v1(jsonb,uuid,uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.lock_class_confirmation_sources_v1(jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.lock_class_confirmation_sources_v1(jsonb,uuid,uuid) TO inkborne_class_origin_owner;

CREATE FUNCTION private.validate_class_confirmation_before_v1(p_graph jsonb,p_private_inputs jsonb,p_intent jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE parent jsonb:=p_graph->'parent'; origin jsonb:=p_graph->'origin'; creation jsonb:=p_private_inputs->'creation';
  bootstrap jsonb:=p_private_inputs->'bootstrap'; selection jsonb:=p_private_inputs->'selection'; insertion jsonb:=p_private_inputs#>'{insertion,after_row}';
  selected jsonb; choice jsonb; occurrence jsonb; pin jsonb; version jsonb; sub_pin jsonb; sub_version jsonb;
  initial jsonb:=bootstrap->'expected_graph'; receipt jsonb:=creation->'receipt'; domain text; total integer:=0; BEGIN
  IF pg_catalog.octet_length(p_graph::text)>4194304 OR pg_catalog.octet_length(p_private_inputs::text)>4194304
    OR NOT COALESCE(private.class_origin_exact_keys_v1(p_graph,ARRAY['parent','origin','occurrences','refs','inventory','spells','feature_grants','spell_grants','versions','order']),false)
    OR parent->>'id' IS DISTINCT FROM p_intent->>'character_id' OR origin->>'character_id' IS DISTINCT FROM parent->>'id'
    OR origin->>'system_id' IS DISTINCT FROM parent->>'system_id' OR origin->>'origin_status' IS DISTINCT FROM 'draft'
    OR origin->>'creation_provenance' IS DISTINCT FROM 'new_character' OR origin->'origin_occurrence_id' IS DISTINCT FROM 'null'::jsonb
    OR origin->'role_proof' IS DISTINCT FROM 'null'::jsonb OR origin->'source_draft_operation_id' IS DISTINCT FROM 'null'::jsonb
    OR NOT private.class_origin_uuid_v1(origin->'creation_operation_id') THEN RAISE EXCEPTION 'draft_provenance_unavailable' USING ERRCODE='23514'; END IF;
  IF parent->>'action_revision' IS DISTINCT FROM p_intent->>'expected_action_revision'
    OR origin->>'command_revision' IS DISTINCT FROM p_intent->>'expected_class_revision'
    OR p_graph#>>'{order,producer_revision}' IS DISTINCT FROM parent->>'action_revision' THEN
    RAISE EXCEPTION 'stale_confirmation_revision' USING ERRCODE='40001'; END IF;
  IF parent->>'action_revision'='9223372036854775807' OR origin->>'command_revision'='9223372036854775807' THEN
    RAISE EXCEPTION 'confirmation_revision_exhausted' USING ERRCODE='23514'; END IF;
  -- Bind immutable receipt to historical immediate capture/consumed journal, not today's graph.
  IF NOT COALESCE(private.class_origin_receipt_shape_v1(receipt),false) OR receipt->>'receipt_kind' IS DISTINCT FROM 'bootstrap_new'
    OR receipt->>'target_character_id' IS DISTINCT FROM parent->>'id' OR receipt->>'verified_actor_id' IS DISTINCT FROM parent->>'user_id'
    OR creation->>'verified_actor_id' IS DISTINCT FROM parent->>'user_id' OR creation->>'target_character_id' IS DISTINCT FROM parent->>'id'
    OR receipt->>'operation_id' IS DISTINCT FROM origin->>'creation_operation_id' OR creation->>'operation_id' IS DISTINCT FROM receipt->>'operation_id'
    OR receipt#>>'{canonical_intent,fields,system_id}' IS DISTINCT FROM parent->>'system_id'
    OR bootstrap->>'acceptance_kind' IS DISTINCT FROM 'bootstrap_new' OR bootstrap->'finalized' IS DISTINCT FROM 'true'::jsonb
    OR bootstrap->>'verified_actor_id' IS DISTINCT FROM parent->>'user_id' OR bootstrap->>'target_character_id' IS DISTINCT FROM parent->>'id'
    OR bootstrap->'receipt' IS DISTINCT FROM receipt OR bootstrap->'before_parent' IS DISTINCT FROM 'null'::jsonb
    OR bootstrap->'before_origin' IS DISTINCT FROM 'null'::jsonb OR bootstrap->'revision_transition_consumed' IS DISTINCT FROM 'false'::jsonb
    OR bootstrap#>>'{preinsert_proof,acceptance_id}' IS DISTINCT FROM bootstrap->>'acceptance_id'
    OR bootstrap#>>'{preinsert_proof,target_character_id}' IS DISTINCT FROM parent->>'id'
    OR bootstrap#>>'{preinsert_proof,transaction_id}' IS DISTINCT FROM bootstrap->>'transaction_id'
    OR NOT private.class_origin_instant_v1(bootstrap#>'{preinsert_proof,captured_at}')
    OR (bootstrap#>>'{preinsert_proof,captured_at}')::timestamptz>(receipt->>'accepted_at')::timestamptz
    OR initial#>>'{parent,id}' IS DISTINCT FROM parent->>'id' OR initial#>>'{parent,user_id}' IS DISTINCT FROM parent->>'user_id'
    OR initial#>>'{parent,system_id}' IS DISTINCT FROM parent->>'system_id' OR initial#>>'{parent,action_revision}' IS DISTINCT FROM '0'
    OR initial#>>'{origin,command_revision}' IS DISTINCT FROM '0' OR initial#>>'{order,producer_revision}' IS DISTINCT FROM '0'
    OR initial#>'{parent,choices,classes}' IS DISTINCT FROM '[]'::jsonb
    OR initial#>>'{parent,name}' IS DISTINCT FROM receipt#>>'{canonical_intent,fields,name}'
    OR initial#>'{parent,campaign_id}' IS DISTINCT FROM receipt#>'{canonical_intent,fields,campaign_id}'
    OR (initial->'origin'-'command_revision') IS DISTINCT FROM (origin-'command_revision')
    OR pg_catalog.jsonb_array_length(bootstrap->'planned_transitions')<>2 THEN
    RAISE EXCEPTION 'bootstrap_correspondence_mismatch' USING ERRCODE='23514'; END IF;
  FOREACH domain IN ARRAY ARRAY['occurrences','refs','inventory','spells','feature_grants','spell_grants','versions'] LOOP
    IF initial->domain IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'bootstrap_initial_graph_mismatch' USING ERRCODE='23514'; END IF;
    IF pg_catalog.jsonb_typeof(p_graph->domain) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(p_graph->domain)>4096 THEN
      RAISE EXCEPTION 'graph_domain_budget' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF pg_catalog.jsonb_array_length(p_graph->'occurrences')>256 THEN RAISE EXCEPTION 'retained_occurrence_budget' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=(bootstrap->>'acceptance_id')::uuid
      AND t.relation_key='origin' AND t.row_key=pg_catalog.jsonb_build_array(parent->>'id') AND t.before_row IS NULL
      AND t.after_row=initial->'origin' AND t.consumed)
    OR NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 t WHERE t.acceptance_id=(bootstrap->>'acceptance_id')::uuid
      AND t.relation_key='creation_receipt' AND t.row_key=pg_catalog.jsonb_build_array(parent->>'user_id',receipt->>'operation_id')
      AND t.before_row IS NULL AND t.after_row=creation AND t.consumed) THEN RAISE EXCEPTION 'bootstrap_insert_proof_mismatch' USING ERRCODE='23514'; END IF;
  IF pg_catalog.jsonb_typeof(parent#>'{choices,classes}') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(parent#>'{choices,classes}') NOT BETWEEN 1 AND 20
    OR parent#>>'{choices,classes,0,occurrence_id}' IS DISTINCT FROM p_intent#>>'{fields,selected_occurrence_id}'
    OR (SELECT pg_catalog.count(DISTINCT value->>'occurrence_id') FROM pg_catalog.jsonb_array_elements(parent#>'{choices,classes}'))<>pg_catalog.jsonb_array_length(parent#>'{choices,classes}')
    OR (SELECT pg_catalog.count(DISTINCT value->>'slug') FROM pg_catalog.jsonb_array_elements(parent#>'{choices,classes}'))<>pg_catalog.jsonb_array_length(parent#>'{choices,classes}') THEN
    RAISE EXCEPTION 'already_first_selection_required' USING ERRCODE='23514'; END IF;
  FOR choice IN SELECT value FROM pg_catalog.jsonb_array_elements(parent#>'{choices,classes}') LOOP
    IF NOT private.class_origin_uuid_v1(choice->'occurrence_id') OR pg_catalog.jsonb_typeof(choice->'level') IS DISTINCT FROM 'number'
      OR choice->>'level' !~ '^[1-9][0-9]*$' OR (choice->>'level')::integer NOT BETWEEN 1 AND 20 THEN
      RAISE EXCEPTION 'selected_level_mismatch' USING ERRCODE='23514'; END IF;
    total:=total+(choice->>'level')::integer;
    SELECT value INTO occurrence FROM pg_catalog.jsonb_array_elements(p_graph->'occurrences') WHERE value->>'id'=choice->>'occurrence_id';
    IF NOT FOUND OR occurrence->>'character_id' IS DISTINCT FROM parent->>'id' OR occurrence->>'system_id' IS DISTINCT FROM parent->>'system_id'
      OR occurrence->>'lifecycle'='ended' OR occurrence->>'class_slug' IS DISTINCT FROM choice->>'slug' THEN
      RAISE EXCEPTION 'selected_occurrence_mismatch' USING ERRCODE='23514'; END IF;
    SELECT value INTO pin FROM pg_catalog.jsonb_array_elements(p_graph->'refs') WHERE value->>'id'=occurrence->>'controller_ref_id';
    SELECT value INTO version FROM pg_catalog.jsonb_array_elements(p_graph->'versions') WHERE value->>'content_id'=pin->>'content_id' AND value->'version'=pin->'content_version';
    IF pin IS NULL OR version IS NULL OR pin->>'content_id' IS DISTINCT FROM occurrence->>'content_id' OR pin->'content_version' IS DISTINCT FROM occurrence->'content_version'
      OR pin#>>'{context,source}' IS DISTINCT FROM 'class' OR version->>'content_type_snapshot' IS DISTINCT FROM 'class'
      OR version->>'slug_snapshot' IS DISTINCT FROM choice->>'slug' THEN RAISE EXCEPTION 'selected_pin_mismatch' USING ERRCODE='23514'; END IF;
    IF choice ? 'subclass' THEN
      SELECT value INTO sub_pin FROM pg_catalog.jsonb_array_elements(p_graph->'refs') WHERE value->>'id'=occurrence->>'subclass_ref_id';
      SELECT value INTO sub_version FROM pg_catalog.jsonb_array_elements(p_graph->'versions') WHERE value->>'content_id'=sub_pin->>'content_id' AND value->'version'=sub_pin->'content_version';
      IF sub_pin IS NULL OR sub_version IS NULL OR sub_pin#>>'{context,source}' IS DISTINCT FROM 'subclass'
        OR sub_pin#>>'{context,class}' IS DISTINCT FROM occurrence->>'class_slug' OR sub_version->>'content_type_snapshot' IS DISTINCT FROM 'subclass'
        OR sub_version->>'slug_snapshot' IS DISTINCT FROM choice->>'subclass' OR sub_version#>>'{data_snapshot,parent_class}' IS DISTINCT FROM occurrence->>'class_slug' THEN
        RAISE EXCEPTION 'subclass_parent_mismatch' USING ERRCODE='23514'; END IF;
    ELSIF occurrence->'subclass_ref_id' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'unselected_subclass' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF total IS DISTINCT FROM (parent->>'level')::integer OR total>20
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_graph->'occurrences') o WHERE o.value->>'lifecycle'<>'ended'
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(parent#>'{choices,classes}') ch WHERE ch.value->>'occurrence_id'=o.value->>'id'))
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_graph->'refs') r JOIN pg_catalog.jsonb_array_elements(p_graph->'versions') v
      ON v.value->>'content_id'=r.value->>'content_id' AND v.value->'version'=r.value->'content_version'
      WHERE (v.value->>'content_type_snapshot'='class' AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_graph->'occurrences') o
        WHERE o.value->>'lifecycle'<>'ended' AND o.value->>'controller_ref_id'=r.value->>'id'))
      OR (v.value->>'content_type_snapshot'='subclass' AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_graph->'occurrences') o
        WHERE o.value->>'lifecycle'<>'ended' AND o.value->>'subclass_ref_id'=r.value->>'id'))) THEN RAISE EXCEPTION 'reverse_class_graph_mismatch' USING ERRCODE='23514'; END IF;
  SELECT value INTO selected FROM pg_catalog.jsonb_array_elements(p_graph->'occurrences') WHERE value->>'id'=p_intent#>>'{fields,selected_occurrence_id}';
  IF selected->>'lifecycle' IS DISTINCT FROM 'provisional' OR selected->'accepted_at' IS DISTINCT FROM 'null'::jsonb
    OR selected->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb OR selected->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb
    OR selected->'ended_at' IS DISTINCT FROM 'null'::jsonb OR NOT private.class_origin_instant_v1(selected->'selected_at')
    OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['id','character_id','system_id','content_id','content_version','class_slug','selected_at','controller_ref_id']) key(name)
      WHERE selected->name IS DISTINCT FROM insertion->name)
    OR insertion->>'lifecycle' IS DISTINCT FROM 'provisional' OR insertion->'accepted_at' IS DISTINCT FROM 'null'::jsonb
    OR insertion->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb OR insertion->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb
    OR selection->>'target_character_id' IS DISTINCT FROM parent->>'id' OR selection->>'verified_actor_id' IS DISTINCT FROM parent->>'user_id'
    OR selection#>>'{receipt,verified_actor_id}' IS DISTINCT FROM parent->>'user_id' OR selection#>>'{receipt,target_character_id}' IS DISTINCT FROM parent->>'id'
    OR selection->'finalized' IS DISTINCT FROM 'true'::jsonb OR selection->'revision_transition_consumed' IS DISTINCT FROM 'true'::jsonb
    OR selection#>>'{receipt,canonical_intent,command}' IS DISTINCT FROM 'add_class'
    OR selection#>>'{receipt,canonical_intent,character_id}' IS DISTINCT FROM parent->>'id'
    OR selection#>>'{receipt,canonical_intent,fields,content_id}' IS DISTINCT FROM selected->>'content_id'
    OR selection#>'{receipt,canonical_intent,fields,content_version}' IS DISTINCT FROM selected->'content_version'
    OR NOT (selection#>'{expected_graph,occurrences}') @> pg_catalog.jsonb_build_array(insertion)
    OR selection#>>'{before_parent,id}' IS DISTINCT FROM parent->>'id'
    OR selection#>>'{before_parent,user_id}' IS DISTINCT FROM parent->>'user_id'
    OR selection#>>'{before_parent,system_id}' IS DISTINCT FROM parent->>'system_id'
    OR selection#>>'{expected_graph,parent,id}' IS DISTINCT FROM parent->>'id'
    OR selection#>>'{expected_graph,parent,system_id}' IS DISTINCT FROM parent->>'system_id'
    OR selection#>>'{expected_graph,parent,user_id}' IS DISTINCT FROM parent->>'user_id'
    OR selection#>>'{receipt,before_action_revision}' IS DISTINCT FROM selection#>>'{before_parent,action_revision}'
    OR selection#>>'{receipt,before_class_revision}' IS DISTINCT FROM selection#>>'{before_origin,command_revision}'
    OR selection#>>'{receipt,after_action_revision}' IS DISTINCT FROM selection#>>'{expected_graph,parent,action_revision}'
    OR selection#>>'{receipt,after_class_revision}' IS DISTINCT FROM selection#>>'{expected_graph,origin,command_revision}' THEN
    RAISE EXCEPTION 'selection_insert_correspondence_mismatch' USING ERRCODE='23514'; END IF;
END $$;
ALTER FUNCTION private.validate_class_confirmation_before_v1(jsonb,jsonb,jsonb) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.validate_class_confirmation_before_v1(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.confirm_already_first_class_origin_v1(p_verified_context jsonb,p_intent jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.characters%ROWTYPE; origin private.character_class_origin_v1%ROWTYPE; selected private.character_class_occurrences_v1%ROWTYPE;
  previous jsonb; sources jsonb; inputs jsonb; before_graph jsonb; expected_graph jsonb; occurrence_ids uuid[];
  before_origin jsonb; before_occurrence jsonb; after_origin jsonb; after_occurrence jsonb; confirmation jsonb; receipt jsonb;
  receipt_row jsonb; transitions jsonb; transition jsonb; accepted timestamptz; accepted_json jsonb;
  new_acceptance uuid; shared_before bigint; class_before bigint; changed bigint; BEGIN
  -- Always unavailable. Do not replace this with shape/getUser/UUID/GUC authority.
  PERFORM private.require_class_origin_auth_v1(p_verified_context);
  IF NOT COALESCE(private.class_origin_exact_keys_v1(p_verified_context,ARRAY['context_version','actor_id','session_id','jwt_expires_at']),false)
    OR p_verified_context->'context_version' IS DISTINCT FROM '1'::jsonb OR NOT private.class_origin_uuid_v1(p_verified_context->'actor_id')
    OR NOT private.class_origin_uuid_v1(p_verified_context->'session_id') OR NOT private.class_origin_instant_v1(p_verified_context->'jwt_expires_at')
    OR p_verified_context->>'jwt_expires_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
    OR pg_catalog.octet_length(p_intent::text)>32768
    OR NOT COALESCE(private.class_origin_exact_keys_v1(p_intent,ARRAY['contract_version','command','character_id','operation_id','expected_action_revision','expected_class_revision','fields']),false)
    OR p_intent->'contract_version' IS DISTINCT FROM '1'::jsonb OR p_intent->>'command' IS DISTINCT FROM 'confirm_origin'
    OR NOT private.class_origin_uuid_v1(p_intent->'character_id') OR NOT private.class_origin_uuid_v1(p_intent->'operation_id')
    OR pg_catalog.jsonb_typeof(p_intent->'expected_action_revision') IS DISTINCT FROM 'string'
    OR pg_catalog.jsonb_typeof(p_intent->'expected_class_revision') IS DISTINCT FROM 'string'
    OR NOT private.class_origin_decimal_v1(p_intent->>'expected_action_revision') OR NOT private.class_origin_decimal_v1(p_intent->>'expected_class_revision')
    OR NOT COALESCE(private.class_origin_exact_keys_v1(p_intent->'fields',ARRAY['selected_occurrence_id']),false)
    OR NOT private.class_origin_uuid_v1(p_intent#>'{fields,selected_occurrence_id}') THEN RAISE EXCEPTION 'strict_confirmation_request_required' USING ERRCODE='22023'; END IF;
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO c FROM public.characters WHERE id=(p_intent->>'character_id')::uuid AND user_id=(p_verified_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'current_owner_unavailable' USING ERRCODE='42501'; END IF;
  -- Native verifier must re-evaluate the same session/config after waits; it still denies.
  PERFORM private.require_class_origin_auth_v1(p_verified_context);
  IF pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'native_auth_expired' USING ERRCODE='42501'; END IF;
  SELECT command.receipt INTO previous FROM private.character_class_commands_v1 AS command
    WHERE command.character_id=c.id AND command.operation_id=(p_intent->>'operation_id')::uuid;
  IF FOUND THEN
    IF previous->'canonical_intent' IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'operation_intent_conflict' USING ERRCODE='23505'; END IF;
    PERFORM private.require_class_origin_auth_v1(p_verified_context);
    IF c.user_id IS DISTINCT FROM (p_verified_context->>'actor_id')::uuid
      OR pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'native_auth_expired' USING ERRCODE='42501'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',previous);
  END IF;
  -- Every origin/occurrence/history/source lock and gate is strictly AFTER replay.
  sources:=private.lock_class_confirmation_sources_v1(p_verified_context,c.id,(p_intent#>>'{fields,selected_occurrence_id}')::uuid);
  inputs:=sources->'private_inputs';
  SELECT COALESCE(pg_catalog.array_agg(value::uuid ORDER BY value::uuid),ARRAY[]::uuid[]) INTO occurrence_ids
    FROM pg_catalog.jsonb_array_elements_text(inputs->'occurrence_ids');
  before_graph:=private.class_origin_read_final_graph_v1(c.id,occurrence_ids);
  IF before_graph->'versions' IS DISTINCT FROM sources->'versions' THEN RAISE EXCEPTION 'locked_versions_changed' USING ERRCODE='23514'; END IF;
  PERFORM private.validate_class_confirmation_before_v1(before_graph,inputs,p_intent);
  SELECT * INTO origin FROM private.character_class_origin_v1 WHERE character_id=c.id;
  SELECT * INTO selected FROM private.character_class_occurrences_v1 WHERE character_id=c.id AND id=(p_intent#>>'{fields,selected_occurrence_id}')::uuid;
  shared_before:=c.action_revision; class_before:=origin.command_revision;
  PERFORM private.require_class_origin_auth_v1(p_verified_context);
  accepted:=pg_catalog.clock_timestamp(); accepted_json:=pg_catalog.to_jsonb(accepted);
  IF accepted>=(p_verified_context->>'jwt_expires_at')::timestamptz OR selected.selected_at>accepted THEN
    RAISE EXCEPTION 'native_acceptance_expired_or_future_selection' USING ERRCODE='42501'; END IF;
  confirmation:=pg_catalog.jsonb_build_object('canonical_intent',pg_catalog.jsonb_build_object('contract_version',1,'command','confirm_origin',
    'character_id',c.id,'operation_id',p_intent->>'operation_id','expected_revision',class_before::text,'selected_occurrence_id',selected.id),
    'applied_revision',(class_before+1)::text,'accepted_at',accepted_json);
  receipt:=pg_catalog.jsonb_build_object('receipt_version',1,'receipt_kind','class_transition','operation_id',p_intent->>'operation_id',
    'verified_actor_id',c.user_id,'target_character_id',c.id,'accepted_at',accepted_json,'canonical_intent',p_intent,
    'before_action_revision',shared_before::text,'after_action_revision',(shared_before+1)::text,
    'before_class_revision',class_before::text,'after_class_revision',(class_before+1)::text,'confirmation',confirmation);
  IF NOT COALESCE(private.class_origin_receipt_shape_v1(receipt),false) THEN RAISE EXCEPTION 'derived_receipt_invalid' USING ERRCODE='23514'; END IF;
  before_origin:=before_graph->'origin'; before_occurrence:=pg_catalog.to_jsonb(selected);
  after_origin:=before_origin||pg_catalog.jsonb_build_object('command_revision',(class_before+1)::text,'origin_status','recorded',
    'origin_occurrence_id',selected.id,'role_proof',pg_catalog.jsonb_build_object('kind','confirmation','receipt',confirmation));
  after_occurrence:=before_occurrence||pg_catalog.jsonb_build_object('lifecycle','accepted','acquired_character_level',1,
    'acquisition_operation_id',p_intent->>'operation_id','accepted_at',accepted_json);
  receipt_row:=pg_catalog.jsonb_build_object('character_id',c.id,'operation_id',p_intent->>'operation_id','receipt',receipt);
  expected_graph:=before_graph||pg_catalog.jsonb_build_object('parent',before_graph->'parent'||pg_catalog.jsonb_build_object('action_revision',(shared_before+1)::text),
    'origin',after_origin,'order',before_graph->'order'||pg_catalog.jsonb_build_object('producer_revision',(shared_before+1)::text),
    'occurrences',(SELECT pg_catalog.jsonb_agg(CASE WHEN value->>'id'=selected.id::text THEN after_occurrence ELSE value END ORDER BY position)
      FROM pg_catalog.jsonb_array_elements(before_graph->'occurrences') WITH ORDINALITY row_value(value,position)));
  transitions:=pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('relation_key','occurrence','row_key',pg_catalog.jsonb_build_array(selected.id),'before_row',before_occurrence,'after_row',after_occurrence),
    pg_catalog.jsonb_build_object('relation_key','origin','row_key',pg_catalog.jsonb_build_array(c.id),'before_row',before_origin,'after_row',after_origin),
    pg_catalog.jsonb_build_object('relation_key','class_receipt','row_key',pg_catalog.jsonb_build_array(c.id,p_intent->>'operation_id'),'before_row',NULL,'after_row',receipt_row));
  IF pg_catalog.octet_length(expected_graph::text)>4194304 THEN RAISE EXCEPTION 'expected_graph_budget' USING ERRCODE='23514'; END IF;
  new_acceptance:=pg_catalog.gen_random_uuid();
  INSERT INTO private.class_writer_acceptance_v1(acceptance_id,transaction_id,verified_actor_id,target_character_id,acceptance_kind,
    before_parent,before_origin,expected_graph,planned_transitions,receipt)
    VALUES(new_acceptance,pg_catalog.pg_current_xact_id(),c.user_id,c.id,'class_transition',before_graph->'parent',before_origin,expected_graph,transitions,receipt);
  FOR transition IN SELECT value FROM pg_catalog.jsonb_array_elements(transitions) LOOP
    INSERT INTO private.class_writer_row_transitions_v1(acceptance_id,relation_key,row_key,before_row,after_row)
      VALUES(new_acceptance,transition->>'relation_key',transition->'row_key',NULLIF(transition->'before_row','null'::jsonb),transition->'after_row');
  END LOOP;
  UPDATE private.character_class_occurrences_v1 SET lifecycle='accepted',acquired_character_level=1,
    acquisition_operation_id=(p_intent->>'operation_id')::uuid,accepted_at=accepted WHERE id=selected.id AND character_id=c.id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'selected_occurrence_write_missing' USING ERRCODE='23514'; END IF;
  UPDATE private.character_class_origin_v1 SET command_revision=class_before+1,origin_status='recorded',origin_occurrence_id=selected.id,
    role_proof=after_origin->'role_proof' WHERE character_id=c.id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'origin_write_missing' USING ERRCODE='23514'; END IF;
  -- Actual origin AFTER dispatch owns the sole shared bump/order rebind/readback.
  INSERT INTO private.character_class_commands_v1(character_id,operation_id,receipt) VALUES(c.id,(p_intent->>'operation_id')::uuid,receipt);
  UPDATE private.class_writer_acceptance_v1 SET finalized=true WHERE acceptance_id=new_acceptance;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'finalization_write_missing' USING ERRCODE='23514'; END IF;
  PERFORM private.class_origin_finalize_acceptance_v1(new_acceptance);
  -- Existing initially-deferred P1a and joint callbacks remain armed through COMMIT.
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;
ALTER FUNCTION private.confirm_already_first_class_origin_v1(jsonb,jsonb) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.confirm_already_first_class_origin_v1(jsonb,jsonb),
  private.validate_class_confirmation_before_v1(jsonb,jsonb,jsonb),private.class_confirmation_private_inputs_v1(uuid,uuid),
  private.lock_class_confirmation_sources_v1(jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Exact cross-family helper EXECUTEs above only; no entry grant, role membership,
-- readiness mutation, native Auth replacement or base source/object replacement.
COMMIT;
