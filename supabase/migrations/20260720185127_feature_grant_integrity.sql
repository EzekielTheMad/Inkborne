-- Close two integrity gaps in frozen class/subclass feature grants:
--
-- 1. A derived character_content_refs row must identify a grant for the same
--    character and the exact feature snapshot stored on that grant. A UUID-only
--    foreign key allowed an owner to point a ref at another owned character's
--    grant or to pair a grant with unrelated content.
-- 2. The SECURITY DEFINER materializer must resolve only feature snapshots the
--    target character owner can actually use. This matters when a controller is
--    shared into a campaign but one of its same-owner dependencies is private.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.character_feature_grants AS grant_row
    JOIN public.character_content_refs AS controller
      ON controller.id = grant_row.controller_ref_id
    WHERE grant_row.character_id IS DISTINCT FROM controller.character_id
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce feature grant integrity: a controller belongs to another character'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.character_content_refs AS derived_ref
    JOIN public.character_feature_grants AS grant_row
      ON grant_row.id = derived_ref.feature_grant_id
    WHERE derived_ref.character_id IS DISTINCT FROM grant_row.character_id
      OR derived_ref.content_id IS DISTINCT FROM grant_row.feature_content_id
      OR derived_ref.content_version IS DISTINCT FROM grant_row.feature_version
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce feature grant integrity: a derived ref does not match its grant'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

-- PostgreSQL requires referenced column sets to be unique before they can be
-- the target of a composite foreign key. Including the primary-key UUID keeps
-- these keys unique while making all related identity columns structural.
ALTER TABLE public.character_content_refs
  ADD CONSTRAINT character_content_refs_id_character_id_key
    UNIQUE (id, character_id);

ALTER TABLE public.character_feature_grants
  ADD CONSTRAINT character_feature_grants_identity_key
    UNIQUE (id, character_id, feature_content_id, feature_version);

ALTER TABLE public.character_feature_grants
  DROP CONSTRAINT character_feature_grants_controller_ref_id_fkey,
  ADD CONSTRAINT character_feature_grants_controller_ref_id_fkey
    FOREIGN KEY (controller_ref_id, character_id)
    REFERENCES public.character_content_refs(id, character_id)
    ON DELETE CASCADE;

ALTER TABLE public.character_content_refs
  DROP CONSTRAINT character_content_refs_feature_grant_id_fkey,
  ADD CONSTRAINT character_content_refs_feature_grant_id_fkey
    FOREIGN KEY (
      feature_grant_id,
      character_id,
      content_id,
      content_version
    )
    REFERENCES public.character_feature_grants(
      id,
      character_id,
      feature_content_id,
      feature_version
    )
    ON DELETE CASCADE;

-- This is deliberately auth-independent: it answers whether the owner of the
-- target character can use an exact immutable snapshot. Keeping it private and
-- non-executable by API roles lets the definer trigger and migrations use it
-- without exposing a cross-user authorization oracle.
CREATE OR REPLACE FUNCTION private.character_can_access_content_version(
  target_character_id uuid,
  target_content_id uuid,
  target_content_version integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_character_id IS NOT NULL
    AND target_content_id IS NOT NULL
    AND target_content_version IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.characters AS character
      JOIN public.content_versions AS version
        ON version.content_id = target_content_id
       AND version.version = target_content_version
       AND version.system_id_snapshot = character.system_id
      WHERE character.id = target_character_id
        AND (
          version.scope_snapshot = 'platform'
          OR version.owner_id_snapshot = character.user_id
          OR (
            version.scope_snapshot = 'shared'
            AND character.campaign_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.content_shares AS share
              WHERE share.content_id = version.content_id
                AND share.campaign_id = character.campaign_id
            )
            AND EXISTS (
              SELECT 1
              FROM public.campaign_members AS member
              WHERE member.campaign_id = character.campaign_id
                AND member.user_id = character.user_id
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.character_can_access_content_version(
  uuid,
  uuid,
  integer
) FROM PUBLIC, anon, authenticated;

-- Refuse to carry forward any unsafe rows created before this guard existed.
-- The migration remains atomic, so a failure leaves the prior schema untouched
-- and identifies data that must be repaired before release.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.character_feature_grants AS grant_row
    WHERE private.character_can_access_content_version(
      grant_row.character_id,
      grant_row.feature_content_id,
      grant_row.feature_version
    ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce feature grant integrity: an existing feature dependency is inaccessible to its character'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.materialize_feature_grants_for_ref(
  target_ref_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  controller record;
  level_entry jsonb;
  dependency_slug text;
  dependency_level integer;
  resolved_feature record;
BEGIN
  SELECT
    ref.id AS ref_id,
    ref.character_id,
    version.content_id,
    version.version,
    version.content_type_snapshot,
    version.slug_snapshot,
    version.system_id_snapshot,
    version.source_snapshot,
    version.owner_id_snapshot,
    version.data_snapshot,
    version.created_at
  INTO controller
  FROM public.character_content_refs AS ref
  JOIN public.content_versions AS version
    ON version.content_id = ref.content_id
   AND version.version = ref.content_version
  WHERE ref.id = target_ref_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.character_feature_grants
  WHERE controller_ref_id = target_ref_id;

  IF controller.content_type_snapshot NOT IN ('class', 'subclass') THEN
    RETURN;
  END IF;

  IF jsonb_typeof(controller.data_snapshot->'levels') <> 'array' THEN
    RAISE EXCEPTION 'Pinned % % has no valid feature level manifest',
      controller.content_type_snapshot,
      controller.slug_snapshot
      USING ERRCODE = '22023';
  END IF;

  FOR level_entry IN
    SELECT value
    FROM jsonb_array_elements(controller.data_snapshot->'levels')
  LOOP
    IF jsonb_typeof(level_entry->'level') <> 'number'
      OR jsonb_typeof(level_entry->'features') <> 'array'
    THEN
      RAISE EXCEPTION 'Pinned % % has a malformed feature level manifest',
        controller.content_type_snapshot,
        controller.slug_snapshot
        USING ERRCODE = '22023';
    END IF;

    dependency_level := (level_entry->>'level')::integer;
    IF dependency_level < 1 OR dependency_level > 20 THEN
      RAISE EXCEPTION 'Pinned % % has an invalid feature unlock level',
        controller.content_type_snapshot,
        controller.slug_snapshot
        USING ERRCODE = '22023';
    END IF;

    FOR dependency_slug IN
      SELECT jsonb_array_elements_text(level_entry->'features')
    LOOP
      IF btrim(dependency_slug) = '' THEN
        RAISE EXCEPTION 'Pinned % % contains an empty feature slug',
          controller.content_type_snapshot,
          controller.slug_snapshot
          USING ERRCODE = '22023';
      END IF;

      SELECT
        candidate.content_id,
        candidate.version
      INTO resolved_feature
      FROM public.content_versions AS candidate
      WHERE candidate.system_id_snapshot = controller.system_id_snapshot
        AND candidate.content_type_snapshot = 'feature'
        AND candidate.slug_snapshot = dependency_slug
        AND candidate.created_at <= controller.created_at
        AND (
          (
            controller.source_snapshot = 'srd'
            AND candidate.scope_snapshot = 'platform'
          )
          OR (
            controller.source_snapshot = 'homebrew'
            AND (
              candidate.owner_id_snapshot = controller.owner_id_snapshot
              OR candidate.scope_snapshot = 'platform'
            )
          )
        )
        AND private.character_can_access_content_version(
          controller.character_id,
          candidate.content_id,
          candidate.version
        )
      ORDER BY
        (
          candidate.owner_id_snapshot IS NOT DISTINCT FROM
          controller.owner_id_snapshot
        ) DESC,
        candidate.created_at DESC,
        candidate.version DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Feature % cannot be resolved for pinned % % v%',
          dependency_slug,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          controller.version
          USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.character_feature_grants (
        character_id,
        controller_ref_id,
        controller_type,
        controller_slug,
        feature_slug,
        feature_content_id,
        feature_version,
        unlock_level
      ) VALUES (
        controller.character_id,
        controller.ref_id,
        controller.content_type_snapshot,
        controller.slug_snapshot,
        dependency_slug,
        resolved_feature.content_id,
        resolved_feature.version,
        dependency_level
      )
      ON CONFLICT (controller_ref_id, feature_slug)
      DO UPDATE SET
        feature_content_id = EXCLUDED.feature_content_id,
        feature_version = EXCLUDED.feature_version,
        unlock_level = LEAST(
          public.character_feature_grants.unlock_level,
          EXCLUDED.unlock_level
        );
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.materialize_feature_grants_for_ref(uuid)
  FROM PUBLIC, anon, authenticated;
