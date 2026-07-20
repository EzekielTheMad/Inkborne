-- INSERT ... RETURNING evaluates the SELECT policy before a helper query can
-- observe the row created by the same statement. Check ownership against the
-- candidate character row directly, then preserve the existing helper for DM,
-- campaign-member, and public visibility.

DROP POLICY IF EXISTS "Authorized users can view characters"
  ON public.characters;

CREATE POLICY "Authorized users can view characters"
  ON public.characters FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_view_character(id)
  );
