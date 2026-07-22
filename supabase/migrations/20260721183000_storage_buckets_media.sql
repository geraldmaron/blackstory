-- Supabase Storage buckets for product media (ADR-020 blob cutover).
-- public-media: public read for vetted entity/release objects.
-- raw-sources: private; service_role / signed URL only.
-- Mirrors live apply; keep in sync with remote.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('public-media', 'public-media', true, 524288000, NULL),
  ('raw-sources', 'raw-sources', false, 524288000, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "public_media_anon_select" ON storage.objects;
CREATE POLICY "public_media_anon_select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'public-media');

DROP POLICY IF EXISTS "public_media_ops_insert" ON storage.objects;
CREATE POLICY "public_media_ops_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'public-media'
    AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN ('publication', 'admin', 'security')
  );

DROP POLICY IF EXISTS "public_media_ops_update" ON storage.objects;
CREATE POLICY "public_media_ops_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'public-media'
    AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN ('publication', 'admin', 'security')
  )
  WITH CHECK (
    bucket_id = 'public-media'
    AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN ('publication', 'admin', 'security')
  );

DROP POLICY IF EXISTS "public_media_ops_select" ON storage.objects;
CREATE POLICY "public_media_ops_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'public-media'
    OR (
      bucket_id = 'raw-sources'
      AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN ('research', 'publication', 'admin', 'security')
    )
  );

DROP POLICY IF EXISTS "raw_sources_ops_insert" ON storage.objects;
CREATE POLICY "raw_sources_ops_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'raw-sources'
    AND coalesce((auth.jwt() -> 'app_metadata' ->> 'bb_role'), '') IN ('research', 'admin', 'security')
  );
