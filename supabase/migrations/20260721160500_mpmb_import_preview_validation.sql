ALTER TABLE public.content_imports
  ADD COLUMN preview_validated_revision integer,
  ADD COLUMN preview_validated_at timestamptz,
  ADD CONSTRAINT content_imports_preview_revision_valid
    CHECK (
      preview_validated_revision IS NULL
      OR (
        preview_validated_revision >= 1
        AND preview_validated_revision <= revision
      )
    ),
  ADD CONSTRAINT content_imports_preview_stamp_complete
    CHECK (
      (preview_validated_revision IS NULL)
      = (preview_validated_at IS NULL)
    );

COMMENT ON COLUMN public.content_imports.preview_validated_revision IS
  'Exact review revision whose selected candidate calculations passed the server preview and were confirmed by the owner.';
COMMENT ON COLUMN public.content_imports.preview_validated_at IS
  'Timestamp for the current preview validation stamp; stale stamps remain as audit evidence after revision changes.';

-- Only the server-side validation action may record a successful preview. The
-- browser cannot stamp an import directly: this function is service-role only,
-- checks the already-authenticated owner supplied by the server, and locks the
-- exact review revision before updating it.
CREATE FUNCTION public.record_mpmb_import_preview(
  target_import_id uuid,
  validated_owner_id uuid,
  expected_revision integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_revision integer;
BEGIN
  IF target_import_id IS NULL
    OR validated_owner_id IS NULL
    OR expected_revision IS NULL
    OR expected_revision < 1
  THEN
    RAISE EXCEPTION 'Preview confirmation input is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT import_record.revision
  INTO current_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = target_import_id
    AND import_record.owner_id = validated_owner_id
    AND import_record.status = 'review'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owned import review was not found'
      USING ERRCODE = '42501';
  END IF;
  IF current_revision IS DISTINCT FROM expected_revision THEN
    RAISE EXCEPTION 'Import review changed in another session'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.content_imports AS import_record
  SET
    preview_validated_revision = current_revision,
    preview_validated_at = pg_catalog.now()
  WHERE import_record.id = target_import_id;

  RETURN current_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.record_mpmb_import_preview(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_mpmb_import_preview(uuid, uuid, integer)
  TO service_role;

-- The public commit RPC remains the only client-callable commit entry point.
-- Gate its review path before delegating to the audited atomic implementation.
-- Completed imports intentionally delegate unchanged so idempotent retries can
-- still return the exact provenance versions written by the first commit.
CREATE OR REPLACE FUNCTION public.commit_mpmb_import(
  target_import_id uuid,
  expected_revision integer
)
RETURNS TABLE (item_id uuid, content_id uuid, version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_status text;
  current_revision integer;
  validated_revision integer;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT
    import_record.status,
    import_record.revision,
    import_record.preview_validated_revision
  INTO current_status, current_revision, validated_revision
  FROM public.content_imports AS import_record
  WHERE import_record.id = target_import_id
    AND import_record.owner_id = actor_id;

  IF FOUND
    AND current_status = 'review'
    AND current_revision IS NOT DISTINCT FROM expected_revision
    AND validated_revision IS DISTINCT FROM current_revision
  THEN
    RAISE EXCEPTION 'Preview the current import calculations before committing'
      USING ERRCODE = '22023';
  END IF;

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

REVOKE ALL ON FUNCTION public.commit_mpmb_import(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_mpmb_import(uuid, integer)
  TO authenticated;
