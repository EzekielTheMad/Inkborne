-- STAGED ONLY: immutable unverified preacceptance calculations, not B1 plans.
-- Historical correspondence is not Auth, genuine bootstrap issuance, current
-- ownership authentication, a writer fence, or permission to adopt this graph.
-- Offline injected history remains synthetic. A future verified planner must
-- rederive a DIFFERENT typed plan after real Auth, locks, content and fences.
-- These guards protect ordinary callers; trusted owner DDL/RLS bypass is not
-- an authentication boundary. No old functions, gates or journal are changed.

BEGIN;

CREATE FUNCTION private.first_class_calculation_exact_keys_v1(p_value jsonb, p_keys text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'object' THEN
    (SELECT count(*) FROM jsonb_object_keys(p_value)) = cardinality(p_keys)
    AND p_value ?& p_keys ELSE false END;
$$;

CREATE FUNCTION private.first_class_calculation_uuid_v1(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_typeof(p_value) = 'string' AND p_value #>> '{}' ~
    '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$', false);
$$;

CREATE FUNCTION private.first_class_calculation_instant_v1(p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE parsed timestamptz;
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'string'
    OR p_value #>> '{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-](0[0-9]|1[0-9]|2[0-3]):[0-5][0-9])$'
  THEN RETURN false; END IF;
  parsed := (p_value #>> '{}')::timestamptz;
  RETURN isfinite(parsed) AND parsed >= '0001-01-01T00:00:00Z'::timestamptz
    AND parsed < '10000-01-01T00:00:00Z'::timestamptz;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RETURN false;
END;
$$;

CREATE FUNCTION private.validate_first_class_calculation_intent_v1(p_intent jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE version_number numeric;
BEGIN
  IF p_intent IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'first_class_calculation_intent_object_required' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_intent::text) > 32768 THEN
    RAISE EXCEPTION 'first_class_calculation_request_budget' USING ERRCODE = '54000';
  END IF;
  IF NOT private.first_class_calculation_exact_keys_v1(p_intent,
      ARRAY['contract_version','character_id','operation_id','command','expected_action_revision','expected_class_revision','fields'])
    OR p_intent->'contract_version' IS DISTINCT FROM '1'::jsonb
    OR p_intent->'command' IS DISTINCT FROM '"add_class"'::jsonb
    OR p_intent->'expected_action_revision' IS DISTINCT FROM '"0"'::jsonb
    OR p_intent->'expected_class_revision' IS DISTINCT FROM '"0"'::jsonb
    OR NOT private.first_class_calculation_uuid_v1(p_intent->'character_id')
    OR NOT private.first_class_calculation_uuid_v1(p_intent->'operation_id')
    OR NOT private.first_class_calculation_exact_keys_v1(p_intent->'fields', ARRAY['content_id','content_version','subclass'])
    OR NOT private.first_class_calculation_uuid_v1(p_intent#>'{fields,content_id}')
    OR p_intent#>'{fields,subclass}' IS DISTINCT FROM 'null'::jsonb
    OR jsonb_typeof(p_intent#>'{fields,content_version}') IS DISTINCT FROM 'number'
    OR COALESCE(p_intent#>>'{fields,content_version}', '') !~ '^[1-9][0-9]*$'
  THEN RAISE EXCEPTION 'first_class_calculation_intent_malformed' USING ERRCODE = '22023'; END IF;
  version_number := (p_intent#>>'{fields,content_version}')::numeric;
  IF version_number > 2147483647 THEN
    RAISE EXCEPTION 'first_class_calculation_version_range' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION private.read_first_class_bootstrap_history_v1(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  parent_row public.characters%ROWTYPE;
  origin_row private.character_class_origin_v1%ROWTYPE;
  order_row private.character_projection_order_v1%ROWTYPE;
  creation_row private.character_creation_commands_v1%ROWTYPE;
  bootstrap_row private.class_writer_acceptance_v1%ROWTYPE;
  before_parent jsonb; before_origin jsonb; before_order jsonb;
  receipt jsonb; intent jsonb; fields jsonb; expected_graph jsonb;
  planned jsonb; transitions jsonb; history jsonb;
  matches bigint; domain text;
BEGIN
  SELECT source.* INTO parent_row FROM public.characters AS source WHERE source.id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_history_parent_unavailable' USING ERRCODE = '23503'; END IF;
  SELECT source.* INTO origin_row FROM private.character_class_origin_v1 AS source WHERE source.character_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_history_origin_unavailable' USING ERRCODE = '23503'; END IF;
  SELECT source.* INTO order_row FROM private.character_projection_order_v1 AS source WHERE source.character_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_history_order_unavailable' USING ERRCODE = '23503'; END IF;
  IF NOT private.first_class_calculation_uuid_v1(to_jsonb(p_target))
    OR parent_row.campaign_id IS NOT NULL OR parent_row.level IS DISTINCT FROM 1
    OR parent_row.action_revision IS DISTINCT FROM 0
    OR parent_row.choices IS DISTINCT FROM '{}'::jsonb OR parent_row.base_stats IS DISTINCT FROM '{}'::jsonb
    OR parent_row.state IS DISTINCT FROM '{}'::jsonb OR parent_row.narrative IS DISTINCT FROM '{}'::jsonb
    OR parent_row.narrative_rich IS DISTINCT FROM '{}'::jsonb
    OR origin_row.schema_version IS DISTINCT FROM 1 OR origin_row.system_id IS DISTINCT FROM parent_row.system_id
    OR origin_row.creation_provenance IS DISTINCT FROM 'new_character' OR origin_row.origin_status IS DISTINCT FROM 'draft'
    OR origin_row.command_revision IS DISTINCT FROM 0 OR origin_row.origin_occurrence_id IS NOT NULL
    OR origin_row.role_proof IS NOT NULL OR origin_row.source_draft_operation_id IS NOT NULL
    OR NOT private.first_class_calculation_uuid_v1(to_jsonb(origin_row.creation_operation_id))
    OR NOT private.first_class_calculation_uuid_v1(to_jsonb(parent_row.user_id))
    OR NOT private.first_class_calculation_uuid_v1(to_jsonb(parent_row.system_id))
    OR order_row.producer_version IS DISTINCT FROM 1 OR order_row.producer_revision IS DISTINCT FROM 0
    OR order_row.pins IS DISTINCT FROM ARRAY[]::uuid[] OR order_row.inventory IS DISTINCT FROM ARRAY[]::uuid[]
    OR order_row.spells IS DISTINCT FROM ARRAY[]::uuid[] OR order_row.feature_grants IS DISTINCT FROM ARRAY[]::uuid[]
    OR order_row.spell_grants IS DISTINCT FROM ARRAY[]::uuid[]
    OR EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 AS source WHERE source.character_id = p_target)
    OR EXISTS(SELECT 1 FROM public.character_content_refs AS source WHERE source.character_id = p_target)
    OR EXISTS(SELECT 1 FROM public.character_inventory AS source WHERE source.character_id = p_target)
    OR EXISTS(SELECT 1 FROM public.character_spells AS source WHERE source.character_id = p_target)
    OR EXISTS(SELECT 1 FROM public.character_feature_grants AS source WHERE source.character_id = p_target)
    OR EXISTS(SELECT 1 FROM public.character_spell_grants AS source WHERE source.character_id = p_target)
  THEN RAISE EXCEPTION 'first_class_history_empty_new_profile_required' USING ERRCODE = '23514'; END IF;
  before_parent := to_jsonb(parent_row) || jsonb_build_object('action_revision', parent_row.action_revision::text);
  before_origin := to_jsonb(origin_row) || jsonb_build_object('command_revision', origin_row.command_revision::text);
  before_order := to_jsonb(order_row) || jsonb_build_object('producer_revision', order_row.producer_revision::text);

  SELECT source.* INTO creation_row FROM private.character_creation_commands_v1 AS source
    WHERE source.verified_actor_id = parent_row.user_id AND source.target_character_id = p_target
      AND source.operation_id = origin_row.creation_operation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'first_class_history_creation_unavailable' USING ERRCODE = '23514'; END IF;
  receipt := creation_row.receipt; intent := receipt->'canonical_intent'; fields := intent->'fields';
  IF octet_length(receipt::text) > 8388608 OR octet_length(intent::text) > 32768 THEN
    RAISE EXCEPTION 'first_class_history_receipt_budget' USING ERRCODE = '54000';
  END IF;
  IF NOT private.first_class_calculation_exact_keys_v1(receipt, ARRAY['receipt_version','receipt_kind','operation_id',
      'verified_actor_id','target_character_id','accepted_at','canonical_intent','initial_action_revision',
      'initial_class_revision','initial_producer_revision','copy_lineage'])
    OR receipt->'receipt_version' IS DISTINCT FROM '1'::jsonb
    OR receipt->'receipt_kind' IS DISTINCT FROM '"bootstrap_new"'::jsonb
    OR receipt->'operation_id' IS DISTINCT FROM to_jsonb(origin_row.creation_operation_id)
    OR receipt->'verified_actor_id' IS DISTINCT FROM to_jsonb(parent_row.user_id)
    OR receipt->'target_character_id' IS DISTINCT FROM to_jsonb(p_target)
    OR NOT private.first_class_calculation_instant_v1(receipt->'accepted_at')
    OR receipt->'initial_action_revision' IS DISTINCT FROM '"0"'::jsonb
    OR receipt->'initial_class_revision' IS DISTINCT FROM '"0"'::jsonb
    OR receipt->'initial_producer_revision' IS DISTINCT FROM '"0"'::jsonb
    OR receipt->'copy_lineage' IS DISTINCT FROM 'null'::jsonb
    OR NOT private.first_class_calculation_exact_keys_v1(intent, ARRAY['contract_version','operation_id','command','fields'])
    OR intent->'contract_version' IS DISTINCT FROM '1'::jsonb
    OR intent->'command' IS DISTINCT FROM '"create_character"'::jsonb
    OR intent->'operation_id' IS DISTINCT FROM receipt->'operation_id'
    OR NOT private.first_class_calculation_exact_keys_v1(fields, ARRAY['name','system_id','campaign_id'])
    OR jsonb_typeof(fields->'name') IS DISTINCT FROM 'string'
    OR fields->'name' IS DISTINCT FROM to_jsonb(parent_row.name)
    OR btrim(fields->>'name') IS DISTINCT FROM fields->>'name'
    OR length(fields->>'name') NOT BETWEEN 1 AND 100
    OR fields->'system_id' IS DISTINCT FROM to_jsonb(parent_row.system_id)
    OR fields->'campaign_id' IS DISTINCT FROM 'null'::jsonb
  THEN RAISE EXCEPTION 'first_class_history_strict_creation_receipt_required' USING ERRCODE = '23514'; END IF;

  SELECT count(*) INTO matches FROM (
    SELECT 1 FROM private.class_writer_acceptance_v1 AS source
    WHERE source.target_character_id = p_target AND source.verified_actor_id = parent_row.user_id
      AND source.receipt = creation_row.receipt AND source.acceptance_kind = 'bootstrap_new' AND source.finalized
    LIMIT 2
  ) AS matching;
  IF matches <> 1 THEN RAISE EXCEPTION 'first_class_history_unique_finalized_bootstrap_required' USING ERRCODE = '23514'; END IF;
  SELECT source.* INTO bootstrap_row FROM private.class_writer_acceptance_v1 AS source
    WHERE source.target_character_id = p_target AND source.verified_actor_id = parent_row.user_id
      AND source.receipt = creation_row.receipt AND source.acceptance_kind = 'bootstrap_new' AND source.finalized;
  IF octet_length(to_jsonb(bootstrap_row)::text) > 8388608 THEN
    RAISE EXCEPTION 'first_class_history_journal_budget' USING ERRCODE = '54000';
  END IF;
  IF bootstrap_row.before_parent IS NOT NULL OR bootstrap_row.before_origin IS NOT NULL
    OR bootstrap_row.revision_transition_consumed
    OR NOT private.first_class_calculation_uuid_v1(to_jsonb(bootstrap_row.acceptance_id))
    OR bootstrap_row.transaction_id::text !~ '^[1-9][0-9]{0,19}$'
    OR NOT private.first_class_calculation_exact_keys_v1(bootstrap_row.preinsert_proof,
      ARRAY['acceptance_id','target_character_id','transaction_id','captured_at'])
    OR bootstrap_row.preinsert_proof->'acceptance_id' IS DISTINCT FROM to_jsonb(bootstrap_row.acceptance_id)
    OR bootstrap_row.preinsert_proof->'target_character_id' IS DISTINCT FROM to_jsonb(p_target)
    OR bootstrap_row.preinsert_proof->'transaction_id' IS DISTINCT FROM to_jsonb(bootstrap_row.transaction_id::text)
    OR NOT private.first_class_calculation_instant_v1(bootstrap_row.preinsert_proof->'captured_at')
  THEN RAISE EXCEPTION 'first_class_history_bootstrap_correspondence_required' USING ERRCODE = '23514'; END IF;
  expected_graph := bootstrap_row.expected_graph;
  IF NOT private.first_class_calculation_exact_keys_v1(expected_graph,
    ARRAY['parent','origin','order','occurrences','refs','inventory','spells','feature_grants','spell_grants','versions'])
    OR expected_graph->'parent' IS DISTINCT FROM before_parent
    OR expected_graph->'origin' IS DISTINCT FROM before_origin
    OR expected_graph->'order' IS DISTINCT FROM before_order
  THEN RAISE EXCEPTION 'first_class_history_exact_empty_graph_required' USING ERRCODE = '23514'; END IF;
  FOREACH domain IN ARRAY ARRAY['occurrences','refs','inventory','spells','feature_grants','spell_grants','versions'] LOOP
    IF expected_graph->domain IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION 'first_class_history_empty_graph_domain_required' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  planned := bootstrap_row.planned_transitions;
  IF jsonb_typeof(planned) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'first_class_history_planned_array_required' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(planned) <> 2 THEN
    RAISE EXCEPTION 'first_class_history_exact_two_planned_required' USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(DISTINCT jsonb_build_array(source.value->'relation_key',source.value->'row_key'))
      FROM jsonb_array_elements(planned) AS source(value)) <> 2
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(planned) AS source(value)
      WHERE NOT private.first_class_calculation_exact_keys_v1(source.value, ARRAY['relation_key','row_key','before_row','after_row']))
  THEN RAISE EXCEPTION 'first_class_history_unique_complete_planned_required' USING ERRCODE = '23514'; END IF;
  SELECT count(*) INTO matches FROM (
    SELECT 1 FROM private.class_writer_row_transitions_v1 AS source WHERE source.acceptance_id = bootstrap_row.acceptance_id LIMIT 3
  ) AS matching;
  IF matches <> 2 THEN RAISE EXCEPTION 'first_class_history_exact_two_actual_required' USING ERRCODE = '23514'; END IF;
  IF EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 AS source
      WHERE source.acceptance_id = bootstrap_row.acceptance_id AND (
        NOT source.consumed OR source.before_row IS NOT NULL
        OR CASE source.relation_key
          WHEN 'origin' THEN source.row_key IS DISTINCT FROM jsonb_build_array(p_target)
            OR source.after_row IS DISTINCT FROM before_origin
          WHEN 'creation_receipt' THEN source.row_key IS DISTINCT FROM jsonb_build_array(parent_row.user_id,origin_row.creation_operation_id)
            OR source.after_row IS DISTINCT FROM to_jsonb(creation_row)
          ELSE true END
        OR NOT planned @> jsonb_build_array(to_jsonb(source) - ARRAY['acceptance_id','consumed'])
      ))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(planned) AS plan(value)
      WHERE NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 AS source
        WHERE source.acceptance_id = bootstrap_row.acceptance_id
          AND to_jsonb(source) - ARRAY['acceptance_id','consumed'] = plan.value))
    OR (SELECT count(DISTINCT source.relation_key) FROM private.class_writer_row_transitions_v1 AS source
      WHERE source.acceptance_id = bootstrap_row.acceptance_id) <> 2
  THEN RAISE EXCEPTION 'first_class_history_consumed_transition_bijection_required' USING ERRCODE = '23514'; END IF;
  SELECT jsonb_agg(to_jsonb(source) ORDER BY plan.position) INTO transitions
    FROM jsonb_array_elements(planned) WITH ORDINALITY AS plan(value,position)
    JOIN private.class_writer_row_transitions_v1 AS source
      ON source.acceptance_id = bootstrap_row.acceptance_id
      AND to_jsonb(source) - ARRAY['acceptance_id','consumed'] = plan.value;
  history := jsonb_build_object('before_parent',before_parent,'before_origin',before_origin,'before_order',before_order,
    'creation_receipt_row',to_jsonb(creation_row),'bootstrap_acceptance_id',bootstrap_row.acceptance_id,
    'bootstrap_journal',to_jsonb(bootstrap_row),'bootstrap_transitions',transitions);
  IF octet_length(history::text) > 8388608 THEN
    RAISE EXCEPTION 'first_class_history_budget' USING ERRCODE = '54000';
  END IF;
  RETURN history;
END;
$$;

CREATE TABLE private.class_first_allocation_calculations_v1 (
  calculation_id uuid PRIMARY KEY,
  calculation_kind text NOT NULL CHECK(calculation_kind = 'unverified_preacceptance_calculation'),
  transaction_id xid8 NOT NULL,
  target_character_id uuid NOT NULL,
  subject_owner_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  bootstrap_acceptance_id uuid NOT NULL,
  canonical_intent jsonb NOT NULL CHECK(jsonb_typeof(canonical_intent) = 'object' AND octet_length(canonical_intent::text) <= 32768),
  bootstrap_history jsonb NOT NULL CHECK(jsonb_typeof(bootstrap_history) = 'object' AND octet_length(bootstrap_history::text) <= 8388608),
  allocation_envelope jsonb NOT NULL CHECK(jsonb_typeof(allocation_envelope) = 'object' AND octet_length(allocation_envelope::text) <= 8388608),
  created_at timestamptz NOT NULL,
  UNIQUE(transaction_id,target_character_id),
  CHECK(octet_length(canonical_intent::text) + octet_length(bootstrap_history::text) + octet_length(allocation_envelope::text) <= 16777216)
);
ALTER TABLE private.class_first_allocation_calculations_v1 OWNER TO postgres;
ALTER TABLE private.class_first_allocation_calculations_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.class_first_allocation_calculations_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY first_class_calculation_owner_only ON private.class_first_allocation_calculations_v1
  FOR ALL TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON TABLE private.class_first_allocation_calculations_v1 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.guard_first_class_calculation_insert_v1()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE history jsonb; after_history jsonb; envelope jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM jsonb_each(to_jsonb(NEW) - 'canonical_intent') AS field(key,value)
    WHERE field.value IS DISTINCT FROM 'null'::jsonb) THEN
    RAISE EXCEPTION 'first_class_calculation_protected_fields_are_native_only' USING ERRCODE = '42501';
  END IF;
  PERFORM private.validate_first_class_calculation_intent_v1(NEW.canonical_intent);
  IF EXISTS(SELECT 1 FROM private.character_class_commands_v1 AS source
    WHERE source.character_id = (NEW.canonical_intent->>'character_id')::uuid
      AND source.operation_id = (NEW.canonical_intent->>'operation_id')::uuid) THEN
    RAISE EXCEPTION 'existing_command_requires_authenticated_recovery' USING ERRCODE = '23514';
  END IF;
  history := private.read_first_class_bootstrap_history_v1((NEW.canonical_intent->>'character_id')::uuid);
  envelope := private.allocate_first_class_save_envelope_v1(NEW.canonical_intent);
  after_history := private.read_first_class_bootstrap_history_v1((NEW.canonical_intent->>'character_id')::uuid);
  IF after_history IS DISTINCT FROM history
    OR envelope->'before_parent' IS DISTINCT FROM history->'before_parent'
    OR envelope->'before_origin' IS DISTINCT FROM history->'before_origin'
    OR envelope->'before_order' IS DISTINCT FROM history->'before_order'
    OR envelope->'receipt'->'canonical_intent' IS DISTINCT FROM NEW.canonical_intent
    OR envelope->'transaction_id' IS DISTINCT FROM to_jsonb(pg_current_xact_id()::text)
  THEN RAISE EXCEPTION 'first_class_calculation_history_allocation_mismatch' USING ERRCODE = '23514'; END IF;
  NEW.calculation_id := gen_random_uuid();
  NEW.calculation_kind := 'unverified_preacceptance_calculation';
  NEW.transaction_id := pg_current_xact_id();
  NEW.target_character_id := (NEW.canonical_intent->>'character_id')::uuid;
  NEW.subject_owner_id := (history#>>'{before_parent,user_id}')::uuid;
  NEW.operation_id := (NEW.canonical_intent->>'operation_id')::uuid;
  NEW.bootstrap_acceptance_id := (history->>'bootstrap_acceptance_id')::uuid;
  NEW.bootstrap_history := history;
  NEW.allocation_envelope := envelope;
  NEW.created_at := transaction_timestamp();
  IF octet_length(history::text) > 8388608 OR octet_length(envelope::text) > 8388608
    OR octet_length(to_jsonb(NEW)::text) > 16777216 THEN
    RAISE EXCEPTION 'first_class_calculation_record_budget' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.refuse_first_class_calculation_mutation_v1()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'first_class_calculation_is_immutable' USING ERRCODE = '42501';
END;
$$;
CREATE FUNCTION private.refuse_first_class_calculation_truncate_v1()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'first_class_calculation_truncate_is_unavailable' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER first_class_calculation_insert BEFORE INSERT ON private.class_first_allocation_calculations_v1
  FOR EACH ROW EXECUTE FUNCTION private.guard_first_class_calculation_insert_v1();
CREATE TRIGGER first_class_calculation_immutable BEFORE UPDATE OR DELETE ON private.class_first_allocation_calculations_v1
  FOR EACH ROW EXECUTE FUNCTION private.refuse_first_class_calculation_mutation_v1();
CREATE TRIGGER first_class_calculation_no_truncate BEFORE TRUNCATE ON private.class_first_allocation_calculations_v1
  FOR EACH STATEMENT EXECUTE FUNCTION private.refuse_first_class_calculation_truncate_v1();

CREATE FUNCTION private.prepare_first_class_calculation_v1(p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE existing private.class_first_allocation_calculations_v1%ROWTYPE;
  inserted private.class_first_allocation_calculations_v1%ROWTYPE; target uuid; operation uuid;
BEGIN
  PERFORM private.validate_first_class_calculation_intent_v1(p_intent);
  target := (p_intent->>'character_id')::uuid; operation := (p_intent->>'operation_id')::uuid;
  -- This private calculator cannot perform unauthenticated receipt recovery.
  IF EXISTS(SELECT 1 FROM private.character_class_commands_v1 AS source
    WHERE source.character_id = target AND source.operation_id = operation) THEN
    RAISE EXCEPTION 'existing_command_requires_authenticated_recovery' USING ERRCODE = '23514';
  END IF;
  SELECT source.* INTO existing FROM private.class_first_allocation_calculations_v1 AS source
    WHERE source.transaction_id = pg_current_xact_id() AND source.target_character_id = target;
  IF FOUND THEN
    IF existing.canonical_intent IS DISTINCT FROM p_intent THEN
      RAISE EXCEPTION 'first_class_calculation_same_transaction_intent_conflict' USING ERRCODE = '23514';
    END IF;
    RETURN to_jsonb(existing);
  END IF;
  INSERT INTO private.class_first_allocation_calculations_v1(canonical_intent) VALUES(p_intent)
    RETURNING * INTO inserted;
  RETURN to_jsonb(inserted);
END;
$$;

ALTER FUNCTION private.first_class_calculation_exact_keys_v1(jsonb,text[]) OWNER TO postgres;
ALTER FUNCTION private.first_class_calculation_uuid_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION private.first_class_calculation_instant_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION private.validate_first_class_calculation_intent_v1(jsonb) OWNER TO postgres;
ALTER FUNCTION private.read_first_class_bootstrap_history_v1(uuid) OWNER TO postgres;
ALTER FUNCTION private.guard_first_class_calculation_insert_v1() OWNER TO postgres;
ALTER FUNCTION private.refuse_first_class_calculation_mutation_v1() OWNER TO postgres;
ALTER FUNCTION private.refuse_first_class_calculation_truncate_v1() OWNER TO postgres;
ALTER FUNCTION private.prepare_first_class_calculation_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.first_class_calculation_exact_keys_v1(jsonb,text[]),
  private.first_class_calculation_uuid_v1(jsonb), private.first_class_calculation_instant_v1(jsonb),
  private.validate_first_class_calculation_intent_v1(jsonb), private.read_first_class_bootstrap_history_v1(uuid),
  private.guard_first_class_calculation_insert_v1(), private.refuse_first_class_calculation_mutation_v1(),
  private.refuse_first_class_calculation_truncate_v1(), private.prepare_first_class_calculation_v1(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
