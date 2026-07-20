-- Public buckets serve known object URLs without a broad SELECT policy.
-- Keep folder listing available only to the character owner because image
-- replacement and deletion use Storage list/upsert operations.

DROP POLICY IF EXISTS "Public read access for character portraits"
  ON storage.objects;

CREATE POLICY "Owners can list character images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id::text = (storage.foldername(name))[1]
        AND character.user_id = (SELECT auth.uid())
    )
  );
