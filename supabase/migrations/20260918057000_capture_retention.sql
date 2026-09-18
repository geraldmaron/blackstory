BEGIN;
ALTER TABLE evidence.capture_origins ADD COLUMN retention_revoked_at timestamptz;
CREATE TABLE evidence.capture_disposals (
  capture_id text NOT NULL REFERENCES evidence.source_captures(id),
  source_item_id text NOT NULL REFERENCES evidence.source_items(id),
  bucket text NOT NULL,
  object_path text NOT NULL,
  reason text NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  PRIMARY KEY(capture_id,source_item_id,bucket,object_path)
);
ALTER TABLE evidence.capture_disposals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON evidence.capture_disposals TO service_role;
GRANT SELECT ON evidence.capture_disposals TO authenticated,research_worker;
CREATE POLICY capture_disposals_worker_read ON evidence.capture_disposals FOR SELECT TO research_worker USING (true);
CREATE POLICY capture_disposals_staff_read ON evidence.capture_disposals FOR SELECT TO authenticated
  USING ((SELECT access_control.is_staff()));
CREATE INDEX capture_disposals_pending_idx ON evidence.capture_disposals(requested_at) WHERE deleted_at IS NULL;
-- Recover only origins with an existing source-item relationship; never infer missing custody.
INSERT INTO evidence.capture_origins(capture_id,source_item_id,source_url,final_url,storage_object,observed_at)
SELECT c.id,i.id,i.url,coalesce(nullif(c.storage_object->>'finalUrl',''),i.url),c.storage_object,c.captured_at
FROM evidence.source_captures c JOIN evidence.source_items i ON i.id=c.source_item_id
WHERE i.url ~ '^https?://' ON CONFLICT DO NOTHING;
-- Lock the origin so withdrawal cannot race with passage insertion or renewal.
CREATE FUNCTION evidence.guard_passage_retention() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM evidence.capture_origins WHERE capture_id=NEW.capture_id AND source_item_id=NEW.source_item_id
    AND retention_revoked_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Capture origin retention was withdrawn'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER passage_retention_guard BEFORE INSERT OR UPDATE ON evidence.retrieval_passages
  FOR EACH ROW EXECUTE FUNCTION evidence.guard_passage_retention();
-- A disposal is a permanent tombstone for an object key. Renewed rights use a new revision key.
CREATE FUNCTION evidence.guard_origin_storage() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.storage_object->>'bucket' IS NOT DISTINCT FROM OLD.storage_object->>'bucket'
    AND NEW.storage_object->>'path' IS NOT DISTINCT FROM OLD.storage_object->>'path' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM evidence.capture_disposals WHERE bucket=NEW.storage_object->>'bucket'
    AND object_path=NEW.storage_object->>'path') THEN
    RAISE EXCEPTION 'Capture storage key was queued for disposal; use a new reviewed retention revision';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER origin_storage_guard BEFORE INSERT OR UPDATE ON evidence.capture_origins
  FOR EACH ROW EXECUTE FUNCTION evidence.guard_origin_storage();
COMMIT;
