-- Migration: Add storage RLS policies for character-portraits bucket
-- Allows authenticated users to manage images in their own character folders

CREATE POLICY "Users can upload character images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'character-portraits'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM characters WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update character images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'character-portraits'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM characters WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete character images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'character-portraits'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM characters WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Public read access for character portraits"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'character-portraits');
