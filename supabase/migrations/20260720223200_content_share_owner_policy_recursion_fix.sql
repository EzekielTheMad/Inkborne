-- Repair the owner-visible share policy without introducing an RLS cycle.
--
-- content_definitions visibility already consults content_shares. Referencing
-- content_definitions again from the content_shares policy causes PostgreSQL to
-- reject both reads with "infinite recursion detected in policy". All share
-- writes enforce `shared_by = auth.uid()` and exact definition ownership, so
-- the denormalized actor column is the safe, non-recursive owner predicate.

DROP POLICY IF EXISTS "Shares visible to campaign members and content owners"
  ON public.content_shares;

CREATE POLICY "Shares visible to campaign members and content owners"
  ON public.content_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_members AS member
      WHERE member.campaign_id = content_shares.campaign_id
        AND member.user_id = (SELECT auth.uid())
    )
    OR content_shares.shared_by = (SELECT auth.uid())
  );
