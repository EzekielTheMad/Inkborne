-- Enforce exact-version authorization at the database boundary. Character
-- visibility is intentionally broader than content ownership, so campaign
-- moves, derived feature projections, and snapshot reads each need their own
-- fail-closed authorization rule.

-- ---------------------------------------------------------------------------
-- A viewer of someone else's character may only use the linked-version
-- fallback for snapshots authored by that character's owner. Platform,
-- snapshot-owner, and currently-shared catalog visibility remain unchanged.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Visible catalog or referenced versions can be read"
  ON public.content_versions;

CREATE POLICY "Visible catalog or referenced versions can be read"
  ON public.content_versions FOR SELECT
  TO authenticated
  USING (
    scope_snapshot = 'platform'
    OR owner_id_snapshot = (SELECT auth.uid())
    OR (
      scope_snapshot = 'shared'
      AND EXISTS (
        SELECT 1
        FROM public.content_shares AS share
        WHERE share.content_id = content_versions.content_id
          AND private.can_access_campaign(share.campaign_id)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.character_content_refs AS ref
      JOIN public.characters AS character
        ON character.id = ref.character_id
      WHERE ref.content_id = content_versions.content_id
        AND ref.content_version = content_versions.version
        AND private.can_view_character(ref.character_id)
        AND (
          character.user_id = (SELECT auth.uid())
          OR content_versions.owner_id_snapshot = character.user_id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.character_inventory AS item
      JOIN public.characters AS character
        ON character.id = item.character_id
      WHERE item.content_id = content_versions.content_id
        AND item.content_version = content_versions.version
        AND private.can_view_character(item.character_id)
        AND (
          character.user_id = (SELECT auth.uid())
          OR content_versions.owner_id_snapshot = character.user_id
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.character_spells AS spell
      JOIN public.characters AS character
        ON character.id = spell.character_id
      WHERE spell.content_id = content_versions.content_id
        AND spell.content_version = content_versions.version
        AND private.can_view_character(spell.character_id)
        AND (
          character.user_id = (SELECT auth.uid())
          OR content_versions.owner_id_snapshot = character.user_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Campaign/system changes can invalidate pins that were legal when selected.
-- Validate both physical projections and dormant grant manifests against the
-- post-update character row. Same-system campaign detachment remains legal.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.validate_character_content_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.system_id IS NOT DISTINCT FROM OLD.system_id
    AND (
      NEW.campaign_id IS NULL
      OR NEW.campaign_id IS NOT DISTINCT FROM OLD.campaign_id
    )
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT ref.content_id, ref.content_version
      FROM public.character_content_refs AS ref
      WHERE ref.character_id = NEW.id

      UNION ALL

      SELECT item.content_id, item.content_version
      FROM public.character_inventory AS item
      WHERE item.character_id = NEW.id
        AND item.content_id IS NOT NULL

      UNION ALL

      SELECT spell.content_id, spell.content_version
      FROM public.character_spells AS spell
      WHERE spell.character_id = NEW.id
        AND spell.content_id IS NOT NULL

      UNION ALL

      SELECT grant_row.feature_content_id, grant_row.feature_version
      FROM public.character_feature_grants AS grant_row
      WHERE grant_row.character_id = NEW.id

      UNION ALL

      SELECT grant_row.spell_content_id, grant_row.spell_version
      FROM public.character_spell_grants AS grant_row
      WHERE grant_row.character_id = NEW.id
    ) AS pinned(content_id, content_version)
    WHERE private.character_can_access_content_version(
      NEW.id,
      pinned.content_id,
      pinned.content_version
    ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION
      'Character contains content unavailable to the destination campaign or system'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_character_content_boundaries()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_character_content_boundaries
  ON public.characters;
CREATE TRIGGER validate_character_content_boundaries
AFTER UPDATE OF campaign_id, system_id
ON public.characters
FOR EACH ROW
EXECUTE FUNCTION private.validate_character_content_boundaries();

-- ---------------------------------------------------------------------------
-- Feature activation is derived exclusively from persisted choices and the
-- pinned controller snapshot. Subclass activation binds both the subclass and
-- its immutable parent class, preventing same-slug cross-class ambiguity.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_character_feature_grant_active(
  target_grant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.character_feature_grants AS grant_row
    JOIN public.character_content_refs AS controller_ref
      ON controller_ref.id = grant_row.controller_ref_id
     AND controller_ref.character_id = grant_row.character_id
    JOIN public.content_versions AS controller
      ON controller.content_id = controller_ref.content_id
     AND controller.version = controller_ref.content_version
     AND controller.content_type_snapshot = grant_row.controller_type
     AND controller.slug_snapshot = grant_row.controller_slug
    JOIN public.characters AS character
      ON character.id = grant_row.character_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(character.choices->'classes') = 'array'
          THEN character.choices->'classes'
        ELSE '[]'::jsonb
      END
    ) AS class_choice(value)
    WHERE grant_row.id = target_grant_id
      AND COALESCE(class_choice.value->>'level', '') ~ '^[0-9]+$'
      AND (class_choice.value->>'level')::integer >= grant_row.unlock_level
      AND (
        (
          controller.content_type_snapshot = 'class'
          AND class_choice.value->>'slug' = controller.slug_snapshot
        )
        OR (
          controller.content_type_snapshot = 'subclass'
          AND class_choice.value->>'slug' =
            controller.data_snapshot->>'parent_class'
          AND class_choice.value->>'subclass' = controller.slug_snapshot
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_character_feature_grant_active(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_character_feature_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  grant_row public.character_feature_grants%ROWTYPE;
  expected_choice_source text;
  expected_context jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.feature_grant_id IS NOT NULL
    AND NEW.feature_grant_id IS DISTINCT FROM OLD.feature_grant_id
  THEN
    RAISE EXCEPTION 'Derived feature grant identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.feature_grant_id IS NULL THEN
    IF NEW.choice_source LIKE 'auto:feature-grant:%' THEN
      RAISE EXCEPTION 'Automatic feature source requires a feature grant'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Serialize direct Data API writes with character level/subclass changes.
  -- The companion choices trigger below removes projections that become
  -- inactive after a change that was waiting on this row lock.
  PERFORM 1
  FROM public.characters AS character
  WHERE character.id = NEW.character_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature grant character is unavailable'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO grant_row
  FROM public.character_feature_grants AS candidate
  WHERE candidate.id = NEW.feature_grant_id
    AND candidate.character_id = NEW.character_id;

  IF NOT FOUND
    OR private.is_character_feature_grant_active(NEW.feature_grant_id) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Feature grant is unavailable or inactive'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.content_id IS DISTINCT FROM grant_row.feature_content_id
    OR NEW.content_version IS DISTINCT FROM grant_row.feature_version
  THEN
    RAISE EXCEPTION 'Derived feature ref does not match its exact pinned grant'
      USING ERRCODE = '23514';
  END IF;

  expected_choice_source := 'auto:feature-grant:' || grant_row.id::text;
  expected_context := jsonb_build_object(
    'source', 'class_feature',
    'controller_type', grant_row.controller_type,
    'controller_slug', grant_row.controller_slug,
    'feature_slug', grant_row.feature_slug,
    'feature_level', grant_row.unlock_level
  );

  IF NEW.choice_source IS DISTINCT FROM expected_choice_source
    OR NEW.context IS DISTINCT FROM expected_context
  THEN
    RAISE EXCEPTION 'Derived feature ref metadata does not match its grant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_character_feature_grant()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prune_inactive_feature_refs_after_choices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = NEW.id
    AND ref.feature_grant_id IS NOT NULL
    AND private.is_character_feature_grant_active(ref.feature_grant_id)
      IS NOT TRUE;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prune_inactive_feature_refs_after_choices()
  FROM PUBLIC, anon, authenticated;

-- Remove inactive or reserved-prefix legacy projections, then normalize every
-- surviving active projection before the strict trigger is installed.
DELETE FROM public.character_content_refs AS ref
WHERE ref.feature_grant_id IS NOT NULL
  AND private.is_character_feature_grant_active(ref.feature_grant_id) IS NOT TRUE;

DELETE FROM public.character_content_refs AS ref
WHERE ref.feature_grant_id IS NULL
  AND ref.choice_source LIKE 'auto:feature-grant:%';

UPDATE public.character_content_refs AS ref
SET
  choice_source = 'auto:feature-grant:' || grant_row.id::text,
  context = jsonb_build_object(
    'source', 'class_feature',
    'controller_type', grant_row.controller_type,
    'controller_slug', grant_row.controller_slug,
    'feature_slug', grant_row.feature_slug,
    'feature_level', grant_row.unlock_level
  )
FROM public.character_feature_grants AS grant_row
WHERE ref.feature_grant_id = grant_row.id;

DROP TRIGGER IF EXISTS enforce_character_feature_grant
  ON public.character_content_refs;
CREATE TRIGGER enforce_character_feature_grant
BEFORE INSERT OR UPDATE OF
  character_id, content_id, content_version, context, choice_source,
  feature_grant_id
ON public.character_content_refs
FOR EACH ROW
EXECUTE FUNCTION private.enforce_character_feature_grant();

DROP TRIGGER IF EXISTS prune_inactive_feature_refs_after_choices
  ON public.characters;
CREATE TRIGGER prune_inactive_feature_refs_after_choices
AFTER UPDATE OF choices
ON public.characters
FOR EACH ROW
EXECUTE FUNCTION private.prune_inactive_feature_refs_after_choices();

-- One locked, owner-only transaction replaces the former client-side
-- read/compare/upsert/delete sequence. Dormant grants are never deleted, so a
-- later level-up reactivates the same exact feature version.
CREATE OR REPLACE FUNCTION public.sync_character_feature_refs(
  target_character_id uuid
)
RETURNS TABLE(inserted integer, deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  inserted_count integer := 0;
  deleted_count integer := 0;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = target_character_id
    AND ref.feature_grant_id IS NOT NULL
    AND private.is_character_feature_grant_active(ref.feature_grant_id)
      IS NOT TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  INSERT INTO public.character_content_refs (
    character_id,
    content_id,
    content_version,
    context,
    choice_source,
    feature_grant_id
  )
  SELECT
    grant_row.character_id,
    grant_row.feature_content_id,
    grant_row.feature_version,
    jsonb_build_object(
      'source', 'class_feature',
      'controller_type', grant_row.controller_type,
      'controller_slug', grant_row.controller_slug,
      'feature_slug', grant_row.feature_slug,
      'feature_level', grant_row.unlock_level
    ),
    'auto:feature-grant:' || grant_row.id::text,
    grant_row.id
  FROM public.character_feature_grants AS grant_row
  WHERE grant_row.character_id = target_character_id
    AND private.is_character_feature_grant_active(grant_row.id)
    AND private.character_can_access_content_version(
      target_character_id,
      grant_row.feature_content_id,
      grant_row.feature_version
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.character_content_refs AS existing
      WHERE existing.feature_grant_id = grant_row.id
    )
  ON CONFLICT (feature_grant_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN QUERY SELECT inserted_count, deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_character_feature_refs(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_character_feature_refs(uuid)
  TO authenticated;
