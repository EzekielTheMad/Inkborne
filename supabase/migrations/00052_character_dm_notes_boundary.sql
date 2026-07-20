-- DM notes cannot share a client-readable JSON column with player-visible
-- narrative. Move them to a one-to-one table with an owner/DM-only read policy.

CREATE OR REPLACE FUNCTION private.is_character_owner(target_character_id uuid)
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
      WHERE character.id = target_character_id
        AND character.user_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION private.can_view_character_dm_notes(target_character_id uuid)
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
        )
    );
$$;

REVOKE ALL ON FUNCTION private.is_character_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_character_dm_notes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_character_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_character_dm_notes(uuid) TO authenticated;

CREATE TABLE public.character_dm_notes (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_dm_notes_content_document CHECK (
    jsonb_typeof(content) = 'object'
    AND content->>'type' = 'doc'
    AND jsonb_typeof(content->'content') = 'array'
  )
);

INSERT INTO public.character_dm_notes (character_id, content)
SELECT
  character.id,
  character.narrative_rich->'backstory_dm_notes'
FROM public.characters AS character
WHERE character.narrative_rich ? 'backstory_dm_notes'
  AND jsonb_typeof(character.narrative_rich->'backstory_dm_notes') = 'object'
  AND character.narrative_rich->'backstory_dm_notes'->>'type' = 'doc'
  AND jsonb_typeof(character.narrative_rich->'backstory_dm_notes'->'content') = 'array'
ON CONFLICT (character_id) DO NOTHING;

UPDATE public.characters
SET narrative_rich = narrative_rich - 'backstory_dm_notes'
WHERE narrative_rich ? 'backstory_dm_notes';

ALTER TABLE public.character_dm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Character owner and campaign DM can view DM notes"
  ON public.character_dm_notes FOR SELECT
  TO authenticated
  USING (private.can_view_character_dm_notes(character_id));

CREATE POLICY "Character owner can create DM notes"
  ON public.character_dm_notes FOR INSERT
  TO authenticated
  WITH CHECK (private.is_character_owner(character_id));

CREATE POLICY "Character owner can update DM notes"
  ON public.character_dm_notes FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (private.is_character_owner(character_id));

CREATE POLICY "Character owner can delete DM notes"
  ON public.character_dm_notes FOR DELETE
  TO authenticated
  USING (private.is_character_owner(character_id));

REVOKE ALL ON public.character_dm_notes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_dm_notes TO authenticated;

-- Preserve the atomic copy contract now that DM notes are a child row.
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
    'private', npc.portrait_url, npc.metadata
  FROM public.npcs AS npc
  WHERE npc.character_id = source_character_id
    AND npc.created_by = actor_id;

  RETURN new_character_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text) TO authenticated;
