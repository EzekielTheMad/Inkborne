-- Copy a character as one atomic operation.
--
-- The copy is an independent snapshot owned by the caller. It includes the
-- character build, current sheet state, narrative, selected content,
-- inventory, spells, and narrative NPCs. Roll history is intentionally not
-- copied because it belongs to the original character's play history.

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

  SELECT character.*
  INTO source_character
  FROM public.characters AS character
  WHERE character.id = source_character_id
    AND character.user_id = actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  resolved_name := btrim(
    COALESCE(NULLIF(copied_name, ''), source_character.name || ' (Copy)')
  );

  IF char_length(resolved_name) < 1 OR char_length(resolved_name) > 100 THEN
    RAISE EXCEPTION 'Character name must be between 1 and 100 characters'
      USING ERRCODE = '22023';
  END IF;

  IF target_campaign_id IS NOT NULL
    AND NOT private.can_assign_character_to_campaign(
      target_campaign_id,
      source_character.system_id
    )
  THEN
    RAISE EXCEPTION 'Campaign is unavailable or uses a different game system'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.characters (
    user_id,
    system_id,
    campaign_id,
    name,
    visibility,
    archived,
    level,
    base_stats,
    choices,
    state,
    narrative,
    narrative_rich,
    primary_color
  )
  VALUES (
    actor_id,
    source_character.system_id,
    target_campaign_id,
    resolved_name,
    'private',
    false,
    source_character.level,
    source_character.base_stats,
    source_character.choices,
    source_character.state,
    source_character.narrative,
    source_character.narrative_rich,
    source_character.primary_color
  )
  RETURNING id INTO new_character_id;

  INSERT INTO public.character_content_refs (
    character_id,
    content_id,
    content_version,
    context,
    choice_source
  )
  SELECT
    new_character_id,
    ref.content_id,
    ref.content_version,
    ref.context,
    ref.choice_source
  FROM public.character_content_refs AS ref
  WHERE ref.character_id = source_character_id;

  INSERT INTO public.character_inventory (
    character_id,
    content_id,
    name,
    content_type,
    quantity,
    equipped,
    attuned,
    sort_order,
    notes,
    custom_data
  )
  SELECT
    new_character_id,
    item.content_id,
    item.name,
    item.content_type,
    item.quantity,
    item.equipped,
    item.attuned,
    item.sort_order,
    item.notes,
    item.custom_data
  FROM public.character_inventory AS item
  WHERE item.character_id = source_character_id;

  INSERT INTO public.character_spells (
    character_id,
    content_id,
    name,
    class_slug,
    is_known,
    is_prepared,
    always_prepared,
    in_spellbook,
    source,
    custom_data
  )
  SELECT
    new_character_id,
    spell.content_id,
    spell.name,
    spell.class_slug,
    spell.is_known,
    spell.is_prepared,
    spell.always_prepared,
    spell.in_spellbook,
    spell.source,
    spell.custom_data
  FROM public.character_spells AS spell
  WHERE spell.character_id = source_character_id;

  INSERT INTO public.npcs (
    character_id,
    created_by,
    name,
    description,
    relationship,
    visibility,
    portrait_url,
    metadata
  )
  SELECT
    new_character_id,
    actor_id,
    npc.name,
    npc.description,
    npc.relationship,
    'private',
    npc.portrait_url,
    npc.metadata
  FROM public.npcs AS npc
  WHERE npc.character_id = source_character_id
    AND npc.created_by = actor_id;

  RETURN new_character_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text) TO authenticated;
