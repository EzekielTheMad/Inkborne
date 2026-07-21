-- Explicit, auditable conflict resolution for durable MPMB import reviews.
-- Incoming rules payloads are never merged automatically: an owner either
-- creates a distinct private definition or replaces one exact private version.

ALTER TABLE public.content_import_items
  ADD COLUMN conflict_resolution text,
  ADD COLUMN replacement_content_id uuid,
  ADD COLUMN replacement_expected_version integer,
  ADD COLUMN conflict_resolved_at timestamptz,
  ADD CONSTRAINT content_import_items_conflict_resolution_valid CHECK (
    conflict_resolution IS NULL
    OR conflict_resolution IN ('keep_both', 'replace')
  ),
  ADD CONSTRAINT content_import_items_replacement_version_positive CHECK (
    replacement_expected_version IS NULL
    OR replacement_expected_version >= 1
  ),
  ADD CONSTRAINT content_import_items_conflict_resolution_shape CHECK (
    (
      conflict_resolution IS NULL
      AND replacement_content_id IS NULL
      AND replacement_expected_version IS NULL
      AND conflict_resolved_at IS NULL
    )
    OR (
      conflict_resolution = 'keep_both'
      AND replacement_content_id IS NULL
      AND replacement_expected_version IS NULL
      AND conflict_resolved_at IS NOT NULL
    )
    OR (
      conflict_resolution = 'replace'
      AND conflict_resolved_at IS NOT NULL
      AND (
        (
          replacement_content_id IS NOT NULL
          AND replacement_expected_version IS NOT NULL
        )
        -- Deleting the candidate definition invalidates, rather than blocks,
        -- an open review. Commit treats this nulled pair as stale.
        OR (
          replacement_content_id IS NULL
          AND replacement_expected_version IS NULL
        )
      )
    )
  ),
  ADD CONSTRAINT content_import_items_replacement_version_fkey
    FOREIGN KEY (replacement_content_id, replacement_expected_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE SET NULL;

CREATE INDEX content_import_items_replacement_content_idx
  ON public.content_import_items(replacement_content_id)
  WHERE replacement_content_id IS NOT NULL;

CREATE UNIQUE INDEX content_import_items_one_replacement_target_per_import_idx
  ON public.content_import_items(import_id, replacement_content_id)
  WHERE conflict_resolution = 'replace'
    AND replacement_content_id IS NOT NULL;

-- The normalized-name lookup is the conflict identity hot path. Platform,
-- retired, and other-owner definitions are deliberately outside the match.
CREATE INDEX content_definitions_owned_active_normalized_name_idx
  ON public.content_definitions(
    owner_id,
    system_id,
    content_type,
    pg_catalog.lower(pg_catalog.btrim(name))
  )
  WHERE source = 'homebrew'
    AND is_retired = false;

-- Provenance is immutable event history. A definition can now have many
-- import events, while an import item can still commit at most once.
ALTER TABLE public.content_import_origins
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN content_version integer,
  ADD COLUMN disposition text NOT NULL DEFAULT 'created',
  ADD COLUMN replaced_from_version integer;

-- Legacy imports created version 1 and did not record the exact version.
UPDATE public.content_import_origins
SET content_version = 1;

ALTER TABLE public.content_import_origins
  DROP CONSTRAINT content_import_origins_pkey,
  ALTER COLUMN content_version SET NOT NULL,
  ADD CONSTRAINT content_import_origins_pkey PRIMARY KEY (id),
  ADD CONSTRAINT content_import_origins_content_version_positive CHECK (
    content_version >= 1
  ),
  ADD CONSTRAINT content_import_origins_disposition_valid CHECK (
    disposition IN ('created', 'replaced')
  ),
  ADD CONSTRAINT content_import_origins_replaced_from_version_positive CHECK (
    replaced_from_version IS NULL OR replaced_from_version >= 1
  ),
  ADD CONSTRAINT content_import_origins_disposition_shape CHECK (
    (
      disposition = 'created'
      AND replaced_from_version IS NULL
    )
    OR (
      disposition = 'replaced'
      AND replaced_from_version IS NOT NULL
      AND content_version = replaced_from_version + 1
    )
  ),
  ADD CONSTRAINT content_import_origins_content_version_fkey
    FOREIGN KEY (content_id, content_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE CASCADE,
  ADD CONSTRAINT content_import_origins_replaced_from_version_fkey
    FOREIGN KEY (content_id, replaced_from_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE CASCADE;

CREATE INDEX content_import_origins_content_id_idx
  ON public.content_import_origins(content_id);
CREATE INDEX content_import_origins_content_version_idx
  ON public.content_import_origins(content_id, content_version);

-- Reassert the table boundary after adding the new columns: clients can read
-- owner-filtered rows through the existing policies but can mutate only via
-- the narrowly granted functions below.
ALTER TABLE public.content_import_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_import_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_import_items
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.content_import_origins
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.content_import_items TO authenticated;
GRANT SELECT ON public.content_import_origins TO authenticated;

CREATE OR REPLACE FUNCTION public.list_mpmb_import_item_conflicts(
  target_import_id uuid
)
RETURNS TABLE (
  import_item_id uuid,
  content_id uuid,
  name text,
  slug text,
  version integer,
  scope text,
  shared_campaign_count bigint,
  previously_imported boolean,
  replaceable boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF target_import_id IS NULL THEN
    RAISE EXCEPTION 'Import is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.content_imports AS import_record
    WHERE import_record.id = target_import_id
      AND import_record.owner_id = actor_id
      AND import_record.status = 'review'
  ) THEN
    RAISE EXCEPTION 'Owned import review was not found' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    item.id,
    definition.id,
    definition.name,
    definition.slug,
    definition.version,
    definition.scope,
    share_state.shared_campaign_count,
    EXISTS (
      SELECT 1
      FROM public.content_import_origins AS origin
      WHERE origin.content_id = definition.id
        AND origin.owner_id = actor_id
    ) AS previously_imported,
    definition.scope = 'personal'
      AND share_state.shared_campaign_count = 0 AS replaceable
  FROM public.content_import_items AS item
  JOIN public.content_imports AS import_record
    ON import_record.id = item.import_id
  JOIN public.content_definitions AS definition
    ON definition.system_id = import_record.system_id
   AND definition.content_type = item.content_type
   AND pg_catalog.lower(pg_catalog.btrim(definition.name))
     = pg_catalog.lower(pg_catalog.btrim(item.candidate_name))
  CROSS JOIN LATERAL (
    SELECT pg_catalog.count(*) AS shared_campaign_count
    FROM public.content_shares AS share
    WHERE share.content_id = definition.id
  ) AS share_state
  WHERE item.import_id = target_import_id
    AND item.mapping_status = 'valid'
    AND item.candidate_name IS NOT NULL
    AND item.committed_content_id IS NULL
    AND definition.owner_id = actor_id
    AND definition.source = 'homebrew'
    AND definition.is_retired = false
  ORDER BY item.ordinal, definition.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_mpmb_import_item_conflicts(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_mpmb_import_item_conflicts(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_mpmb_import_item_conflict(
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
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_revision integer;
  import_system_id uuid;
  staged_item public.content_import_items%ROWTYPE;
  locked_target public.content_definitions%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF target_import_id IS NULL
    OR target_item_id IS NULL
    OR expected_revision IS NULL
    OR expected_revision < 1
    OR resolution_strategy IS NULL
    OR resolution_strategy NOT IN ('keep_both', 'replace')
  THEN
    RAISE EXCEPTION 'Conflict resolution input is invalid' USING ERRCODE = '22023';
  END IF;
  IF (
    resolution_strategy = 'keep_both'
    AND (target_content_id IS NOT NULL OR target_content_version IS NOT NULL)
  ) OR (
    resolution_strategy = 'replace'
    AND (target_content_id IS NULL OR target_content_version IS NULL)
  ) OR (
    target_content_version IS NOT NULL AND target_content_version < 1
  ) THEN
    RAISE EXCEPTION 'Conflict resolution target is invalid' USING ERRCODE = '22023';
  END IF;

  -- Lock hierarchy: import, then item, then the exact replacement definition.
  SELECT import_record.revision, import_record.system_id
  INTO current_revision, import_system_id
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
    AND item.mapping_status = 'valid'
    AND item.candidate_name IS NOT NULL
    AND item.candidate_data IS NOT NULL
    AND item.candidate_effects IS NOT NULL
    AND item.committed_content_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owned valid import item was not found' USING ERRCODE = '42501';
  END IF;

  IF resolution_strategy = 'keep_both' THEN
    -- Recompute identity from server-owned candidate fields. No browser target
    -- is accepted for keep-both.
    IF NOT EXISTS (
      SELECT 1
      FROM public.content_definitions AS definition
      WHERE definition.owner_id = actor_id
        AND definition.system_id = import_system_id
        AND definition.content_type = staged_item.content_type
        AND definition.source = 'homebrew'
        AND definition.is_retired = false
        AND pg_catalog.lower(pg_catalog.btrim(definition.name))
          = pg_catalog.lower(pg_catalog.btrim(staged_item.candidate_name))
    ) THEN
      RAISE EXCEPTION 'Matching content changed in another session'
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.content_import_items AS item
    SET
      conflict_resolution = 'keep_both',
      replacement_content_id = NULL,
      replacement_expected_version = NULL,
      conflict_resolved_at = pg_catalog.now()
    WHERE item.id = staged_item.id;
  ELSE
    SELECT definition.*
    INTO locked_target
    FROM public.content_definitions AS definition
    WHERE definition.id = target_content_id
      AND definition.owner_id = actor_id
      AND definition.system_id = import_system_id
      AND definition.content_type = staged_item.content_type
      AND definition.source = 'homebrew'
      AND definition.is_retired = false
      AND pg_catalog.lower(pg_catalog.btrim(definition.name))
        = pg_catalog.lower(pg_catalog.btrim(staged_item.candidate_name))
    FOR UPDATE;

    IF NOT FOUND
      OR locked_target.version IS DISTINCT FROM target_content_version
    THEN
      RAISE EXCEPTION 'Replacement target changed in another session'
        USING ERRCODE = '40001';
    END IF;

    IF locked_target.scope <> 'personal'
      OR EXISTS (
        SELECT 1
        FROM public.content_shares AS share
        WHERE share.content_id = locked_target.id
      )
    THEN
      RAISE EXCEPTION 'Shared content must be unshared before replacement'
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.content_import_items AS other_item
      WHERE other_item.import_id = target_import_id
        AND other_item.id <> staged_item.id
        AND other_item.conflict_resolution = 'replace'
        AND other_item.replacement_content_id = locked_target.id
    ) THEN
      RAISE EXCEPTION 'A replacement target can be selected only once per import'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.content_import_items AS item
    SET
      conflict_resolution = 'replace',
      replacement_content_id = locked_target.id,
      replacement_expected_version = locked_target.version,
      conflict_resolved_at = pg_catalog.now()
    WHERE item.id = staged_item.id;
  END IF;

  UPDATE public.content_imports AS import_record
  SET revision = import_record.revision + 1
  WHERE import_record.id = target_import_id
  RETURNING import_record.revision INTO revision;

  SELECT
    item.conflict_resolution,
    item.replacement_content_id,
    item.replacement_expected_version
  INTO
    conflict_resolution,
    replacement_content_id,
    replacement_expected_version
  FROM public.content_import_items AS item
  WHERE item.id = staged_item.id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_mpmb_import_item_conflict(
  uuid, uuid, integer, text, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_mpmb_import_item_conflict(
  uuid, uuid, integer, text, uuid, integer
) TO authenticated;

-- Commit preflights every selected item and replacement target under stable
-- locks before creating or replacing any definition. Any exception therefore
-- rolls back definitions, snapshots, provenance, item links, and import state.
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
  import_record public.content_imports%ROWTYPE;
  staged_item public.content_import_items%ROWTYPE;
  replacement_target public.content_definitions%ROWTYPE;
  written_content_id uuid;
  written_version integer;
  live_conflict_count bigint;
  replaced_from_version integer;
  commit_disposition text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF target_import_id IS NULL OR expected_revision IS NULL OR expected_revision < 1 THEN
    RAISE EXCEPTION 'Import commit input is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT import_candidate.*
  INTO import_record
  FROM public.content_imports AS import_candidate
  WHERE import_candidate.id = target_import_id
    AND import_candidate.owner_id = actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owned import review was not found' USING ERRCODE = '42501';
  END IF;

  IF import_record.status = 'completed' THEN
    RETURN QUERY
    SELECT item.id, origin.content_id, origin.content_version
    FROM public.content_import_items AS item
    JOIN public.content_import_origins AS origin
      ON origin.import_item_id = item.id
    WHERE item.import_id = target_import_id
    ORDER BY item.ordinal;
    RETURN;
  END IF;

  IF import_record.status <> 'review' THEN
    RAISE EXCEPTION 'This import is no longer available to commit'
      USING ERRCODE = '22023';
  END IF;
  IF import_record.revision IS DISTINCT FROM expected_revision THEN
    RAISE EXCEPTION 'Import review changed in another session' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.content_import_items AS item
    WHERE item.import_id = target_import_id
      AND item.mapping_status = 'valid'
      AND item.selected
  ) THEN
    RAISE EXCEPTION 'Select at least one valid item to import' USING ERRCODE = '22023';
  END IF;

  -- Lock all selected items by ordinal before any target or definition write.
  PERFORM item.id
  FROM public.content_import_items AS item
  WHERE item.import_id = target_import_id
    AND item.mapping_status = 'valid'
    AND item.selected
  ORDER BY item.ordinal
  FOR UPDATE OF item;

  -- Every replacement definition is then locked by UUID, independent of item
  -- order, so concurrent imports cannot acquire the same targets in reverse.
  PERFORM definition.id
  FROM public.content_definitions AS definition
  JOIN (
    SELECT DISTINCT item.replacement_content_id
    FROM public.content_import_items AS item
    WHERE item.import_id = target_import_id
      AND item.mapping_status = 'valid'
      AND item.selected
      AND item.conflict_resolution = 'replace'
      AND item.replacement_content_id IS NOT NULL
  ) AS replacement
    ON replacement.replacement_content_id = definition.id
  WHERE definition.owner_id = actor_id
  ORDER BY definition.id
  FOR UPDATE OF definition;

  -- Preflight the full commit set before the first definition mutation.
  FOR staged_item IN
    SELECT item.*
    FROM public.content_import_items AS item
    WHERE item.import_id = target_import_id
      AND item.mapping_status = 'valid'
      AND item.selected
    ORDER BY item.ordinal
  LOOP
    IF staged_item.committed_content_id IS NOT NULL
      OR staged_item.candidate_name IS NULL
      OR staged_item.candidate_slug IS NULL
      OR staged_item.candidate_data IS NULL
      OR staged_item.candidate_effects IS NULL
    THEN
      RAISE EXCEPTION 'A selected import item is no longer valid'
        USING ERRCODE = '40001';
    END IF;

    SELECT pg_catalog.count(*)
    INTO live_conflict_count
    FROM public.content_definitions AS definition
    WHERE definition.owner_id = actor_id
      AND definition.system_id = import_record.system_id
      AND definition.content_type = staged_item.content_type
      AND definition.source = 'homebrew'
      AND definition.is_retired = false
      AND pg_catalog.lower(pg_catalog.btrim(definition.name))
        = pg_catalog.lower(pg_catalog.btrim(staged_item.candidate_name));

    IF live_conflict_count > 0
      AND staged_item.conflict_resolution IS NULL
    THEN
      RAISE EXCEPTION 'Resolve all selected content conflicts before committing'
        USING ERRCODE = '22023';
    END IF;

    IF live_conflict_count > 0
      AND staged_item.conflict_resolution = 'replace'
    THEN
      IF staged_item.replacement_content_id IS NULL
        OR staged_item.replacement_expected_version IS NULL
      THEN
        RAISE EXCEPTION 'Replacement target changed in another session'
          USING ERRCODE = '40001';
      END IF;

      SELECT definition.*
      INTO replacement_target
      FROM public.content_definitions AS definition
      WHERE definition.id = staged_item.replacement_content_id
        AND definition.owner_id = actor_id
        AND definition.system_id = import_record.system_id
        AND definition.content_type = staged_item.content_type
        AND definition.source = 'homebrew'
        AND definition.is_retired = false
        AND pg_catalog.lower(pg_catalog.btrim(definition.name))
          = pg_catalog.lower(pg_catalog.btrim(staged_item.candidate_name));

      IF NOT FOUND
        OR replacement_target.version
          IS DISTINCT FROM staged_item.replacement_expected_version
      THEN
        RAISE EXCEPTION 'Replacement target changed in another session'
          USING ERRCODE = '40001';
      END IF;

      IF replacement_target.scope <> 'personal'
        OR EXISTS (
          SELECT 1
          FROM public.content_shares AS share
          WHERE share.content_id = replacement_target.id
        )
      THEN
        RAISE EXCEPTION 'Shared content must be unshared before replacement'
          USING ERRCODE = '42501';
      END IF;

      -- A replacement is an immutable new version, never a no-op event.
      IF ROW(
        replacement_target.name,
        replacement_target.data,
        replacement_target.effects
      ) IS NOT DISTINCT FROM ROW(
        staged_item.candidate_name,
        staged_item.candidate_data,
        staged_item.candidate_effects
      ) THEN
        RAISE EXCEPTION 'Replacement content is unchanged; choose keep both'
          USING ERRCODE = '22023';
      END IF;
    ELSIF live_conflict_count > 0
      AND staged_item.conflict_resolution IS NOT NULL
      AND staged_item.conflict_resolution <> 'keep_both'
    THEN
      RAISE EXCEPTION 'Conflict resolution input is invalid'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- A saved choice applies only while its normalized-name conflict exists.
  -- If the target was deleted, renamed, or retired, normalize the stale intent
  -- after the full preflight and let the item follow the ordinary create path.
  UPDATE public.content_import_items AS item
  SET
    conflict_resolution = NULL,
    replacement_content_id = NULL,
    replacement_expected_version = NULL,
    conflict_resolved_at = NULL
  WHERE item.import_id = target_import_id
    AND item.mapping_status = 'valid'
    AND item.selected
    AND item.conflict_resolution IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.content_definitions AS definition
      WHERE definition.owner_id = actor_id
        AND definition.system_id = import_record.system_id
        AND definition.content_type = item.content_type
        AND definition.source = 'homebrew'
        AND definition.is_retired = false
        AND pg_catalog.lower(pg_catalog.btrim(definition.name))
          = pg_catalog.lower(pg_catalog.btrim(item.candidate_name))
    );

  FOR staged_item IN
    SELECT item.*
    FROM public.content_import_items AS item
    WHERE item.import_id = target_import_id
      AND item.mapping_status = 'valid'
      AND item.selected
    ORDER BY item.ordinal
  LOOP
    IF staged_item.conflict_resolution = 'replace' THEN
      replaced_from_version := staged_item.replacement_expected_version;
      commit_disposition := 'replaced';

      UPDATE public.content_definitions AS definition
      SET
        name = staged_item.candidate_name,
        data = staged_item.candidate_data,
        effects = staged_item.candidate_effects,
        scope = 'personal'
      WHERE definition.id = staged_item.replacement_content_id
        AND definition.version = staged_item.replacement_expected_version
      RETURNING definition.id, definition.version
      INTO written_content_id, written_version;

      IF NOT FOUND
        OR written_version IS DISTINCT FROM replaced_from_version + 1
      THEN
        RAISE EXCEPTION 'Replacement target changed in another session'
          USING ERRCODE = '40001';
      END IF;
    ELSE
      replaced_from_version := NULL;
      commit_disposition := 'created';

      INSERT INTO public.content_definitions (
        system_id,
        content_type,
        slug,
        name,
        data,
        effects,
        source,
        scope,
        owner_id
      ) VALUES (
        import_record.system_id,
        staged_item.content_type,
        pg_catalog.left(staged_item.candidate_slug, 110)
          || '-'
          || pg_catalog.substr(
            pg_catalog.replace(staged_item.id::text, '-', ''),
            1,
            8
          ),
        staged_item.candidate_name,
        staged_item.candidate_data,
        staged_item.candidate_effects,
        'homebrew',
        'personal',
        actor_id
      )
      RETURNING id, content_definitions.version
      INTO written_content_id, written_version;
    END IF;

    UPDATE public.content_import_items AS item
    SET committed_content_id = written_content_id
    WHERE item.id = staged_item.id;

    INSERT INTO public.content_import_origins (
      content_id,
      content_version,
      disposition,
      replaced_from_version,
      owner_id,
      import_id,
      import_item_id,
      source_format,
      source_sha256,
      original_filename,
      registry,
      source_key,
      parser_version,
      mapper_version,
      sharing_rights_status
    ) VALUES (
      written_content_id,
      written_version,
      commit_disposition,
      replaced_from_version,
      actor_id,
      import_record.id,
      staged_item.id,
      import_record.source_format,
      import_record.source_sha256,
      import_record.original_filename,
      staged_item.registry,
      staged_item.source_key,
      import_record.parser_version,
      import_record.mapper_version,
      'private_only'
    );

    item_id := staged_item.id;
    content_id := written_content_id;
    version := written_version;
    RETURN NEXT;
  END LOOP;

  UPDATE public.content_imports AS completed_import
  SET
    status = 'completed',
    completed_at = pg_catalog.now(),
    revision = completed_import.revision + 1
  WHERE completed_import.id = target_import_id;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_mpmb_import(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_mpmb_import(uuid, integer)
  TO authenticated;
