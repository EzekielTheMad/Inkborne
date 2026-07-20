-- Character narrative depth: ordered life events plus relationship entries.
-- The existing zero-row npcs table already models character relationships, so
-- harden and reuse it instead of creating a competing concept.

CREATE OR REPLACE FUNCTION private.can_view_character_story_entry(
  target_character_id uuid,
  entry_visibility text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.characters AS character
      LEFT JOIN public.campaigns AS campaign ON campaign.id = character.campaign_id
      WHERE character.id = target_character_id
        AND (
          character.user_id = (SELECT auth.uid())
          OR campaign.owner_id = (SELECT auth.uid())
          OR (
            entry_visibility = 'campaign'
            AND character.campaign_id IS NOT NULL
            AND private.is_campaign_member(character.campaign_id)
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.can_view_character_story_entry(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_view_character_story_entry(uuid, text) TO authenticated;

CREATE TABLE public.character_timeline_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  date_label text CHECK (date_label IS NULL OR char_length(date_label) <= 80),
  description jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  visibility text NOT NULL DEFAULT 'campaign'
    CHECK (visibility IN ('dm_only', 'campaign')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_timeline_description_document CHECK (
    jsonb_typeof(description) = 'object'
    AND description->>'type' = 'doc'
    AND jsonb_typeof(description->'content') = 'array'
  )
);

CREATE INDEX idx_character_timeline_character_order
  ON public.character_timeline_events(character_id, sort_order, created_at);
CREATE INDEX idx_character_timeline_created_by
  ON public.character_timeline_events(created_by);

ALTER TABLE public.character_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized viewers can read character timeline events"
  ON public.character_timeline_events FOR SELECT
  TO authenticated
  USING (private.can_view_character_story_entry(character_id, visibility));

CREATE POLICY "Character owners can create timeline events"
  ON public.character_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_character_owner(character_id)
  );

CREATE POLICY "Character owners can update timeline events"
  ON public.character_timeline_events FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_character_owner(character_id)
  );

CREATE POLICY "Character owners can delete timeline events"
  ON public.character_timeline_events FOR DELETE
  TO authenticated
  USING (private.is_character_owner(character_id));

REVOKE ALL ON public.character_timeline_events FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_timeline_events TO authenticated;

-- Normalize relationship descriptions before enforcing the same document
-- contract used by every other rich-text surface.
UPDATE public.npcs
SET description = '{"type":"doc","content":[]}'::jsonb
WHERE jsonb_typeof(description) <> 'object'
   OR description->>'type' <> 'doc'
   OR jsonb_typeof(description->'content') <> 'array';

ALTER TABLE public.npcs
  ALTER COLUMN description SET DEFAULT '{"type":"doc","content":[]}'::jsonb;

ALTER TABLE public.npcs
  ADD CONSTRAINT npcs_description_document CHECK (
    jsonb_typeof(description) = 'object'
    AND description->>'type' = 'doc'
    AND jsonb_typeof(description->'content') = 'array'
  );

DROP POLICY IF EXISTS "Creator can view own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "Campaign DM can view dm_only and campaign NPCs" ON public.npcs;
DROP POLICY IF EXISTS "Campaign members can view campaign NPCs" ON public.npcs;
DROP POLICY IF EXISTS "Creator can insert NPCs" ON public.npcs;
DROP POLICY IF EXISTS "Creator can update own NPCs" ON public.npcs;
DROP POLICY IF EXISTS "Creator can delete own NPCs" ON public.npcs;

CREATE POLICY "Authorized viewers can read character relationships"
  ON public.npcs FOR SELECT
  TO authenticated
  USING (private.can_view_character_story_entry(character_id, visibility));

CREATE POLICY "Character owners can create relationships"
  ON public.npcs FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_character_owner(character_id)
  );

CREATE POLICY "Character owners can update relationships"
  ON public.npcs FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_character_owner(character_id)
  );

CREATE POLICY "Character owners can delete relationships"
  ON public.npcs FOR DELETE
  TO authenticated
  USING (private.is_character_owner(character_id));

REVOKE ALL ON public.npcs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npcs TO authenticated;

-- Preserve the atomic character-copy contract. Story entries copy as
-- owner/DM-only in the target campaign so a one-shot copy never publishes
-- narrative details to a new player group without an explicit choice.
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
    character_id, content_id, name, content_type, quantity, equipped, attuned,
    sort_order, notes, custom_data
  ) SELECT
    new_character_id, item.content_id, item.name, item.content_type, item.quantity,
    item.equipped, item.attuned, item.sort_order, item.notes, item.custom_data
  FROM public.character_inventory AS item
  WHERE item.character_id = source_character_id;

  INSERT INTO public.character_spells (
    character_id, content_id, name, class_slug, is_known, is_prepared,
    always_prepared, in_spellbook, source, custom_data
  ) SELECT
    new_character_id, spell.content_id, spell.name, spell.class_slug, spell.is_known,
    spell.is_prepared, spell.always_prepared, spell.in_spellbook, spell.source,
    spell.custom_data
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

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text) TO authenticated;
