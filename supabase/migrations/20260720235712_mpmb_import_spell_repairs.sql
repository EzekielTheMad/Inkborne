-- Narrow, audited repairs for schema-valid MPMB spell candidates that are
-- blocked only by fields the importer cannot infer safely.

ALTER TABLE public.content_import_items
  ADD COLUMN resolved_diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (pg_catalog.jsonb_typeof(resolved_diagnostics) = 'array'),
  ADD COLUMN user_edited_fields text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (user_edited_fields <@ ARRAY['material', 'dc']::text[]),
  ADD COLUMN user_edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.repair_mpmb_import_spell_item(
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
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(repair_patch)
    )
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(repair_patch) AS patch_key(key)
      WHERE patch_key.key NOT IN ('material', 'dc')
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
        'strength',
        'dexterity',
        'constitution',
        'intelligence',
        'wisdom',
        'charisma'
      )
      OR repair_patch -> 'dc' ->> 'success' NOT IN ('half', 'none', 'other')
    THEN
      RAISE EXCEPTION 'Save repair must have exactly a supported type and success outcome'
        USING ERRCODE = '22023';
    END IF;

    repaired_fields := repaired_fields || 'dc'::text;
    repaired_codes := repaired_codes || 'spell.save.success_unknown'::text;
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
    AND item.candidate_data IS NOT NULL
    AND pg_catalog.jsonb_typeof(item.candidate_data) = 'object'
    AND item.committed_content_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repairable spell item was not found' USING ERRCODE = '22023';
  END IF;

  IF repair_patch ? 'material'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = 'spell.material.required'
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  THEN
    RAISE EXCEPTION 'This spell does not have an unresolved material diagnostic'
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

  IF repair_patch ? 'dc'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(staged_item.diagnostics) AS diagnostic(issue)
      WHERE diagnostic.issue ->> 'code' = 'spell.save.success_unknown'
        AND diagnostic.issue ->> 'severity' = 'blocking'
    )
  THEN
    RAISE EXCEPTION 'This spell does not have an unresolved save diagnostic'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(
      pg_catalog.jsonb_agg(diagnostic.issue ORDER BY diagnostic.ordinality)
        FILTER (WHERE diagnostic.issue ->> 'code' = ANY (repaired_codes)),
      '[]'::jsonb
    ),
    COALESCE(
      pg_catalog.jsonb_agg(diagnostic.issue ORDER BY diagnostic.ordinality)
        FILTER (
          WHERE NOT COALESCE(
            diagnostic.issue ->> 'code' = ANY (repaired_codes),
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
    revision = import_record.revision + 1
  WHERE import_record.id = target_import_id
  RETURNING import_record.revision INTO revision;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_mpmb_import_spell_item(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.repair_mpmb_import_spell_item(
  uuid, uuid, integer, jsonb
) TO authenticated;
