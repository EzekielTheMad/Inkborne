-- Remove campaign-introduced advisor findings without changing authorization.

CREATE INDEX IF NOT EXISTS idx_campaign_pages_parent_id
  ON public.campaign_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_campaign_pages_updated_by
  ON public.campaign_pages(updated_by);

DROP POLICY IF EXISTS "Owner can manage inventory"
  ON public.character_inventory;

CREATE POLICY "Owner can insert inventory"
  ON public.character_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_inventory.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owner can update inventory"
  ON public.character_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_inventory.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_inventory.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owner can delete inventory"
  ON public.character_inventory FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_inventory.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owner can manage spells"
  ON public.character_spells;

CREATE POLICY "Owner can insert spells"
  ON public.character_spells FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_spells.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owner can update spells"
  ON public.character_spells FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_spells.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_spells.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owner can delete spells"
  ON public.character_spells FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = public.character_spells.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );
