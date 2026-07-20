-- Publish a complete SRD catalog as one transaction. Import clients upload a
-- fully prepared batch to locked-down staging tables, then invoke one RPC that
-- validates, upserts, retires missing definitions, and removes the batch.

ALTER TABLE public.content_definitions
  ADD COLUMN is_retired boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT content_definitions_homebrew_not_retired CHECK (
    source = 'srd' OR is_retired = false
  );

DROP POLICY IF EXISTS "Catalog content visible to authorized users"
  ON public.content_definitions;

CREATE POLICY "Catalog content visible to authorized users"
  ON public.content_definitions FOR SELECT
  TO authenticated
  USING (
    (scope = 'platform' AND is_retired = false)
    OR owner_id = (SELECT auth.uid())
    OR (
      scope = 'shared'
      AND EXISTS (
        SELECT 1
        FROM public.content_shares AS share
        WHERE share.content_id = content_definitions.id
          AND private.can_access_campaign(share.campaign_id)
      )
    )
  );

CREATE TABLE public.srd_import_batches (
  id uuid PRIMARY KEY,
  system_id uuid NOT NULL
    REFERENCES public.game_systems(id) ON DELETE CASCADE,
  expected_count integer NOT NULL CHECK (expected_count > 0),
  allow_destructive_retirement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT srd_import_batches_id_system_unique UNIQUE (id, system_id)
);

ALTER TABLE public.srd_import_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.srd_import_staging (
  batch_id uuid NOT NULL,
  system_id uuid NOT NULL,
  content_type text NOT NULL CHECK (btrim(content_type) <> ''),
  slug text NOT NULL CHECK (btrim(slug) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  effects jsonb NOT NULL CHECK (jsonb_typeof(effects) = 'array'),
  source text NOT NULL CHECK (source = 'srd'),
  scope text NOT NULL CHECK (scope = 'platform'),
  owner_id uuid CHECK (owner_id IS NULL),
  PRIMARY KEY (batch_id, content_type, slug),
  CONSTRAINT srd_import_staging_batch_system_fkey
    FOREIGN KEY (batch_id, system_id)
    REFERENCES public.srd_import_batches(id, system_id)
    ON DELETE CASCADE
);

ALTER TABLE public.srd_import_staging ENABLE ROW LEVEL SECURITY;

-- Explicit grants are required by Supabase's current Data API defaults. No
-- policy is intentionally created: anon/authenticated cannot see staging,
-- while the BYPASSRLS service role can use only these exact privileges.
REVOKE ALL ON public.srd_import_batches
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.srd_import_staging
  FROM PUBLIC, anon, authenticated, service_role;
-- UPDATE is required by PostgreSQL for SELECT ... FOR UPDATE. That row lock
-- prevents a timed-out client's cleanup DELETE from racing an in-flight
-- promotion. The table remains inaccessible to end-user roles.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.srd_import_batches TO service_role;
GRANT SELECT, INSERT ON public.srd_import_staging TO service_role;

-- The invoker remains the service role. Avoiding SECURITY DEFINER keeps this
-- function from becoming a privilege-escalation path if grants drift later.
CREATE OR REPLACE FUNCTION public.promote_srd_import(p_batch_id uuid)
RETURNS TABLE (upserted_count integer, retired_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_batch public.srd_import_batches%ROWTYPE;
  staged_count integer;
  missing_active_count integer;
  missing_active_sample text;
BEGIN
  SELECT batch.*
  INTO target_batch
  FROM public.srd_import_batches AS batch
  WHERE batch.id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown SRD import batch: %', p_batch_id
      USING ERRCODE = '22023';
  END IF;

  -- Two complete imports for the same rules system must not interleave their
  -- upsert/retirement phases. A transaction advisory lock avoids granting the
  -- importer UPDATE merely to row-lock public.game_systems.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'inkborne:srd-import:' || target_batch.system_id::text,
      0
    )
  );

  SELECT count(*)::integer
  INTO staged_count
  FROM public.srd_import_staging AS staged
  WHERE staged.batch_id = p_batch_id;

  IF staged_count <> target_batch.expected_count THEN
    RAISE EXCEPTION
      'Incomplete SRD import batch %: expected % rows, found %',
      p_batch_id,
      target_batch.expected_count,
      staged_count
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.srd_import_staging AS staged
    WHERE staged.batch_id = p_batch_id
      AND (
        staged.system_id IS DISTINCT FROM target_batch.system_id
        OR staged.source IS DISTINCT FROM 'srd'
        OR staged.scope IS DISTINCT FROM 'platform'
        OR staged.owner_id IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'SRD import batch % contains an invalid ownership envelope',
      p_batch_id
      USING ERRCODE = '22023';
  END IF;

  -- expected_count proves upload completeness only against the importer's own
  -- claim. Exact identity containment also proves that a truncated upstream
  -- response cannot silently retire any currently active SRD definition.
  IF NOT target_batch.allow_destructive_retirement THEN
    SELECT count(*)::integer
    INTO missing_active_count
    FROM public.content_definitions AS definition
    WHERE definition.system_id = target_batch.system_id
      AND definition.source = 'srd'
      AND definition.scope = 'platform'
      AND definition.owner_id IS NULL
      AND definition.is_retired = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.srd_import_staging AS staged
        WHERE staged.batch_id = p_batch_id
          AND staged.system_id = definition.system_id
          AND staged.content_type = definition.content_type
          AND staged.slug = definition.slug
      );

    IF missing_active_count > 0 THEN
      SELECT pg_catalog.string_agg(missing.identity, ', ' ORDER BY missing.identity)
      INTO missing_active_sample
      FROM (
        SELECT definition.content_type || '/' || definition.slug AS identity
        FROM public.content_definitions AS definition
        WHERE definition.system_id = target_batch.system_id
          AND definition.source = 'srd'
          AND definition.scope = 'platform'
          AND definition.owner_id IS NULL
          AND definition.is_retired = false
          AND NOT EXISTS (
            SELECT 1
            FROM public.srd_import_staging AS staged
            WHERE staged.batch_id = p_batch_id
              AND staged.system_id = definition.system_id
              AND staged.content_type = definition.content_type
              AND staged.slug = definition.slug
          )
        ORDER BY definition.content_type, definition.slug
        LIMIT 10
      ) AS missing;

      RAISE EXCEPTION
        'SRD completeness guard rejected batch %: % active identities are missing',
        p_batch_id,
        missing_active_count
        USING
          ERRCODE = '22023',
          DETAIL = 'Missing examples: ' || missing_active_sample,
          HINT = 'Review the upstream dataset, then rerun with --allow-destructive-retirement only for intentional removals.';
    END IF;
  END IF;

  WITH promoted AS (
    INSERT INTO public.content_definitions (
      system_id,
      content_type,
      slug,
      name,
      data,
      effects,
      source,
      scope,
      owner_id,
      is_retired
    )
    SELECT
      staged.system_id,
      staged.content_type,
      staged.slug,
      staged.name,
      staged.data,
      staged.effects,
      staged.source,
      staged.scope,
      staged.owner_id,
      false
    FROM public.srd_import_staging AS staged
    WHERE staged.batch_id = p_batch_id
    ON CONFLICT ON CONSTRAINT content_definitions_identity_unique
    DO UPDATE SET
      name = EXCLUDED.name,
      data = EXCLUDED.data,
      effects = EXCLUDED.effects,
      scope = EXCLUDED.scope,
      is_retired = false
    RETURNING 1
  )
  SELECT count(*)::integer INTO upserted_count FROM promoted;

  -- Missing rows remain in place, along with every immutable version snapshot.
  -- Catalog RLS hides them from new selection while character-version foreign
  -- keys continue to resolve existing sheets.
  WITH retired AS (
    UPDATE public.content_definitions AS definition
    SET is_retired = true
    WHERE definition.system_id = target_batch.system_id
      AND definition.source = 'srd'
      AND definition.scope = 'platform'
      AND definition.owner_id IS NULL
      AND definition.is_retired = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.srd_import_staging AS staged
        WHERE staged.batch_id = p_batch_id
          AND staged.system_id = definition.system_id
          AND staged.content_type = definition.content_type
          AND staged.slug = definition.slug
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO retired_count FROM retired;

  DELETE FROM public.srd_import_batches AS batch
  WHERE batch.id = p_batch_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_srd_import(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_srd_import(uuid) TO service_role;

-- The invoker RPC needs explicit access even when automatic Data API exposure
-- is disabled. Existing character-facing grants remain unchanged.
GRANT SELECT ON public.game_systems TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.content_definitions TO service_role;
