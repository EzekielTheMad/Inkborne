-- INSERT ... RETURNING evaluates the SELECT policy before a helper query can
-- observe the row created by the same statement. Check ownership against the
-- candidate campaign row directly so Supabase `.insert().select()` succeeds.

DROP POLICY IF EXISTS "Campaign visible to authorized users"
  ON public.campaigns;

CREATE POLICY "Campaign visible to authorized users"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR private.is_campaign_member(id)
  );
