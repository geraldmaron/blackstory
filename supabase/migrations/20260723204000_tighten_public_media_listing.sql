-- Tighten public-media storage listing (lint 0025_public_bucket_allows_listing).
-- Public bucket URLs (/object/public/public-media/...) do not need a broad SELECT
-- policy for object fetch. Drop anon/authenticated listing; keep staff SELECT for
-- ops (upsert needs SELECT) and leave insert/update/raw-sources role gates intact.

DROP POLICY IF EXISTS "public_media_anon_select" ON storage.objects;

DROP POLICY IF EXISTS "public_media_ops_select" ON storage.objects;
CREATE POLICY "public_media_ops_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    (
      bucket_id = 'public-media'
      AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN (
        'research', 'publication', 'admin', 'security'
      )
    )
    OR (
      bucket_id = 'raw-sources'
      AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN (
        'research', 'publication', 'admin', 'security'
      )
    )
  );
