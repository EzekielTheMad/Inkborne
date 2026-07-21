-- Durable, owner-only review sessions for statically parsed MPMB imports.
-- Raw MPMB source bytes are deliberately absent from this schema.

CREATE TABLE public.content_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  system_id uuid NOT NULL REFERENCES public.game_systems(id) ON DELETE CASCADE,
  source_format text NOT NULL DEFAULT 'mpmb'
    CHECK (source_format = 'mpmb'),
  original_filename text NOT NULL
    CHECK (
      char_length(original_filename) BETWEEN 1 AND 255
      AND original_filename !~ '[/\\]'
      AND original_filename !~ '[[:cntrl:]]'
      AND original_filename NOT IN ('.', '..')
    ),
  source_sha256 text NOT NULL
    CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_bytes integer NOT NULL
    CHECK (source_bytes BETWEEN 1 AND 2097152),
  parser_version text NOT NULL
    CHECK (char_length(parser_version) BETWEEN 1 AND 64),
  mapper_version text NOT NULL
    CHECK (char_length(mapper_version) BETWEEN 1 AND 64),
  required_sheet_version text
    CHECK (
      required_sheet_version IS NULL
      OR char_length(required_sheet_version) BETWEEN 1 AND 64
    ),
  source_metadata jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_metadata) = 'array'),
  file_diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(file_diagnostics) = 'array'),
  mapping_summary jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(mapping_summary) = 'object'),
  rights_attestation_version text NOT NULL
    CHECK (rights_attestation_version = 'private_use_v1'),
  rights_attested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'review'
    CHECK (status IN ('review', 'completed', 'cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (owner_id, system_id, source_format, source_sha256),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX content_imports_owner_created_idx
  ON public.content_imports(owner_id, created_at DESC);
CREATE INDEX content_imports_system_id_idx
  ON public.content_imports(system_id);

ALTER TABLE public.content_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their content imports"
  ON public.content_imports FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE TABLE public.content_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.content_imports(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  registry text NOT NULL CHECK (registry IN ('SpellsList', 'FeatsList')),
  source_key text NOT NULL CHECK (char_length(source_key) BETWEEN 1 AND 256),
  content_type text NOT NULL CHECK (content_type IN ('spell', 'feat')),
  location_line integer NOT NULL CHECK (location_line >= 1),
  location_column integer NOT NULL CHECK (location_column >= 1),
  mapping_status text NOT NULL
    CHECK (mapping_status IN ('valid', 'needs_info', 'unsupported')),
  candidate_name text CHECK (candidate_name IS NULL OR char_length(candidate_name) BETWEEN 1 AND 200),
  candidate_slug text CHECK (
    candidate_slug IS NULL
    OR (
      char_length(candidate_slug) BETWEEN 1 AND 120
      AND candidate_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ),
  candidate_data jsonb CHECK (
    candidate_data IS NULL OR jsonb_typeof(candidate_data) = 'object'
  ),
  candidate_effects jsonb CHECK (
    candidate_effects IS NULL OR jsonb_typeof(candidate_effects) = 'array'
  ),
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(source_refs) = 'array'),
  diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(diagnostics) = 'array'),
  selected boolean NOT NULL DEFAULT false,
  committed_content_id uuid REFERENCES public.content_definitions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, ordinal),
  CHECK (
    mapping_status <> 'valid'
    OR (
      candidate_name IS NOT NULL
      AND candidate_slug IS NOT NULL
      AND candidate_data IS NOT NULL
      AND candidate_effects IS NOT NULL
    )
  ),
  CHECK (NOT selected OR mapping_status = 'valid')
);

CREATE INDEX content_import_items_import_ordinal_idx
  ON public.content_import_items(import_id, ordinal);
CREATE INDEX content_import_items_committed_content_id_idx
  ON public.content_import_items(committed_content_id)
  WHERE committed_content_id IS NOT NULL;

ALTER TABLE public.content_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their content import items"
  ON public.content_import_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_imports AS import_record
      WHERE import_record.id = content_import_items.import_id
        AND import_record.owner_id = (SELECT auth.uid())
    )
  );

