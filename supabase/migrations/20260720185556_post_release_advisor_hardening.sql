-- Clear actionable database-advisor findings without changing authorization
-- semantics. Composite foreign keys receive covering indexes, and legacy RLS
-- policies cache auth.uid() once per statement through scalar subqueries.

CREATE INDEX IF NOT EXISTS idx_character_content_refs_feature_grant_identity
  ON public.character_content_refs (
    feature_grant_id,
    character_id,
    content_id,
    content_version
  )
  WHERE feature_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_character_feature_grants_controller_character
  ON public.character_feature_grants (controller_ref_id, character_id);

CREATE INDEX IF NOT EXISTS idx_character_spell_grants_controller_character
  ON public.character_spell_grants (controller_ref_id, character_id);

CREATE INDEX IF NOT EXISTS idx_character_spells_spell_grant_identity
  ON public.character_spells (
    spell_grant_id,
    character_id,
    content_id,
    content_version,
    class_slug
  )
  WHERE spell_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_srd_import_batches_system_id
  ON public.srd_import_batches (system_id);

CREATE INDEX IF NOT EXISTS idx_srd_import_staging_batch_system
  ON public.srd_import_staging (batch_id, system_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owner can insert custom types"
  ON public.custom_content_types;
CREATE POLICY "Owner can insert custom types"
  ON public.custom_content_types FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owner can update custom types"
  ON public.custom_content_types;
CREATE POLICY "Owner can update custom types"
  ON public.custom_content_types FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Personal custom types visible to owner"
  ON public.custom_content_types;
DROP POLICY IF EXISTS "Shared custom types visible to owner and campaign members"
  ON public.custom_content_types;
CREATE POLICY "Authorized users can view custom content types"
  ON public.custom_content_types FOR SELECT TO authenticated
  USING (
    (scope = 'personal' AND owner_id = (SELECT auth.uid()))
    OR (
      scope = 'shared'
      AND (
        owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.content_type_shares AS share
          JOIN public.campaign_members AS member
            ON member.campaign_id = share.campaign_id
          WHERE share.content_type_id = custom_content_types.id
            AND member.user_id = (SELECT auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Members can share own content"
  ON public.content_shares;
CREATE POLICY "Members can share own content"
  ON public.content_shares FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.campaign_members AS member
      WHERE member.campaign_id = content_shares.campaign_id
        AND member.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.content_definitions AS definition
      WHERE definition.id = content_shares.content_id
        AND definition.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner can unshare content" ON public.content_shares;
CREATE POLICY "Owner can unshare content"
  ON public.content_shares FOR DELETE TO authenticated
  USING (shared_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Shares visible to campaign members"
  ON public.content_shares;
CREATE POLICY "Shares visible to campaign members"
  ON public.content_shares FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members AS member
      WHERE member.campaign_id = content_shares.campaign_id
        AND member.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can share own custom types"
  ON public.content_type_shares;
CREATE POLICY "Members can share own custom types"
  ON public.content_type_shares FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.campaign_members AS member
      WHERE member.campaign_id = content_type_shares.campaign_id
        AND member.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.custom_content_types AS custom_type
      WHERE custom_type.id = content_type_shares.content_type_id
        AND custom_type.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner can unshare custom types"
  ON public.content_type_shares;
CREATE POLICY "Owner can unshare custom types"
  ON public.content_type_shares FOR DELETE TO authenticated
  USING (shared_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Type shares visible to campaign members"
  ON public.content_type_shares;
CREATE POLICY "Type shares visible to campaign members"
  ON public.content_type_shares FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members AS member
      WHERE member.campaign_id = content_type_shares.campaign_id
        AND member.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner can delete character content refs"
  ON public.character_content_refs;
CREATE POLICY "Owner can delete character content refs"
  ON public.character_content_refs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characters AS character
      WHERE character.id = character_content_refs.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users insert own feedback" ON public.feedback;
CREATE POLICY "Users insert own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback;
CREATE POLICY "Users read own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users log own errors" ON public.app_errors;
CREATE POLICY "Users log own errors"
  ON public.app_errors FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users read own errors" ON public.app_errors;
CREATE POLICY "Users read own errors"
  ON public.app_errors FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owner can insert rolls" ON public.character_rolls;
CREATE POLICY "Owner can insert rolls"
  ON public.character_rolls FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.characters AS character
      WHERE character.id = character_rolls.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );
