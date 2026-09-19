BEGIN;
-- Identical bytes can be retrieved from multiple works. Preserve every observed origin.
CREATE TABLE evidence.capture_origins (
  capture_id text NOT NULL REFERENCES evidence.source_captures(id),
  source_item_id text NOT NULL REFERENCES evidence.source_items(id),
  source_url text NOT NULL CHECK (source_url ~ '^https?://'),
  final_url text NOT NULL CHECK (final_url ~ '^https?://'),
  storage_object jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (capture_id,source_item_id)
);
CREATE INDEX capture_origins_source_item_idx ON evidence.capture_origins(source_item_id);
CREATE INDEX capture_origins_source_url_idx ON evidence.capture_origins(source_url);
ALTER TABLE evidence.capture_origins ENABLE ROW LEVEL SECURITY;
GRANT ALL ON evidence.capture_origins TO service_role;
GRANT SELECT ON evidence.capture_origins TO authenticated;
CREATE POLICY capture_origins_staff_read ON evidence.capture_origins FOR SELECT TO authenticated
  USING ((SELECT access_control.is_staff()));
COMMIT;
