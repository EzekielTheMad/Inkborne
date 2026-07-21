-- Follow-up hardening for exact-version visibility, copy authorization, and
-- query plans introduced by content-version pinning.

CREATE INDEX IF NOT EXISTS idx_character_content_refs_content_version
  ON public.character_content_refs(content_id, content_version);

CREATE INDEX IF NOT EXISTS idx_content_definitions_owner_id
  ON public.content_definitions(owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_shares_campaign_id
  ON public.content_shares(campaign_id);

CREATE INDEX IF NOT EXISTS idx_content_shares_shared_by
  ON public.content_shares(shared_by);

CREATE INDEX IF NOT EXISTS idx_content_type_shares_campaign_id
  ON public.content_type_shares(campaign_id);

CREATE INDEX IF NOT EXISTS idx_content_type_shares_shared_by
  ON public.content_type_shares(shared_by);

CREATE INDEX IF NOT EXISTS idx_custom_content_types_owner_id
  ON public.custom_content_types(owner_id);

-- A deterministic source may materialize a canonical character ref only once.
-- NULL sources remain intentionally unconstrained for manually selected refs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_character_content_refs_source_unique
  ON public.character_content_refs(character_id, choice_source);

-- Freeze the complete feature manifest when a class or subclass ref is
-- selected. Sheet rendering only activates/deactivates these grants; it never
-- discovers new feature identities from the mutable catalog.
CREATE TABLE public.character_feature_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL
    REFERENCES public.characters(id) ON DELETE CASCADE,
  controller_ref_id uuid NOT NULL
    REFERENCES public.character_content_refs(id) ON DELETE CASCADE,
  controller_type text NOT NULL
    CHECK (controller_type IN ('class', 'subclass')),
  controller_slug text NOT NULL,
  feature_slug text NOT NULL,
  feature_content_id uuid NOT NULL,
  feature_version integer NOT NULL CHECK (feature_version >= 1),
  unlock_level integer NOT NULL CHECK (unlock_level BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_feature_grants_feature_version_fkey
    FOREIGN KEY (feature_content_id, feature_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE RESTRICT,
  CONSTRAINT character_feature_grants_controller_feature_unique
    UNIQUE (controller_ref_id, feature_slug)
);

CREATE INDEX idx_character_feature_grants_character_id
  ON public.character_feature_grants(character_id);

CREATE INDEX idx_character_feature_grants_feature_version
  ON public.character_feature_grants(feature_content_id, feature_version);

ALTER TABLE public.character_content_refs
  ADD COLUMN feature_grant_id uuid,
  ADD CONSTRAINT character_content_refs_feature_grant_id_fkey
    FOREIGN KEY (feature_grant_id)
    REFERENCES public.character_feature_grants(id)
    ON DELETE CASCADE,
  ADD CONSTRAINT character_content_refs_feature_grant_id_key
    UNIQUE (feature_grant_id);

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

CREATE OR REPLACE FUNCTION private.materialize_feature_grants_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.materialize_feature_grants_for_ref(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.materialize_feature_grants_for_ref(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.materialize_feature_grants_trigger()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER materialize_feature_grants
AFTER INSERT OR UPDATE OF content_id, content_version
ON public.character_content_refs
FOR EACH ROW
EXECUTE FUNCTION private.materialize_feature_grants_trigger();

-- One-time baseline for characters that selected a controller before manifests
-- existed. This uses only their already-pinned controller snapshots.
SELECT private.materialize_feature_grants_for_ref(ref.id)
FROM public.character_content_refs AS ref
JOIN public.content_versions AS version
  ON version.content_id = ref.content_id
 AND version.version = ref.content_version
WHERE version.content_type_snapshot IN ('class', 'subclass');

ALTER TABLE public.character_feature_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view character feature grants"
  ON public.character_feature_grants FOR SELECT
  TO authenticated
  USING (private.can_view_character(character_id));

REVOKE ALL ON public.character_feature_grants
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.character_feature_grants
  TO authenticated;

DROP POLICY IF EXISTS "Platform content visible to all"
  ON public.content_definitions;
DROP POLICY IF EXISTS "Personal content visible to owner"
  ON public.content_definitions;
DROP POLICY IF EXISTS "Shared content visible to owner and campaign members"
  ON public.content_definitions;

CREATE POLICY "Catalog content visible to authorized users"
  ON public.content_definitions FOR SELECT
  TO authenticated
  USING (
    scope = 'platform'
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

DROP POLICY IF EXISTS "Owner can delete content"
  ON public.content_definitions;

CREATE POLICY "Owners can delete homebrew content"
  ON public.content_definitions FOR DELETE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND source = 'homebrew'
  );

-- Authorization is evaluated from the immutable version envelope. A later
-- personal/shared scope change must not retroactively alter an older version.
CREATE OR REPLACE FUNCTION private.can_use_content_version(
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
  SELECT (SELECT auth.uid()) IS NOT NULL
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
        AND character.user_id = (SELECT auth.uid())
        AND (
          version.scope_snapshot = 'platform'
          OR version.owner_id_snapshot = (SELECT auth.uid())
          OR (
            version.scope_snapshot = 'shared'
            AND character.campaign_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.content_shares AS share
              WHERE share.content_id = version.content_id
                AND share.campaign_id = character.campaign_id
                AND private.can_access_campaign(share.campaign_id)
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.can_use_content_version(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_use_content_version(uuid, uuid, integer)
  TO authenticated;

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
      WHERE ref.content_id = content_versions.content_id
        AND ref.content_version = content_versions.version
        AND private.can_view_character(ref.character_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.character_inventory AS item
      WHERE item.content_id = content_versions.content_id
        AND item.content_version = content_versions.version
        AND private.can_view_character(item.character_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.character_spells AS spell
      WHERE spell.content_id = content_versions.content_id
        AND spell.content_version = content_versions.version
        AND private.can_view_character(spell.character_id)
    )
  );

-- Character copies are atomic, but SECURITY DEFINER bypasses the destination
-- link policies. Validate every canonical link against the newly created
-- character before copying any dependent rows.
CREATE OR REPLACE FUNCTION public.copy_character(
  source_character_id uuid,
  target_campaign_id uuid DEFAULT NULL,
  copied_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  source_character public.characters%ROWTYPE;
  new_character_id uuid;
  resolved_name text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT character.* INTO source_character
  FROM public.characters AS character
  WHERE character.id = source_character_id
    AND character.user_id = actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller' USING ERRCODE = '42501';
  END IF;

  resolved_name := btrim(COALESCE(NULLIF(copied_name, ''), source_character.name || ' (Copy)'));
  IF char_length(resolved_name) < 1 OR char_length(resolved_name) > 100 THEN
    RAISE EXCEPTION 'Character name must be between 1 and 100 characters' USING ERRCODE = '22023';
  END IF;

  IF target_campaign_id IS NOT NULL
    AND NOT private.can_assign_character_to_campaign(target_campaign_id, source_character.system_id)
  THEN
    RAISE EXCEPTION 'Campaign is unavailable or uses a different game system' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.characters (
    user_id, system_id, campaign_id, name, visibility, archived, level,
    base_stats, choices, state, narrative, narrative_rich, primary_color
  ) VALUES (
    actor_id, source_character.system_id, target_campaign_id, resolved_name,
    'private', false, source_character.level, source_character.base_stats,
    source_character.choices, source_character.state, source_character.narrative,
    source_character.narrative_rich, source_character.primary_color
  ) RETURNING id INTO new_character_id;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT ref.content_id, ref.content_version
      FROM public.character_content_refs AS ref
      WHERE ref.character_id = source_character_id
        AND ref.feature_grant_id IS NULL

      UNION ALL

      SELECT item.content_id, item.content_version
      FROM public.character_inventory AS item
      WHERE item.character_id = source_character_id
        AND item.content_id IS NOT NULL

      UNION ALL

      SELECT spell.content_id, spell.content_version
      FROM public.character_spells AS spell
      WHERE spell.character_id = source_character_id
        AND spell.content_id IS NOT NULL
    ) AS linked
    WHERE private.can_use_content_version(
      new_character_id,
      linked.content_id,
      linked.content_version
    ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Character contains content unavailable to the target campaign'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.character_dm_notes (character_id, content)
  SELECT new_character_id, note.content
  FROM public.character_dm_notes AS note
  WHERE note.character_id = source_character_id;

  INSERT INTO public.character_timeline_events (
    character_id, created_by, title, date_label, description, visibility,
    sort_order
  ) SELECT
    new_character_id, actor_id, event.title, event.date_label,
    event.description, 'dm_only', event.sort_order
  FROM public.character_timeline_events AS event
  WHERE event.character_id = source_character_id
    AND event.created_by = actor_id;

  INSERT INTO public.character_content_refs (
    character_id, content_id, content_version, context, choice_source
  ) SELECT
    new_character_id, ref.content_id, ref.content_version, ref.context, ref.choice_source
  FROM public.character_content_refs AS ref
  WHERE ref.character_id = source_character_id
    AND ref.feature_grant_id IS NULL;

  INSERT INTO public.character_inventory (
    character_id, content_id, content_version, name, content_type, quantity,
    equipped, attuned, sort_order, notes, custom_data
  ) SELECT
    new_character_id, item.content_id, item.content_version, item.name,
    item.content_type, item.quantity, item.equipped, item.attuned,
    item.sort_order, item.notes, item.custom_data
  FROM public.character_inventory AS item
  WHERE item.character_id = source_character_id;

  INSERT INTO public.character_spells (
    character_id, content_id, content_version, name, class_slug, is_known,
    is_prepared, always_prepared, in_spellbook, source, custom_data
  ) SELECT
    new_character_id, spell.content_id, spell.content_version, spell.name,
    spell.class_slug, spell.is_known, spell.is_prepared, spell.always_prepared,
    spell.in_spellbook, spell.source, spell.custom_data
  FROM public.character_spells AS spell
  WHERE spell.character_id = source_character_id;

  INSERT INTO public.npcs (
    character_id, created_by, name, description, relationship, visibility,
    portrait_url, metadata
  ) SELECT
    new_character_id, actor_id, npc.name, npc.description, npc.relationship,
    'dm_only', npc.portrait_url, npc.metadata
  FROM public.npcs AS npc
  WHERE npc.character_id = source_character_id
    AND npc.created_by = actor_id;

  RETURN new_character_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text)
  TO authenticated;
