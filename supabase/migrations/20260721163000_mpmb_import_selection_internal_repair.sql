-- Repair the renamed selection implementation after the optimistic-conflict
-- wrapper migration. The original body qualified the `selected` parameter with
-- its former function name, which no longer resolves after the rename.

CREATE OR REPLACE FUNCTION public.set_mpmb_import_item_selected_retryable_internal(
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
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_revision integer;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF target_import_id IS NULL OR target_item_id IS NULL OR selected IS NULL
    OR expected_revision IS NULL OR expected_revision < 1
  THEN
    RAISE EXCEPTION 'Import selection input is invalid' USING ERRCODE = '22023';
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

  UPDATE public.content_import_items AS item
  SET selected = $3
  WHERE item.id = target_item_id
    AND item.import_id = target_import_id
    AND item.mapping_status = 'valid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only valid items in this import can be selected'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.content_imports AS import_record
  SET revision = import_record.revision + 1
  WHERE import_record.id = target_import_id
  RETURNING import_record.revision INTO revision;

  SELECT count(*)
  INTO selected_count
  FROM public.content_import_items AS item
  WHERE item.import_id = target_import_id
    AND item.selected;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_mpmb_import_item_selected_retryable_internal(
  uuid, uuid, boolean, integer
) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_mpmb_import_item_selected(
  uuid, uuid, boolean, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_mpmb_import_item_selected(
  uuid, uuid, boolean, integer
) TO authenticated;
