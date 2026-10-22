-- STAGED ONLY: native allocation calculator for one empty new-character draft.
-- The returned graph/receipt is a proposal, never an authenticated acceptance,
-- bootstrap proof, protected B1 producer, saved journal or mutation authority.
-- No application entry point, existing denial, materializer or gate is changed.
-- Finite admission requires lowercase canonical UUID text and exact zero
-- revisions; the original intent is retained without rewriting caller values.
-- Requires the closed dependency descriptor and existing private row types.

BEGIN;

CREATE FUNCTION private.allocate_first_class_save_envelope_v1(p_intent jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  parent_row public.characters%ROWTYPE;
  origin_row private.character_class_origin_v1%ROWTYPE;
  order_row private.character_projection_order_v1%ROWTYPE;
  occurrence_row private.character_class_occurrences_v1%ROWTYPE;
  ref_row public.character_content_refs%ROWTYPE;
  feature_row public.character_feature_grants%ROWTYPE;
  spell_grant_row public.character_spell_grants%ROWTYPE;
  spell_row public.character_spells%ROWTYPE;
  receipt_row private.character_class_commands_v1%ROWTYPE;
  target_id uuid;
  content_id uuid;
  content_version integer;
  version_number numeric;
  controller_id uuid;
  acceptance_id uuid;
  accepted timestamptz;
  created timestamptz;
  uuid_text text;
  descriptor jsonb;
  grant_descriptor jsonb;
  active_descriptor jsonb;
  domain text;
  before_parent jsonb;
  before_origin jsonb;
  before_order jsonb;
  occurrences jsonb := '[]'::jsonb;
  refs jsonb := '[]'::jsonb;
  spells jsonb := '[]'::jsonb;
  feature_grants jsonb := '[]'::jsonb;
  spell_grants jsonb := '[]'::jsonb;
  versions jsonb;
  graph jsonb;
  native_rows jsonb;
  planned_transitions jsonb;
  receipt jsonb;
  envelope jsonb;
BEGIN
  IF p_intent IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'First class allocation requires an object intent' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_intent::text) > 32768 THEN
    RAISE EXCEPTION 'First class allocation request exceeds byte bound' USING ERRCODE = '54000';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_intent)) <> 7
    OR NOT p_intent ?& ARRAY[
      'contract_version', 'character_id', 'operation_id', 'command',
      'expected_action_revision', 'expected_class_revision', 'fields'
    ]
    OR p_intent->'contract_version' IS DISTINCT FROM '1'::jsonb
    OR p_intent->'command' IS DISTINCT FROM '"add_class"'::jsonb
    OR p_intent->'expected_action_revision' IS DISTINCT FROM '"0"'::jsonb
    OR p_intent->'expected_class_revision' IS DISTINCT FROM '"0"'::jsonb
    OR jsonb_typeof(p_intent->'fields') IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'First class allocation intent is malformed or unsupported' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_intent->'fields')) <> 3
    OR NOT (p_intent->'fields') ?& ARRAY[
      'content_id', 'content_version', 'subclass'
    ]
    OR p_intent#>'{fields,subclass}' IS DISTINCT FROM 'null'::jsonb
    OR jsonb_typeof(p_intent#>'{fields,content_version}') IS DISTINCT FROM 'number'
    OR p_intent#>>'{fields,content_version}' !~ '^[1-9][0-9]*$'
  THEN
    RAISE EXCEPTION 'First class allocation fields are malformed or unsupported' USING ERRCODE = '22023';
  END IF;
  FOREACH uuid_text IN ARRAY ARRAY[
    p_intent->>'character_id', p_intent->>'operation_id', p_intent#>>'{fields,content_id}'
  ] LOOP
    IF uuid_text IS NULL OR uuid_text !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' THEN
      RAISE EXCEPTION 'First class allocation requires canonical lowercase UUIDs' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF jsonb_typeof(p_intent->'character_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_intent->'operation_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_intent#>'{fields,content_id}') IS DISTINCT FROM 'string'
  THEN
    RAISE EXCEPTION 'First class allocation UUID fields must be strings' USING ERRCODE = '22023';
  END IF;
  version_number := (p_intent#>>'{fields,content_version}')::numeric;
  IF version_number > 2147483647 THEN
    RAISE EXCEPTION 'First class allocation version exceeds integer range' USING ERRCODE = '22023';
  END IF;
  target_id := (p_intent->>'character_id')::uuid;
  content_id := (p_intent#>>'{fields,content_id}')::uuid;
  content_version := version_number::integer;

  -- Read actual rows, without locking or claiming a stable authenticated save.
  SELECT source.* INTO parent_row FROM public.characters AS source WHERE source.id = target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'First class allocation parent is unavailable' USING ERRCODE = '23503';
  END IF;
  SELECT source.* INTO origin_row FROM private.character_class_origin_v1 AS source
    WHERE source.character_id = target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'First class allocation origin is unavailable' USING ERRCODE = '23503';
  END IF;
  SELECT source.* INTO order_row FROM private.character_projection_order_v1 AS source
    WHERE source.character_id = target_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'First class allocation order is unavailable' USING ERRCODE = '23503';
  END IF;
  IF parent_row.campaign_id IS NOT NULL OR parent_row.level IS DISTINCT FROM 1
    OR parent_row.action_revision IS DISTINCT FROM 0
    OR parent_row.choices IS DISTINCT FROM '{}'::jsonb
    OR parent_row.base_stats IS DISTINCT FROM '{}'::jsonb
    OR parent_row.state IS DISTINCT FROM '{}'::jsonb
    OR parent_row.narrative IS DISTINCT FROM '{}'::jsonb
    OR parent_row.narrative_rich IS DISTINCT FROM '{}'::jsonb
    OR origin_row.schema_version IS DISTINCT FROM 1
    OR origin_row.system_id IS DISTINCT FROM parent_row.system_id
    OR origin_row.creation_provenance IS DISTINCT FROM 'new_character'
    OR origin_row.origin_status IS DISTINCT FROM 'draft'
    OR origin_row.command_revision IS DISTINCT FROM 0
    OR origin_row.origin_occurrence_id IS NOT NULL
    OR origin_row.role_proof IS NOT NULL
    OR origin_row.creation_operation_id IS NULL
    OR origin_row.source_draft_operation_id IS NOT NULL
    OR order_row.producer_version IS DISTINCT FROM 1
    OR order_row.producer_revision IS DISTINCT FROM 0
    OR order_row.pins IS DISTINCT FROM ARRAY[]::uuid[]
    OR order_row.inventory IS DISTINCT FROM ARRAY[]::uuid[]
    OR order_row.spells IS DISTINCT FROM ARRAY[]::uuid[]
    OR order_row.feature_grants IS DISTINCT FROM ARRAY[]::uuid[]
    OR order_row.spell_grants IS DISTINCT FROM ARRAY[]::uuid[]
    OR EXISTS (SELECT 1 FROM private.character_class_occurrences_v1 AS source WHERE source.character_id = target_id)
    OR EXISTS (SELECT 1 FROM public.character_content_refs AS source WHERE source.character_id = target_id)
    OR EXISTS (SELECT 1 FROM public.character_inventory AS source WHERE source.character_id = target_id)
    OR EXISTS (SELECT 1 FROM public.character_spells AS source WHERE source.character_id = target_id)
    OR EXISTS (SELECT 1 FROM public.character_feature_grants AS source WHERE source.character_id = target_id)
    OR EXISTS (SELECT 1 FROM public.character_spell_grants AS source WHERE source.character_id = target_id)
  THEN
    RAISE EXCEPTION 'First class allocation requires an untouched empty new draft' USING ERRCODE = '23514';
  END IF;
  FOREACH uuid_text IN ARRAY ARRAY[
    parent_row.user_id::text, parent_row.system_id::text, origin_row.creation_operation_id::text
  ] LOOP
    IF uuid_text IS NULL OR uuid_text !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' THEN
      RAISE EXCEPTION 'First class allocation stored UUID shape is unsupported' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  before_parent := to_jsonb(parent_row) || jsonb_build_object('action_revision', parent_row.action_revision::text);
  before_origin := to_jsonb(origin_row) || jsonb_build_object('command_revision', origin_row.command_revision::text);
  before_order := to_jsonb(order_row) || jsonb_build_object('producer_revision', order_row.producer_revision::text);
  descriptor := private.resolve_first_class_dependencies_v1(target_id, content_id, content_version);
  IF btrim(descriptor->>'class_slug') = '' OR length(descriptor->>'class_slug') NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'First class allocation requires a bounded nonblank class slug' USING ERRCODE = '23514';
  END IF;

  acceptance_id := gen_random_uuid();
  controller_id := gen_random_uuid();
  accepted := clock_timestamp();
  created := transaction_timestamp();
  IF NOT isfinite(accepted) OR accepted < '0001-01-01T00:00:00Z'::timestamptz
    OR accepted >= '10000-01-01T00:00:00Z'::timestamptz
  THEN
    RAISE EXCEPTION 'First class allocation requires finite supported native time' USING ERRCODE = '23514';
  END IF;

  occurrence_row.id := gen_random_uuid();
  occurrence_row.character_id := target_id;
  occurrence_row.system_id := parent_row.system_id;
  occurrence_row.content_id := content_id;
  occurrence_row.content_version := content_version;
  occurrence_row.class_slug := descriptor->>'class_slug';
  occurrence_row.lifecycle := 'provisional';
  occurrence_row.selected_at := accepted;
  occurrence_row.acquired_character_level := NULL;
  occurrence_row.acquisition_operation_id := NULL;
  occurrence_row.accepted_at := NULL;
  occurrence_row.ended_at := NULL;
  occurrence_row.controller_ref_id := controller_id;
  occurrence_row.subclass_ref_id := NULL;
  occurrences := jsonb_build_array(to_jsonb(occurrence_row));

  ref_row.id := controller_id;
  ref_row.character_id := target_id;
  ref_row.content_id := content_id;
  ref_row.content_version := content_version;
  ref_row.context := jsonb_build_object('source', 'class', 'level', 1);
  ref_row.choice_source := NULL;
  ref_row.created_at := created;
  ref_row.feature_grant_id := NULL;
  refs := jsonb_build_array(to_jsonb(ref_row));

  FOR grant_descriptor IN SELECT value FROM jsonb_array_elements(descriptor->'feature_grants')
  LOOP
    feature_row.id := gen_random_uuid();
    feature_row.character_id := target_id;
    feature_row.controller_ref_id := controller_id;
    feature_row.controller_type := 'class';
    feature_row.controller_slug := descriptor->>'class_slug';
    feature_row.feature_slug := grant_descriptor->>'feature_slug';
    feature_row.feature_content_id := (grant_descriptor->>'feature_content_id')::uuid;
    feature_row.feature_version := (grant_descriptor->>'feature_version')::integer;
    feature_row.unlock_level := (grant_descriptor->>'unlock_level')::integer;
    feature_row.created_at := created;
    feature_grants := feature_grants || jsonb_build_array(to_jsonb(feature_row));
    IF feature_row.unlock_level <= 1 THEN
      SELECT source.value INTO active_descriptor
      FROM jsonb_array_elements(descriptor->'active_feature_refs') AS source(value)
      WHERE source.value->>'feature_slug' = feature_row.feature_slug;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'First class active feature descriptor is incomplete' USING ERRCODE = '23514';
      END IF;
      ref_row.id := gen_random_uuid();
      ref_row.character_id := target_id;
      ref_row.content_id := feature_row.feature_content_id;
      ref_row.content_version := feature_row.feature_version;
      ref_row.context := active_descriptor->'context';
      ref_row.choice_source := 'auto:feature-grant:' || feature_row.id::text;
      ref_row.created_at := created;
      ref_row.feature_grant_id := feature_row.id;
      refs := refs || jsonb_build_array(to_jsonb(ref_row));
    END IF;
  END LOOP;

  FOR grant_descriptor IN SELECT value FROM jsonb_array_elements(descriptor->'spell_grants')
  LOOP
    spell_grant_row.id := gen_random_uuid();
    spell_grant_row.character_id := target_id;
    spell_grant_row.controller_ref_id := controller_id;
    spell_grant_row.controller_type := 'class';
    spell_grant_row.controller_slug := descriptor->>'class_slug';
    spell_grant_row.class_slug := descriptor->>'class_slug';
    spell_grant_row.spell_slug := grant_descriptor->>'spell_slug';
    spell_grant_row.spell_content_id := (grant_descriptor->>'spell_content_id')::uuid;
    spell_grant_row.spell_version := (grant_descriptor->>'spell_version')::integer;
    spell_grant_row.spell_name := grant_descriptor->>'spell_name';
    spell_grant_row.unlock_level := (grant_descriptor->>'unlock_level')::integer;
    spell_grant_row.created_at := created;
    spell_grants := spell_grants || jsonb_build_array(to_jsonb(spell_grant_row));
    IF spell_grant_row.unlock_level <= 1 THEN
      spell_row.id := gen_random_uuid();
      spell_row.character_id := target_id;
      spell_row.content_id := spell_grant_row.spell_content_id;
      spell_row.content_version := spell_grant_row.spell_version;
      spell_row.name := spell_grant_row.spell_name;
      spell_row.class_slug := spell_grant_row.class_slug;
      spell_row.is_known := false;
      spell_row.is_prepared := true;
      spell_row.always_prepared := true;
      spell_row.in_spellbook := false;
      spell_row.source := 'feature';
      spell_row.custom_data := NULL;
      spell_row.created_at := created;
      spell_row.spell_grant_id := spell_grant_row.id;
      spells := spells || jsonb_build_array(to_jsonb(spell_row));
    END IF;
  END LOOP;

  -- Only native allocated IDs enter order; descriptor first appearance is the
  -- explicit order proposal, not a claim about historical trigger execution.
  SELECT array_agg((source.value->>'id')::uuid ORDER BY source.position)
    INTO order_row.pins FROM jsonb_array_elements(refs) WITH ORDINALITY AS source(value, position);
  SELECT COALESCE(array_agg((source.value->>'id')::uuid ORDER BY source.position), ARRAY[]::uuid[])
    INTO order_row.spells FROM jsonb_array_elements(spells) WITH ORDINALITY AS source(value, position);
  SELECT COALESCE(array_agg((source.value->>'id')::uuid ORDER BY source.position), ARRAY[]::uuid[])
    INTO order_row.feature_grants FROM jsonb_array_elements(feature_grants) WITH ORDINALITY AS source(value, position);
  SELECT COALESCE(array_agg((source.value->>'id')::uuid ORDER BY source.position), ARRAY[]::uuid[])
    INTO order_row.spell_grants FROM jsonb_array_elements(spell_grants) WITH ORDINALITY AS source(value, position);
  order_row.producer_revision := 1;
  parent_row.choices := jsonb_build_object('classes', jsonb_build_array(jsonb_build_object(
    'occurrence_id', occurrence_row.id, 'slug', occurrence_row.class_slug, 'level', 1
  )));
  parent_row.action_revision := 1;
  origin_row.command_revision := 1;
  SELECT COALESCE(jsonb_agg(source.value ORDER BY (source.value->>'content_id')::uuid,
      (source.value->>'version')::integer), '[]'::jsonb)
    INTO versions FROM jsonb_array_elements(descriptor->'versions') AS source(value);
  graph := jsonb_build_object(
    'parent', to_jsonb(parent_row) || jsonb_build_object('action_revision', parent_row.action_revision::text),
    'origin', to_jsonb(origin_row) || jsonb_build_object('command_revision', origin_row.command_revision::text),
    'order', to_jsonb(order_row) || jsonb_build_object('producer_revision', order_row.producer_revision::text),
    'occurrences', occurrences, 'refs', refs, 'inventory', '[]'::jsonb, 'spells', spells,
    'feature_grants', feature_grants, 'spell_grants', spell_grants, 'versions', versions
  );
  FOREACH domain IN ARRAY ARRAY['occurrences', 'refs', 'inventory', 'spells', 'feature_grants', 'spell_grants', 'versions']
  LOOP
    IF jsonb_array_length(graph->domain) > 4096 THEN
      RAISE EXCEPTION 'First class allocation graph domain bound exceeded' USING ERRCODE = '54000';
    END IF;
  END LOOP;
  IF octet_length(graph::text) > 4194304 THEN
    RAISE EXCEPTION 'First class allocation graph exceeds byte bound' USING ERRCODE = '54000';
  END IF;

  -- verified_actor_id is the legacy receipt field name for actual parent owner
  -- correspondence ONLY. No token, session, Auth or bootstrap is verified here.
  receipt := jsonb_build_object(
    'receipt_version', 1, 'receipt_kind', 'class_transition',
    'operation_id', p_intent->>'operation_id', 'verified_actor_id', parent_row.user_id,
    'target_character_id', target_id,
    'accepted_at', to_char(accepted AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'canonical_intent', p_intent, 'before_action_revision', '0', 'after_action_revision', '1',
    'before_class_revision', '0', 'after_class_revision', '1', 'confirmation', NULL
  );
  -- Builtin-only closed shape check: original class-role helpers are private
  -- to their distinct owner and receive no new cross-role EXECUTE grants.
  IF (SELECT count(*) FROM jsonb_object_keys(receipt)) <> 12
    OR NOT receipt ?& ARRAY['receipt_version', 'receipt_kind', 'operation_id',
      'verified_actor_id', 'target_character_id', 'accepted_at', 'canonical_intent',
      'before_action_revision', 'after_action_revision', 'before_class_revision',
      'after_class_revision', 'confirmation']
    OR receipt->>'verified_actor_id' !~ '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$'
  THEN
    RAISE EXCEPTION 'First class allocation receipt proposal is malformed' USING ERRCODE = '23514';
  END IF;
  receipt_row.character_id := target_id;
  receipt_row.operation_id := (p_intent->>'operation_id')::uuid;
  receipt_row.receipt := receipt;
  planned_transitions := jsonb_build_array(
    jsonb_build_object('relation_key', 'origin', 'row_key', jsonb_build_array(target_id),
      'before_row', before_origin, 'after_row', graph->'origin'),
    jsonb_build_object('relation_key', 'occurrence', 'row_key', jsonb_build_array(occurrence_row.id),
      'before_row', NULL, 'after_row', to_jsonb(occurrence_row)),
    jsonb_build_object('relation_key', 'class_receipt', 'row_key', jsonb_build_array(target_id, receipt_row.operation_id),
      'before_row', NULL, 'after_row', to_jsonb(receipt_row))
  );
  IF jsonb_array_length(planned_transitions) > 1024 THEN
    RAISE EXCEPTION 'First class allocation transition bound exceeded' USING ERRCODE = '54000';
  END IF;
  native_rows := jsonb_build_object('occurrences', occurrences, 'refs', refs, 'inventory', '[]'::jsonb,
    'spells', spells, 'feature_grants', feature_grants, 'spell_grants', spell_grants);
  envelope := jsonb_build_object(
    'envelope_version', 1, 'acceptance_id', acceptance_id, 'transaction_id', pg_current_xact_id()::text,
    'before_parent', before_parent, 'before_origin', before_origin, 'before_order', before_order,
    'expected_graph', graph, 'native_rows', native_rows,
    'planned_transitions', planned_transitions, 'receipt', receipt
  );
  IF octet_length(envelope::text) > 8388608 THEN
    RAISE EXCEPTION 'First class allocation envelope exceeds byte bound' USING ERRCODE = '54000';
  END IF;
  RETURN envelope;
END;
$$;

ALTER FUNCTION private.allocate_first_class_save_envelope_v1(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.allocate_first_class_save_envelope_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
