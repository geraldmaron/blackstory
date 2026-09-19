-- Temporary: allow anon INSERT/UPDATE on public-media for one-shot GCS cutover.
-- Revoke immediately after copy completes.

DROP POLICY IF EXISTS "temp_cutover_public_media_insert" ON storage.objects;
CREATE POLICY "temp_cutover_public_media_insert"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'public-media');

DROP POLICY IF EXISTS "temp_cutover_public_media_update" ON storage.objects;
CREATE POLICY "temp_cutover_public_media_update"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'public-media')
  WITH CHECK (bucket_id = 'public-media');