CREATE TABLE public.content_import_origins (
  content_id uuid PRIMARY KEY
    REFERENCES public.content_definitions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.content_imports(id) ON DELETE RESTRICT,
  import_item_id uuid NOT NULL UNIQUE
    REFERENCES public.content_import_items(id) ON DELETE RESTRICT,
  source_format text NOT NULL CHECK (source_format = 'mpmb'),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  original_filename text NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 255),
  registry text NOT NULL CHECK (registry IN ('SpellsList', 'FeatsList')),
  source_key text NOT NULL CHECK (char_length(source_key) BETWEEN 1 AND 256),
  parser_version text NOT NULL CHECK (char_length(parser_version) BETWEEN 1 AND 64),
  mapper_version text NOT NULL CHECK (char_length(mapper_version) BETWEEN 1 AND 64),
  sharing_rights_status text NOT NULL DEFAULT 'private_only'
    CHECK (sharing_rights_status IN ('private_only', 'granted')),
  sharing_rights_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (sharing_rights_status = 'granted' AND sharing_rights_granted_at IS NOT NULL)
    OR (sharing_rights_status = 'private_only' AND sharing_rights_granted_at IS NULL)
  )
);

CREATE INDEX content_import_origins_owner_created_idx
  ON public.content_import_origins(owner_id, created_at DESC);
CREATE INDEX content_import_origins_import_id_idx
  ON public.content_import_origins(import_id);

ALTER TABLE public.content_import_origins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their imported content origins"
  ON public.content_import_origins FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

REVOKE ALL ON public.content_imports
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.content_import_items
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.content_import_origins
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.content_imports TO authenticated;
GRANT SELECT ON public.content_import_items TO authenticated;
GRANT SELECT ON public.content_import_origins TO authenticated;

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
      AND import_record.source_sha256 = stage_mpmb_import.source_sha256;
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

CREATE OR REPLACE FUNCTION public.set_mpmb_import_item_selected(
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
  SET selected = set_mpmb_import_item_selected.selected
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

REVOKE ALL ON FUNCTION public.set_mpmb_import_item_selected(uuid, uuid, boolean, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_mpmb_import_item_selected(uuid, uuid, boolean, integer)
  TO authenticated;

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
  created_content_id uuid;
  created_version integer;
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
    SELECT item.id, item.committed_content_id, definition.version
    FROM public.content_import_items AS item
    JOIN public.content_definitions AS definition
      ON definition.id = item.committed_content_id
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

  FOR staged_item IN
    SELECT item.*
    FROM public.content_import_items AS item
    WHERE item.import_id = target_import_id
      AND item.mapping_status = 'valid'
      AND item.selected
    ORDER BY item.ordinal
    FOR UPDATE
  LOOP
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
        || pg_catalog.substr(pg_catalog.replace(staged_item.id::text, '-', ''), 1, 8),
      staged_item.candidate_name,
      staged_item.candidate_data,
      staged_item.candidate_effects,
      'homebrew',
      'personal',
      actor_id
    )
    RETURNING id, content_definitions.version
    INTO created_content_id, created_version;

    UPDATE public.content_import_items AS item
    SET committed_content_id = created_content_id
    WHERE item.id = staged_item.id;

    INSERT INTO public.content_import_origins (
      content_id,
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
      created_content_id,
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
    content_id := created_content_id;
    version := created_version;
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

CREATE OR REPLACE FUNCTION public.cancel_mpmb_import(target_import_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.content_imports AS import_record
  SET
    status = 'cancelled',
    revision = import_record.revision + 1
  WHERE import_record.id = target_import_id
    AND import_record.owner_id = actor_id
    AND import_record.status = 'review';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_mpmb_import(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_mpmb_import(uuid)
  TO authenticated;

-- Imported definitions are private until a separate, legally reviewed grant
-- workflow marks the origin as shareable. Enforce this at the share table so
-- every present and future write path is covered, not just the current UI/RPC.
CREATE OR REPLACE FUNCTION private.enforce_imported_content_sharing_rights()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.content_import_origins AS origin
    WHERE origin.content_id = NEW.content_id
      AND origin.sharing_rights_status <> 'granted'
  ) THEN
    RAISE EXCEPTION 'Imported content is private until sharing rights are granted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_imported_content_sharing_rights()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_imported_content_sharing_rights
  ON public.content_shares;
CREATE TRIGGER enforce_imported_content_sharing_rights
BEFORE INSERT OR UPDATE OF content_id ON public.content_shares
FOR EACH ROW
EXECUTE FUNCTION private.enforce_imported_content_sharing_rights();
