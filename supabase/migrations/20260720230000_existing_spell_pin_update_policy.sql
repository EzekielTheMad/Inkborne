-- Existing exact spell pins remain manageable after the current definition is
-- edited, retired, or unshared. New inserts still require current eligibility.
-- Updates may change preparation/known/spellbook state, but may not swap the
-- character or pinned content identity to bypass the insert policy.

CREATE OR REPLACE FUNCTION private.can_update_existing_character_spell_pin(
  target_spell_id uuid,
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
    AND EXISTS (
      SELECT 1
      FROM public.character_spells AS existing
      JOIN public.characters AS character
        ON character.id = existing.character_id
      WHERE existing.id = target_spell_id
        AND existing.character_id = target_character_id
        AND existing.content_id IS NOT DISTINCT FROM target_content_id
        AND existing.content_version IS NOT DISTINCT FROM target_content_version
        AND character.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION private.can_update_existing_character_spell_pin(
  uuid, uuid, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_update_existing_character_spell_pin(
  uuid, uuid, uuid, integer
) TO authenticated;

DROP POLICY IF EXISTS "Owners can update spells"
  ON public.character_spells;

CREATE POLICY "Owners can update existing spell pins"
  ON public.character_spells FOR UPDATE
  TO authenticated
  USING (private.is_character_owner(character_id))
  WITH CHECK (
    private.can_update_existing_character_spell_pin(
      id,
      character_id,
      content_id,
      content_version
    )
  );
