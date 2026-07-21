-- SQLSTATE 40001 means a real serialization failure. The Data API may retry
-- it, which is correct for transient transaction conflicts but wrong for an
-- optimistic revision mismatch that will never succeed with the same input.
-- Keep the existing audited implementations private and expose thin wrappers
-- that translate only serialization_failure into a non-retryable P0001 error.

ALTER FUNCTION public.set_mpmb_import_item_selected(uuid, uuid, boolean, integer)
  RENAME TO set_mpmb_import_item_selected_retryable_internal;
ALTER FUNCTION public.repair_mpmb_import_spell_item(uuid, uuid, integer, jsonb)
  RENAME TO repair_mpmb_import_spell_item_retryable_internal;
ALTER FUNCTION public.resolve_mpmb_import_item_conflict(
  uuid, uuid, integer, text, uuid, integer
)
  RENAME TO resolve_mpmb_import_item_conflict_retryable_internal;
ALTER FUNCTION public.commit_mpmb_import(uuid, integer)
  RENAME TO commit_mpmb_import_retryable_internal;

REVOKE ALL ON FUNCTION public.set_mpmb_import_item_selected_retryable_internal(
  uuid, uuid, boolean, integer
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.repair_mpmb_import_spell_item_retryable_internal(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_mpmb_import_item_conflict_retryable_internal(
  uuid, uuid, integer, text, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.commit_mpmb_import_retryable_internal(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.set_mpmb_import_item_selected(
  target_import_id uuid,
  target_item_id uuid,
  selected boolean,
  expected_revision integer
)
RETURNS TABLE (revision integer, selected_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT result.revision, result.selected_count
  FROM public.set_mpmb_import_item_selected_retryable_internal(
    target_import_id,
    target_item_id,
    selected,
    expected_revision
  ) AS result;
EXCEPTION
  WHEN serialization_failure THEN
    RAISE EXCEPTION '%', SQLERRM USING ERRCODE = 'P0001';
END;
$$;

CREATE FUNCTION public.repair_mpmb_import_spell_item(
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
  FROM public.repair_mpmb_import_spell_item_retryable_internal(
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

CREATE FUNCTION public.resolve_mpmb_import_item_conflict(
  target_import_id uuid,
  target_item_id uuid,
  expected_revision integer,
  resolution_strategy text,
  target_content_id uuid DEFAULT NULL,
  target_content_version integer DEFAULT NULL
)
RETURNS TABLE (
  revision integer,
  conflict_resolution text,
  replacement_content_id uuid,
  replacement_expected_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    result.revision,
    result.conflict_resolution,
    result.replacement_content_id,
    result.replacement_expected_version
  FROM public.resolve_mpmb_import_item_conflict_retryable_internal(
    target_import_id,
    target_item_id,
    expected_revision,
    resolution_strategy,
    target_content_id,
    target_content_version
  ) AS result;
EXCEPTION
  WHEN serialization_failure THEN
    RAISE EXCEPTION '%', SQLERRM USING ERRCODE = 'P0001';
END;
$$;

CREATE FUNCTION public.commit_mpmb_import(
  target_import_id uuid,
  expected_revision integer
)
RETURNS TABLE (item_id uuid, content_id uuid, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT result.item_id, result.content_id, result.version
  FROM public.commit_mpmb_import_retryable_internal(
    target_import_id,
    expected_revision
  ) AS result;
EXCEPTION
  WHEN serialization_failure THEN
    RAISE EXCEPTION '%', SQLERRM USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.set_mpmb_import_item_selected(
  uuid, uuid, boolean, integer
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.repair_mpmb_import_spell_item(
  uuid, uuid, integer, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_mpmb_import_item_conflict(
  uuid, uuid, integer, text, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.commit_mpmb_import(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_mpmb_import_item_selected(
  uuid, uuid, boolean, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_mpmb_import_spell_item(
  uuid, uuid, integer, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_mpmb_import_item_conflict(
  uuid, uuid, integer, text, uuid, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_mpmb_import(uuid, integer)
  TO authenticated;
