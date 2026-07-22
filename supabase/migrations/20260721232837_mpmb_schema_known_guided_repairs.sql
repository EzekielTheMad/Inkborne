-- Finite-field guided repairs for schema-valid MPMB spell and feat candidates.
-- The public wrappers translate optimistic revision conflicts out of SQLSTATE
-- 40001 so PostgREST does not retry a request that requires a fresh revision.

-- A mapper release can change a review outcome without changing the uploaded
-- bytes. Keep same-version uploads idempotent while allowing a new mapper to
-- stage a distinct, auditable review of the same source.
ALTER TABLE public.content_imports
  DROP CONSTRAINT content_imports_owner_id_system_id_source_format_source_sha_key;

ALTER TABLE public.content_imports
  ADD CONSTRAINT content_imports_owner_system_format_hash_mapper_key
  UNIQUE (owner_id, system_id, source_format, source_sha256, mapper_version);

-- Audit only the finite fields that the guided editor can change.
ALTER TABLE public.content_import_items
  DROP CONSTRAINT content_import_items_user_edited_fields_check;

ALTER TABLE public.content_import_items
  ADD CONSTRAINT content_import_items_user_edited_fields_check
  CHECK (
    user_edited_fields <@ ARRAY[
      'material',
      'dc',
      'concentration',
      'ritual',
      'prerequisites',
      'action',
      'recovery',
      'spellcastingAbility'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.stage_mpmb_import(
  target_system_id uuid,
  safe_original_filename text,
  source_sha256 text,
  source_bytes integer,
  parser_version text,
  mapper_version text,
  required_sheet_version text,
  source_metadata jsonb,
  file_diagnostics jsonb,
  mapping_summary jsonb,
  mapped_items jsonb,
  rights_attestation_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  staged_import_id uuid;
  staged_import_status text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_system_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.game_systems AS system
      WHERE system.id = target_system_id
        AND system.slug = 'dnd-5e-2014'
        AND system.status = 'published'
    )
  THEN
    RAISE EXCEPTION 'A published D&D 5e (2014) system is required'
      USING ERRCODE = '22023';
  END IF;

  IF safe_original_filename IS NULL
    OR pg_catalog.char_length(safe_original_filename) NOT BETWEEN 1 AND 255
    OR safe_original_filename ~ '[/\\]'
    OR safe_original_filename ~ '[[:cntrl:]]'
    OR safe_original_filename IN ('.', '..')
  THEN
    RAISE EXCEPTION 'The import filename is invalid' USING ERRCODE = '22023';
  END IF;

  IF source_sha256 IS NULL OR source_sha256 !~ '^[0-9a-f]{64}$'
    OR source_bytes IS NULL OR source_bytes NOT BETWEEN 1 AND 2097152
    OR parser_version IS NULL OR pg_catalog.char_length(parser_version) NOT BETWEEN 1 AND 64
    OR mapper_version IS NULL OR pg_catalog.char_length(mapper_version) NOT BETWEEN 1 AND 64
    OR (
      required_sheet_version IS NOT NULL
      AND pg_catalog.char_length(required_sheet_version) NOT BETWEEN 1 AND 64
    )
    OR rights_attestation_version IS DISTINCT FROM 'private_use_v1'
  THEN
    RAISE EXCEPTION 'Import provenance or attestation is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_typeof(source_metadata) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(file_diagnostics) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(mapping_summary) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(mapped_items) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(mapped_items) > 1000
    OR pg_catalog.pg_column_size(source_metadata) > 1048576
    OR pg_catalog.pg_column_size(file_diagnostics) > 1048576
    OR pg_catalog.pg_column_size(mapping_summary) > 65536
    OR pg_catalog.pg_column_size(mapped_items) > 8388608
  THEN
    RAISE EXCEPTION 'Import review payload exceeds its structural limits'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(mapped_items) AS value(item)
    WHERE value.item ->> 'registry' NOT IN ('SpellsList', 'FeatsList')
      OR value.item ->> 'contentType' NOT IN ('spell', 'feat')
      OR value.item ->> 'status' NOT IN ('valid', 'needs_info', 'unsupported')
      OR COALESCE(value.item ->> 'sourceKey', '') = ''
      OR pg_catalog.char_length(value.item ->> 'sourceKey') > 256
      OR pg_catalog.jsonb_typeof(value.item -> 'sourceRefs') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_typeof(value.item -> 'issues') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_typeof(value.item -> 'location') IS DISTINCT FROM 'object'
      OR COALESCE(value.item -> 'location' ->> 'line', '') !~ '^[1-9][0-9]*$'
      OR COALESCE(value.item -> 'location' ->> 'column', '') !~ '^[1-9][0-9]*$'
      OR (
        value.item ->> 'status' = 'valid'
        AND (
          pg_catalog.jsonb_typeof(value.item -> 'candidate') IS DISTINCT FROM 'object'
          OR value.item -> 'candidate' ->> 'content_type'
            IS DISTINCT FROM value.item ->> 'contentType'
          OR COALESCE(value.item -> 'candidate' ->> 'name', '') = ''
          OR pg_catalog.char_length(value.item -> 'candidate' ->> 'name') > 200
          OR COALESCE(value.item -> 'candidate' ->> 'slug', '')
            !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          OR pg_catalog.char_length(value.item -> 'candidate' ->> 'slug') > 120
          OR pg_catalog.jsonb_typeof(value.item -> 'candidate' -> 'data')
            IS DISTINCT FROM 'object'
          OR pg_catalog.jsonb_typeof(value.item -> 'candidate' -> 'effects')
            IS DISTINCT FROM 'array'
        )
      )
  ) THEN
    RAISE EXCEPTION 'One or more mapped import items are invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT import_record.id, import_record.status
  INTO staged_import_id, staged_import_status
  FROM public.content_imports AS import_record
  WHERE import_record.owner_id = actor_id
    AND import_record.system_id = target_system_id
    AND import_record.source_format = 'mpmb'
    AND import_record.source_sha256 = stage_mpmb_import.source_sha256
    AND import_record.mapper_version = stage_mpmb_import.mapper_version
  FOR UPDATE;

  IF FOUND THEN
    IF staged_import_status = 'cancelled' THEN
      UPDATE public.content_imports AS import_record
      SET
        status = 'review',
        revision = import_record.revision + 1
      WHERE import_record.id = staged_import_id;

      UPDATE public.content_import_items AS item
      SET selected = item.mapping_status = 'valid'
      WHERE item.import_id = staged_import_id;
    END IF;
    RETURN staged_import_id;
  END IF;

  INSERT INTO public.content_imports (
    owner_id,
    system_id,
    source_format,
    original_filename,
    source_sha256,
    source_bytes,
    parser_version,
    mapper_version,
    required_sheet_version,
    source_metadata,
    file_diagnostics,
    mapping_summary,
    rights_attestation_version
  ) VALUES (
    actor_id,
    target_system_id,
    'mpmb',
    safe_original_filename,
    source_sha256,
    source_bytes,
    parser_version,
    mapper_version,
    required_sheet_version,
    source_metadata,
    file_diagnostics,
    mapping_summary,
    rights_attestation_version
  )
  RETURNING id INTO staged_import_id;

  INSERT INTO public.content_import_items (
    import_id,
    ordinal,
    registry,
    source_key,
    content_type,
    location_line,
    location_column,
    mapping_status,
    candidate_name,
    candidate_slug,
    candidate_data,
    candidate_effects,
    source_refs,
    diagnostics,
    selected
  )
  SELECT
    staged_import_id,
    (entry.ordinality - 1)::integer,
    entry.item ->> 'registry',
    entry.item ->> 'sourceKey',
    entry.item ->> 'contentType',
    (entry.item -> 'location' ->> 'line')::integer,
    (entry.item -> 'location' ->> 'column')::integer,
    entry.item ->> 'status',
    entry.item -> 'candidate' ->> 'name',
    entry.item -> 'candidate' ->> 'slug',
    entry.item -> 'candidate' -> 'data',
    entry.item -> 'candidate' -> 'effects',
    entry.item -> 'sourceRefs',
    entry.item -> 'issues',
    entry.item ->> 'status' = 'valid'
  FROM pg_catalog.jsonb_array_elements(mapped_items)
    WITH ORDINALITY AS entry(item, ordinality);

  RETURN staged_import_id;
EXCEPTION
  WHEN unique_violation THEN
    SELECT import_record.id
    INTO staged_import_id
    FROM public.content_imports AS import_record
    WHERE import_record.owner_id = actor_id
      AND import_record.system_id = target_system_id
      AND import_record.source_format = 'mpmb'
      AND import_record.source_sha256 = stage_mpmb_import.source_sha256
      AND import_record.mapper_version = stage_mpmb_import.mapper_version;
    IF staged_import_id IS NULL THEN
      RAISE;
    END IF;
    RETURN staged_import_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stage_mpmb_import(
  uuid, text, text, integer, text, text, text, jsonb, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stage_mpmb_import(
  uuid, text, text, integer, text, text, text, jsonb, jsonb, jsonb, jsonb, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_mpmb_import_spell_item_retryable_internal(
  target_import_id uuid,
  target_item_id uuid,
  expected_revision integer,
  repair_patch jsonb
)
RETURNS TABLE (revision integer, mapping_status text, selected boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_revision integer;
  staged_item public.content_import_items%ROWTYPE;
  repaired_fields text[] := '{}'::text[];
  repaired_codes text[] := '{}'::text[];
  repaired_diagnostics jsonb := '[]'::jsonb;
  remaining_diagnostics jsonb := '[]'::jsonb;
  updated_candidate_data jsonb;
  repaired_material text;
  next_mapping_status text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_import_id IS NULL
    OR target_item_id IS NULL
    OR expected_revision IS NULL
    OR expected_revision < 1
    OR pg_catalog.jsonb_typeof(repair_patch) IS DISTINCT FROM 'object'
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(repair_patch)
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(repair_patch) AS patch_key(key)
      WHERE patch_key.key NOT IN ('material', 'dc', 'concentration', 'ritual')
    )
  THEN
    RAISE EXCEPTION 'Spell repair input is invalid' USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'material' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'material') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Material repair must be text' USING ERRCODE = '22023';
    END IF;
    repaired_material := pg_catalog.btrim(repair_patch ->> 'material');
    IF repaired_material !~ '[^[:space:]]'
      OR pg_catalog.char_length(repaired_material) > 500
    THEN
      RAISE EXCEPTION 'Material repair must contain 1 to 500 characters'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'material'::text;
    repaired_codes := repaired_codes || 'spell.material.required'::text;
  END IF;

  IF repair_patch ? 'dc' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'dc') IS DISTINCT FROM 'object'
      OR NOT (repair_patch -> 'dc' ? 'type')
      OR NOT (repair_patch -> 'dc' ? 'success')
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_object_keys(repair_patch -> 'dc') AS dc_key(key)
        WHERE dc_key.key NOT IN ('type', 'success')
      )
      OR (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.jsonb_object_keys(repair_patch -> 'dc')
      ) <> 2
      OR pg_catalog.jsonb_typeof(repair_patch -> 'dc' -> 'type') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(repair_patch -> 'dc' -> 'success') IS DISTINCT FROM 'string'
      OR repair_patch -> 'dc' ->> 'type' NOT IN (
        'strength', 'dexterity', 'constitution',
        'intelligence', 'wisdom', 'charisma'
      )
      OR repair_patch -> 'dc' ->> 'success' NOT IN ('half', 'none', 'other')
    THEN
      RAISE EXCEPTION 'Save repair must have exactly a supported type and success outcome'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'dc'::text;
    repaired_codes := repaired_codes || 'spell.save.success_unknown'::text;
  END IF;

  IF repair_patch ? 'concentration' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'concentration') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Concentration repair must be a boolean'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'concentration'::text;
    repaired_codes := repaired_codes || 'spell.concentration.invalid'::text;
  END IF;

  IF repair_patch ? 'ritual' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'ritual') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Ritual repair must be a boolean'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'ritual'::text;
    repaired_codes := repaired_codes || 'spell.ritual.invalid'::text;
  END IF;

  SELECT import_record.revision
  INTO current_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = target_import_id
    AND import_record.owner_id = actor_id
    AND import_record.status = 'review'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owned import review was not found' USING ERRCODE = '42501';
  END IF;
  IF current_revision IS DISTINCT FROM expected_revision THEN
    RAISE EXCEPTION 'Import review changed in another session' USING ERRCODE = '40001';
  END IF;

  SELECT item.*
  INTO staged_item
  FROM public.content_import_items AS item
  WHERE item.id = target_item_id
    AND item.import_id = target_import_id
    AND item.content_type = 'spell'
    AND item.mapping_status = 'needs_info'
    AND item.candidate_name IS NOT NULL
    AND item.candidate_slug IS NOT NULL
    AND pg_catalog.jsonb_typeof(item.candidate_data) = 'object'
    AND pg_catalog.jsonb_typeof(item.candidate_effects) = 'array'
    AND item.committed_content_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repairable spell item was not found' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(repaired_codes) AS repaired(code)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = repaired.code
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  ) THEN
    RAISE EXCEPTION 'Spell repair does not match an unresolved supported diagnostic'
      USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'material'
    AND (
      pg_catalog.jsonb_typeof(staged_item.candidate_data -> 'components')
        IS DISTINCT FROM 'array'
      OR NOT (staged_item.candidate_data -> 'components' @> '["M"]'::jsonb)
    )
  THEN
    RAISE EXCEPTION 'Material can only repair a spell with an M component'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(
      pg_catalog.jsonb_agg(diagnostic.issue ORDER BY diagnostic.ordinality)
        FILTER (
          WHERE diagnostic.issue ->> 'code' = ANY (repaired_codes)
            AND diagnostic.issue ->> 'severity' = 'blocking'
        ),
      '[]'::jsonb
    ),
    COALESCE(
      pg_catalog.jsonb_agg(diagnostic.issue ORDER BY diagnostic.ordinality)
        FILTER (
          WHERE NOT COALESCE(
            diagnostic.issue ->> 'code' = ANY (repaired_codes)
              AND diagnostic.issue ->> 'severity' = 'blocking',
            false
          )
        ),
      '[]'::jsonb
    )
  INTO repaired_diagnostics, remaining_diagnostics
  FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics)
    WITH ORDINALITY AS diagnostic(issue, ordinality);

  updated_candidate_data := staged_item.candidate_data;
  IF repair_patch ? 'material' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{material}'::text[],
      pg_catalog.to_jsonb(repaired_material),
      true
    );
  END IF;
  IF repair_patch ? 'dc' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{dc}'::text[],
      repair_patch -> 'dc',
      true
    );
  END IF;
  IF repair_patch ? 'concentration' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{concentration}'::text[],
      repair_patch -> 'concentration',
      true
    );
  END IF;
  IF repair_patch ? 'ritual' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{ritual}'::text[],
      repair_patch -> 'ritual',
      true
    );
  END IF;

  next_mapping_status := CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(remaining_diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'severity' = 'blocking'
    ) THEN 'needs_info'
    ELSE 'valid'
  END;

  UPDATE public.content_import_items AS item
  SET
    candidate_data = updated_candidate_data,
    diagnostics = remaining_diagnostics,
    resolved_diagnostics = item.resolved_diagnostics || repaired_diagnostics,
    user_edited_fields = item.user_edited_fields || repaired_fields,
    user_edited_at = pg_catalog.now(),
    mapping_status = next_mapping_status,
    selected = next_mapping_status = 'valid'
  WHERE item.id = target_item_id
    AND item.import_id = target_import_id
  RETURNING item.mapping_status, item.selected
  INTO mapping_status, selected;

  UPDATE public.content_imports AS import_record
  SET
    mapping_summary = import_record.mapping_summary || pg_catalog.jsonb_build_object(
      'valid', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        WHERE summary_item.import_id = target_import_id
          AND summary_item.mapping_status = 'valid'
      ),
      'needsInfo', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        WHERE summary_item.import_id = target_import_id
          AND summary_item.mapping_status = 'needs_info'
      ),
      'unsupported', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        WHERE summary_item.import_id = target_import_id
          AND summary_item.mapping_status = 'unsupported'
      ),
      'blockingIssues', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(summary_item.diagnostics)
          AS diagnostic(issue)
        WHERE summary_item.import_id = target_import_id
          AND diagnostic.issue ->> 'severity' = 'blocking'
      ) + (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.jsonb_array_elements(import_record.source_metadata)
          AS source_record(source)
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
          CASE
            WHEN pg_catalog.jsonb_typeof(source_record.source -> 'issues') = 'array'
              THEN source_record.source -> 'issues'
            ELSE '[]'::jsonb
          END
        ) AS diagnostic(issue)
        WHERE diagnostic.issue ->> 'severity' = 'blocking'
      )
    ),
    revision = import_record.revision + 1,
    preview_validated_revision = NULL,
    preview_validated_at = NULL
  WHERE import_record.id = target_import_id
  RETURNING import_record.revision INTO revision;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_mpmb_import_spell_item_retryable_internal(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- This public wrapper was introduced by the non-retryable-conflict migration.
-- Revoke and re-grant it without replacing its conflict-translation body.
REVOKE ALL ON FUNCTION public.repair_mpmb_import_spell_item(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_mpmb_import_spell_item(
  uuid, uuid, integer, jsonb
) TO authenticated;

CREATE FUNCTION public.repair_mpmb_import_feat_item_retryable_internal(
  target_import_id uuid,
  target_item_id uuid,
  expected_revision integer,
  repair_patch jsonb
)
RETURNS TABLE (revision integer, mapping_status text, selected boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_revision integer;
  staged_item public.content_import_items%ROWTYPE;
  repaired_fields text[] := '{}'::text[];
  repaired_codes text[] := '{}'::text[];
  repaired_diagnostics jsonb := '[]'::jsonb;
  remaining_diagnostics jsonb := '[]'::jsonb;
  updated_candidate_data jsonb;
  next_mapping_status text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_import_id IS NULL
    OR target_item_id IS NULL
    OR expected_revision IS NULL
    OR expected_revision < 1
    OR pg_catalog.jsonb_typeof(repair_patch) IS DISTINCT FROM 'object'
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(repair_patch)
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(repair_patch) AS patch_key(key)
      WHERE patch_key.key NOT IN (
        'prerequisites', 'action', 'recovery', 'spellcastingAbility'
      )
    )
  THEN
    RAISE EXCEPTION 'Feat repair input is invalid' USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'prerequisites' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'prerequisites') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(repair_patch -> 'prerequisites') > 1
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(repair_patch -> 'prerequisites')
          AS prerequisite(value)
        WHERE CASE
          WHEN pg_catalog.jsonb_typeof(prerequisite.value) = 'object'
            AND (
              SELECT pg_catalog.count(*)
              FROM pg_catalog.jsonb_object_keys(prerequisite.value)
            ) = 3
            AND prerequisite.value ? 'stat'
            AND prerequisite.value ? 'op'
            AND prerequisite.value ? 'value'
            AND pg_catalog.jsonb_typeof(prerequisite.value -> 'stat') = 'string'
            AND pg_catalog.jsonb_typeof(prerequisite.value -> 'op') = 'string'
            AND pg_catalog.jsonb_typeof(prerequisite.value -> 'value') = 'number'
          THEN NOT (
            prerequisite.value ->> 'stat' IN (
              'strength', 'dexterity', 'constitution',
              'intelligence', 'wisdom', 'charisma'
            )
            AND prerequisite.value ->> 'op' = 'gte'
            AND (prerequisite.value ->> 'value')::numeric
              = pg_catalog.trunc((prerequisite.value ->> 'value')::numeric)
            AND (prerequisite.value ->> 'value')::numeric BETWEEN 1 AND 30
          )
          ELSE true
        END
      )
    THEN
      RAISE EXCEPTION 'Prerequisites repair must be empty or one supported ability threshold'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'prerequisites'::text;
    repaired_codes := repaired_codes || ARRAY[
      'feat.prerequisite.ambiguous',
      'feat.prerequisite.compound',
      'feat.prerequisite.unsupported',
      'feat.prerequisite.invalid',
      'feat.prereqeval.not_automated'
    ]::text[];
  END IF;

  IF repair_patch ? 'action' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'action') NOT IN ('null', 'string')
      OR (
        pg_catalog.jsonb_typeof(repair_patch -> 'action') = 'string'
        AND repair_patch ->> 'action' NOT IN (
          'action', 'bonus action', 'reaction', 'free'
        )
      )
    THEN
      RAISE EXCEPTION 'Action repair must be a supported action or null'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'action'::text;
    repaired_codes := repaired_codes || 'feat.action.invalid'::text;
  END IF;

  IF repair_patch ? 'recovery' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'recovery') NOT IN ('null', 'string')
      OR (
        pg_catalog.jsonb_typeof(repair_patch -> 'recovery') = 'string'
        AND repair_patch ->> 'recovery' NOT IN (
          'short rest', 'long rest', 'dawn', 'day'
        )
      )
    THEN
      RAISE EXCEPTION 'Recovery repair must be a supported recovery or null'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'recovery'::text;
    repaired_codes := repaired_codes || 'feat.recovery.invalid'::text;
  END IF;

  IF repair_patch ? 'spellcastingAbility' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'spellcastingAbility')
        NOT IN ('null', 'string')
      OR (
        pg_catalog.jsonb_typeof(repair_patch -> 'spellcastingAbility') = 'string'
        AND repair_patch ->> 'spellcastingAbility' NOT IN (
          'strength', 'dexterity', 'constitution',
          'intelligence', 'wisdom', 'charisma'
        )
      )
    THEN
      RAISE EXCEPTION 'Spellcasting ability repair must be a supported ability or null'
        USING ERRCODE = '22023';
    END IF;
    repaired_fields := repaired_fields || 'spellcastingAbility'::text;
    repaired_codes := repaired_codes || 'feat.spellcastingAbility.invalid'::text;
  END IF;

  SELECT import_record.revision
  INTO current_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = target_import_id
    AND import_record.owner_id = actor_id
    AND import_record.status = 'review'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owned import review was not found' USING ERRCODE = '42501';
  END IF;
  IF current_revision IS DISTINCT FROM expected_revision THEN
    RAISE EXCEPTION 'Import review changed in another session' USING ERRCODE = '40001';
  END IF;

  SELECT item.*
  INTO staged_item
  FROM public.content_import_items AS item
  WHERE item.id = target_item_id
    AND item.import_id = target_import_id
    AND item.content_type = 'feat'
    AND item.mapping_status = 'needs_info'
    AND item.candidate_name IS NOT NULL
    AND item.candidate_slug IS NOT NULL
    AND pg_catalog.jsonb_typeof(item.candidate_data) = 'object'
    AND pg_catalog.jsonb_typeof(item.candidate_effects) = 'array'
    AND item.committed_content_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repairable feat item was not found' USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'prerequisites'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = ANY (ARRAY[
        'feat.prerequisite.ambiguous',
        'feat.prerequisite.compound',
        'feat.prerequisite.unsupported',
        'feat.prerequisite.invalid',
        'feat.prereqeval.not_automated'
      ]::text[])
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  THEN
    RAISE EXCEPTION 'This feat does not have an unresolved prerequisite diagnostic'
      USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'action'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = 'feat.action.invalid'
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  THEN
    RAISE EXCEPTION 'This feat does not have an unresolved action diagnostic'
      USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'recovery'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = 'feat.recovery.invalid'
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  THEN
    RAISE EXCEPTION 'This feat does not have an unresolved recovery diagnostic'
      USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'spellcastingAbility'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = 'feat.spellcastingAbility.invalid'
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  THEN
    RAISE EXCEPTION 'This feat does not have an unresolved spellcasting ability diagnostic'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(
      pg_catalog.jsonb_agg(diagnostic.issue ORDER BY diagnostic.ordinality)
        FILTER (
          WHERE diagnostic.issue ->> 'code' = ANY (repaired_codes)
            AND (
              diagnostic.issue ->> 'severity' = 'blocking'
              OR (
                repair_patch ? 'prerequisites'
                AND diagnostic.issue ->> 'code' = 'feat.prereqeval.not_automated'
              )
            )
        ),
      '[]'::jsonb
    ),
    COALESCE(
      pg_catalog.jsonb_agg(diagnostic.issue ORDER BY diagnostic.ordinality)
        FILTER (
          WHERE NOT COALESCE(
            diagnostic.issue ->> 'code' = ANY (repaired_codes)
              AND (
                diagnostic.issue ->> 'severity' = 'blocking'
                OR (
                  repair_patch ? 'prerequisites'
                  AND diagnostic.issue ->> 'code' = 'feat.prereqeval.not_automated'
                )
              ),
            false
          )
        ),
      '[]'::jsonb
    )
  INTO repaired_diagnostics, remaining_diagnostics
  FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics)
    WITH ORDINALITY AS diagnostic(issue, ordinality);

  updated_candidate_data := staged_item.candidate_data;
  IF repair_patch ? 'prerequisites' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{prerequisites}'::text[],
      repair_patch -> 'prerequisites',
      true
    );
  END IF;
  IF repair_patch ? 'action' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{action}'::text[],
      repair_patch -> 'action',
      true
    );
  END IF;
  IF repair_patch ? 'recovery' THEN
    updated_candidate_data := pg_catalog.jsonb_set(
      updated_candidate_data,
      '{recovery}'::text[],
      repair_patch -> 'recovery',
      true
    );
  END IF;
  IF repair_patch ? 'spellcastingAbility' THEN
    IF pg_catalog.jsonb_typeof(repair_patch -> 'spellcastingAbility') = 'null' THEN
      updated_candidate_data := updated_candidate_data - 'spellcastingAbility';
    ELSE
      updated_candidate_data := pg_catalog.jsonb_set(
        updated_candidate_data,
        '{spellcastingAbility}'::text[],
        repair_patch -> 'spellcastingAbility',
        true
      );
    END IF;
  END IF;

  next_mapping_status := CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(remaining_diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'severity' = 'blocking'
    ) THEN 'needs_info'
    ELSE 'valid'
  END;

  UPDATE public.content_import_items AS item
  SET
    candidate_data = updated_candidate_data,
    diagnostics = remaining_diagnostics,
    resolved_diagnostics = item.resolved_diagnostics || repaired_diagnostics,
    user_edited_fields = item.user_edited_fields || repaired_fields,
    user_edited_at = pg_catalog.now(),
    mapping_status = next_mapping_status,
    selected = next_mapping_status = 'valid'
  WHERE item.id = target_item_id
    AND item.import_id = target_import_id
  RETURNING item.mapping_status, item.selected
  INTO mapping_status, selected;

  UPDATE public.content_imports AS import_record
  SET
    mapping_summary = import_record.mapping_summary || pg_catalog.jsonb_build_object(
      'valid', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        WHERE summary_item.import_id = target_import_id
          AND summary_item.mapping_status = 'valid'
      ),
      'needsInfo', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        WHERE summary_item.import_id = target_import_id
          AND summary_item.mapping_status = 'needs_info'
      ),
      'unsupported', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        WHERE summary_item.import_id = target_import_id
          AND summary_item.mapping_status = 'unsupported'
      ),
      'blockingIssues', (
        SELECT pg_catalog.count(*)
        FROM public.content_import_items AS summary_item
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(summary_item.diagnostics)
          AS diagnostic(issue)
        WHERE summary_item.import_id = target_import_id
          AND diagnostic.issue ->> 'severity' = 'blocking'
      ) + (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.jsonb_array_elements(import_record.source_metadata)
          AS source_record(source)
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
          CASE
            WHEN pg_catalog.jsonb_typeof(source_record.source -> 'issues') = 'array'
              THEN source_record.source -> 'issues'
            ELSE '[]'::jsonb
          END
        ) AS diagnostic(issue)
        WHERE diagnostic.issue ->> 'severity' = 'blocking'
      )
    ),
    revision = import_record.revision + 1,
    preview_validated_revision = NULL,
    preview_validated_at = NULL
  WHERE import_record.id = target_import_id
  RETURNING import_record.revision INTO revision;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_mpmb_import_feat_item_retryable_internal(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.repair_mpmb_import_feat_item(
  target_import_id uuid,
  target_item_id uuid,
  expected_revision integer,
  repair_patch jsonb
)
RETURNS TABLE (mapping_status text, revision integer, selected boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT result.mapping_status, result.revision, result.selected
  FROM public.repair_mpmb_import_feat_item_retryable_internal(
    target_import_id,
    target_item_id,
    expected_revision,
    repair_patch
  ) AS result;
EXCEPTION
  WHEN serialization_failure THEN
    RAISE EXCEPTION '%', SQLERRM USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.repair_mpmb_import_feat_item(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_mpmb_import_feat_item(
  uuid, uuid, integer, jsonb
) TO authenticated;
