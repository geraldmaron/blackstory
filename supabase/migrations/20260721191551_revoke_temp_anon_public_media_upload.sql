-- Revoke temporary cutover upload policies on public-media.
DROP POLICY IF EXISTS "temp_cutover_public_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "temp_cutover_public_media_update" ON storage.objects;
