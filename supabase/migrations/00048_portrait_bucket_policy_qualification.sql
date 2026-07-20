-- Fully qualify the outer storage row. Without qualification, `name` binds to
-- the inner characters alias and prevents owners from listing their folder.

DROP POLICY IF EXISTS "Owners can list character images"
  ON storage.objects;

CREATE POLICY "Owners can list character images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND EXISTS (
      SELECT 1
      FROM public.characters AS owned_character
      WHERE owned_character.id::text =
        (storage.foldername(storage.objects.name))[1]
        AND owned_character.user_id = (SELECT auth.uid())
    )
  );
