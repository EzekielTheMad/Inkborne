-- Content definitions are mutable authoring records. Character links point at
-- immutable, self-contained versions so an author's later edit never changes
-- an existing character without an explicit upgrade.

-- ---------------------------------------------------------------------------
-- Self-contained version snapshots and ownership invariants.
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_versions
  ADD COLUMN name_snapshot text,
  ADD COLUMN slug_snapshot text,
  ADD COLUMN content_type_snapshot text,
  ADD COLUMN system_id_snapshot uuid,
  ADD COLUMN source_snapshot text,
  ADD COLUMN scope_snapshot text,
  ADD COLUMN owner_id_snapshot uuid;

-- Historical rows predate the envelope columns. Identity fields were already
-- stored on the parent definition, so they are the only available source for
-- a safe one-time backfill.
UPDATE public.content_versions AS version
SET
  name_snapshot = definition.name,
  slug_snapshot = definition.slug,
  content_type_snapshot = definition.content_type,
  system_id_snapshot = definition.system_id,
  source_snapshot = definition.source,
  scope_snapshot = definition.scope,
  owner_id_snapshot = definition.owner_id
FROM public.content_definitions AS definition
WHERE definition.id = version.content_id;

ALTER TABLE public.content_versions
  ALTER COLUMN name_snapshot SET NOT NULL,
  ALTER COLUMN slug_snapshot SET NOT NULL,
  ALTER COLUMN content_type_snapshot SET NOT NULL,
  ALTER COLUMN system_id_snapshot SET NOT NULL,
  ALTER COLUMN source_snapshot SET NOT NULL,
  ALTER COLUMN scope_snapshot SET NOT NULL;

ALTER TABLE public.content_definitions
  DROP CONSTRAINT IF EXISTS content_definitions_system_id_content_type_slug_owner_id_key,
  DROP CONSTRAINT IF EXISTS content_definitions_owner_id_fkey,
  ADD CONSTRAINT content_definitions_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT content_definitions_identity_unique
    UNIQUE NULLS NOT DISTINCT (system_id, content_type, slug, owner_id),
  ADD CONSTRAINT content_definitions_version_positive CHECK (version >= 1),
  ADD CONSTRAINT content_definitions_official_or_homebrew CHECK (
    (
      source = 'srd'
      AND scope = 'platform'
      AND owner_id IS NULL
    )
    OR
    (
      source = 'homebrew'
      AND scope IN ('personal', 'shared')
      AND owner_id IS NOT NULL
    )
  );

ALTER TABLE public.content_versions
  ADD CONSTRAINT content_versions_version_positive CHECK (version >= 1),
  ADD CONSTRAINT content_versions_snapshot_official_or_homebrew CHECK (
    (
      source_snapshot = 'srd'
      AND scope_snapshot = 'platform'
      AND owner_id_snapshot IS NULL
    )
    OR
    (
      source_snapshot = 'homebrew'
      AND scope_snapshot IN ('personal', 'shared')
      AND owner_id_snapshot IS NOT NULL
    )
  );

-- The legacy schema advertised version pinning but never populated version 1.
-- Seed every current definition before exact-version foreign keys are added.
INSERT INTO public.content_versions (
  content_id,
  version,
  name_snapshot,
  slug_snapshot,
  content_type_snapshot,
  system_id_snapshot,
  source_snapshot,
  scope_snapshot,
  owner_id_snapshot,
  data_snapshot,
  effects_snapshot,
  changelog
)
SELECT
  definition.id,
  1,
  definition.name,
  definition.slug,
  definition.content_type,
  definition.system_id,
  definition.source,
  definition.scope,
  definition.owner_id,
  definition.data,
  definition.effects,
  'Initial version'
FROM public.content_definitions AS definition
ON CONFLICT (content_id, version) DO NOTHING;

-- If an installation already advanced the legacy counter without creating a
-- matching snapshot, also make its current counter resolvable. Version 1 still
-- exists for every definition as required by the legacy character backfill.
INSERT INTO public.content_versions (
  content_id,
  version,
  name_snapshot,
  slug_snapshot,
  content_type_snapshot,
  system_id_snapshot,
  source_snapshot,
  scope_snapshot,
  owner_id_snapshot,
  data_snapshot,
  effects_snapshot,
  changelog
)
SELECT
  definition.id,
  definition.version,
  definition.name,
  definition.slug,
  definition.content_type,
  definition.system_id,
  definition.source,
  definition.scope,
  definition.owner_id,
  definition.data,
  definition.effects,
  'Current version at version-pinning migration'
FROM public.content_definitions AS definition
WHERE definition.version <> 1
ON CONFLICT (content_id, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Definition writes create immutable snapshots. Identity cannot be changed in
-- place; authors create a distinct definition when identity changes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.prepare_content_definition_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    RETURN NEW;
  END IF;

  IF ROW(
    NEW.id,
    NEW.system_id,
    NEW.content_type,
    NEW.slug,
    NEW.source,
    NEW.owner_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.system_id,
    OLD.content_type,
    OLD.slug,
    OLD.source,
    OLD.owner_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Content identity fields are immutable'
      USING ERRCODE = '22023';
  END IF;

  IF ROW(NEW.name, NEW.data, NEW.effects, NEW.scope)
    IS DISTINCT FROM ROW(OLD.name, OLD.data, OLD.effects, OLD.scope)
  THEN
    NEW.version := OLD.version + 1;
  ELSE
    -- The counter is database-managed even when a client submits it directly.
    NEW.version := OLD.version;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.snapshot_content_definition_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version IS NOT DISTINCT FROM OLD.version THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.content_versions (
    content_id,
    version,
    name_snapshot,
    slug_snapshot,
    content_type_snapshot,
    system_id_snapshot,
    source_snapshot,
    scope_snapshot,
    owner_id_snapshot,
    data_snapshot,
    effects_snapshot
  ) VALUES (
    NEW.id,
    NEW.version,
    NEW.name,
    NEW.slug,
    NEW.content_type,
    NEW.system_id,
    NEW.source,
    NEW.scope,
    NEW.owner_id,
    NEW.data,
    NEW.effects
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.reject_content_version_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Content version snapshots are immutable'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_content_definition_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.snapshot_content_definition_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_content_version_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prepare_content_definition_version
  ON public.content_definitions;
CREATE TRIGGER prepare_content_definition_version
BEFORE INSERT OR UPDATE ON public.content_definitions
FOR EACH ROW
EXECUTE FUNCTION private.prepare_content_definition_version();

DROP TRIGGER IF EXISTS snapshot_content_definition_version
  ON public.content_definitions;
CREATE TRIGGER snapshot_content_definition_version
AFTER INSERT OR UPDATE ON public.content_definitions
FOR EACH ROW
EXECUTE FUNCTION private.snapshot_content_definition_version();

DROP TRIGGER IF EXISTS reject_content_version_update
  ON public.content_versions;
CREATE TRIGGER reject_content_version_update
BEFORE UPDATE ON public.content_versions
FOR EACH ROW
EXECUTE FUNCTION private.reject_content_version_update();

-- ---------------------------------------------------------------------------
-- Every canonical character link pins an exact version.
-- ---------------------------------------------------------------------------

ALTER TABLE public.character_content_refs
  DROP CONSTRAINT IF EXISTS character_content_refs_content_id_fkey,
  ALTER COLUMN content_version DROP DEFAULT,
  ADD CONSTRAINT character_content_refs_content_version_fkey
    FOREIGN KEY (content_id, content_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE RESTRICT;

ALTER TABLE public.character_inventory
  ADD COLUMN content_version integer;

UPDATE public.character_inventory AS item
SET content_version = definition.version
FROM public.content_definitions AS definition
WHERE item.content_id = definition.id;

ALTER TABLE public.character_inventory
  DROP CONSTRAINT IF EXISTS character_inventory_content_id_fkey,
  ADD CONSTRAINT character_inventory_content_pair CHECK (
    (content_id IS NULL) = (content_version IS NULL)
  ),
  ADD CONSTRAINT character_inventory_content_version_fkey
    FOREIGN KEY (content_id, content_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE RESTRICT;

ALTER TABLE public.character_spells
  ADD COLUMN content_version integer;

UPDATE public.character_spells AS spell
SET content_version = definition.version
FROM public.content_definitions AS definition
WHERE spell.content_id = definition.id;

ALTER TABLE public.character_spells
  DROP CONSTRAINT IF EXISTS character_spells_content_id_fkey,
  ADD CONSTRAINT character_spells_content_pair CHECK (
    (content_id IS NULL) = (content_version IS NULL)
  ),
  ADD CONSTRAINT character_spells_content_version_fkey
    FOREIGN KEY (content_id, content_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE RESTRICT;

CREATE INDEX idx_character_inventory_content_version
  ON public.character_inventory(content_id, content_version)
  WHERE content_id IS NOT NULL;

CREATE INDEX idx_character_spells_content_version
  ON public.character_spells(content_id, content_version)
  WHERE content_id IS NOT NULL;

-- This helper is deliberately stricter than character visibility: only the
-- player who owns a character can mutate its content links. A campaign DM can
-- read a player's sheet but never use this helper to edit it.
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
      JOIN public.content_definitions AS definition
        ON definition.id = target_content_id
       AND definition.system_id = character.system_id
      JOIN public.content_versions AS version
        ON version.content_id = definition.id
       AND version.version = target_content_version
      WHERE character.id = target_character_id
        AND character.user_id = (SELECT auth.uid())
        AND (
          definition.scope = 'platform'
          OR definition.owner_id = (SELECT auth.uid())
          OR (
            definition.scope = 'shared'
            AND EXISTS (
              SELECT 1
              FROM public.content_shares AS share
              JOIN public.campaign_members AS member
                ON member.campaign_id = share.campaign_id
              WHERE share.content_id = definition.id
                AND share.campaign_id = character.campaign_id
                AND member.user_id = (SELECT auth.uid())
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.can_use_content_version(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_use_content_version(uuid, uuid, integer)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Catalog and snapshot RLS.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owner can insert content"
  ON public.content_definitions;
DROP POLICY IF EXISTS "Owner can update content"
  ON public.content_definitions;

CREATE POLICY "Owners can insert homebrew content"
  ON public.content_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND source = 'homebrew'
    AND scope IN ('personal', 'shared')
  );

CREATE POLICY "Owners can update homebrew content"
  ON public.content_definitions FOR UPDATE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND source = 'homebrew'
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND source = 'homebrew'
    AND scope IN ('personal', 'shared')
  );

DROP POLICY IF EXISTS "Content versions follow parent visibility"
  ON public.content_versions;

CREATE POLICY "Visible catalog or referenced versions can be read"
  ON public.content_versions FOR SELECT
  TO authenticated
  USING (
    content_id IN (
      SELECT definition.id
      FROM public.content_definitions AS definition
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

-- ---------------------------------------------------------------------------
-- Character-link mutation policies. Read policies from the campaign boundary
-- remain unchanged, preserving owner/DM visibility without granting DM writes.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owner can insert character content refs"
  ON public.character_content_refs;
DROP POLICY IF EXISTS "Owner can update character content refs"
  ON public.character_content_refs;

CREATE POLICY "Owners can insert usable character content refs"
  ON public.character_content_refs FOR INSERT
  TO authenticated
  WITH CHECK (
    private.can_use_content_version(character_id, content_id, content_version)
  );

CREATE POLICY "Owners can update usable character content refs"
  ON public.character_content_refs FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (
    private.can_use_content_version(character_id, content_id, content_version)
  );

DROP POLICY IF EXISTS "Owner can manage inventory"
  ON public.character_inventory;
DROP POLICY IF EXISTS "Owner can insert inventory"
  ON public.character_inventory;
DROP POLICY IF EXISTS "Owner can update inventory"
  ON public.character_inventory;
DROP POLICY IF EXISTS "Owner can delete inventory"
  ON public.character_inventory;

CREATE POLICY "Owners can insert inventory"
  ON public.character_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      content_id IS NULL
      AND content_version IS NULL
      AND private.is_character_owner(character_id)
    )
    OR private.can_use_content_version(character_id, content_id, content_version)
  );

CREATE POLICY "Owners can update inventory"
  ON public.character_inventory FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (
    (
      content_id IS NULL
      AND content_version IS NULL
      AND private.is_character_owner(character_id)
    )
    OR private.can_use_content_version(character_id, content_id, content_version)
  );

CREATE POLICY "Owners can delete inventory"
  ON public.character_inventory FOR DELETE
  TO authenticated
  USING (private.is_character_owner(character_id));

DROP POLICY IF EXISTS "Owner can manage spells"
  ON public.character_spells;
DROP POLICY IF EXISTS "Owner can insert spells"
  ON public.character_spells;
DROP POLICY IF EXISTS "Owner can update spells"
  ON public.character_spells;
DROP POLICY IF EXISTS "Owner can delete spells"
  ON public.character_spells;

CREATE POLICY "Owners can insert spells"
  ON public.character_spells FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      content_id IS NULL
      AND content_version IS NULL
      AND private.is_character_owner(character_id)
    )
    OR private.can_use_content_version(character_id, content_id, content_version)
  );

CREATE POLICY "Owners can update spells"
  ON public.character_spells FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (
    (
      content_id IS NULL
      AND content_version IS NULL
      AND private.is_character_owner(character_id)
    )
    OR private.can_use_content_version(character_id, content_id, content_version)
  );

CREATE POLICY "Owners can delete spells"
  ON public.character_spells FOR DELETE
  TO authenticated
  USING (private.is_character_owner(character_id));

-- Exact table privileges complement RLS. Version history is read-only through
-- the Data API; only the private snapshot trigger creates version rows.
REVOKE ALL ON public.content_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.content_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.character_content_refs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.character_inventory FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.character_spells FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.content_definitions TO authenticated;
GRANT SELECT
  ON public.content_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.character_content_refs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.character_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.character_spells TO authenticated;

-- ---------------------------------------------------------------------------
-- Preserve the latest atomic character-copy behavior while carrying all three
-- exact content-version pins to the copied character.
-- ---------------------------------------------------------------------------

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
  WHERE ref.character_id = source_character_id;

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
