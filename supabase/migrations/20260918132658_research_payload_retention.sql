BEGIN;
ALTER TABLE research.runs
  ADD COLUMN payload_retention_until timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '180 days'),
  ADD COLUMN retention_source_urls text[] NOT NULL DEFAULT '{}';
UPDATE research.runs SET payload_retention_until=started_at+interval '180 days';
-- Every execution lease and completion is already bounded by the run deadline.
UPDATE research.runs SET deadline_at=least(deadline_at,payload_retention_until)
  WHERE execution_plan IS NOT NULL;
CREATE FUNCTION research.bound_payload_deadline() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.execution_plan IS NOT NULL THEN
    NEW.deadline_at := least(NEW.deadline_at,NEW.payload_retention_until);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bound_payload_deadline BEFORE INSERT OR UPDATE OF execution_plan,deadline_at,payload_retention_until
  ON research.runs FOR EACH ROW EXECUTE FUNCTION research.bound_payload_deadline();
CREATE INDEX research_run_payload_retention_idx ON research.runs(payload_retention_until) WHERE execution_plan IS NOT NULL;
ALTER TABLE research.artifacts
  ADD COLUMN retention_source_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN retention_until timestamptz,
  ADD COLUMN payload_disposed_at timestamptz;
CREATE INDEX artifacts_retention_idx ON research.artifacts(retention_until) WHERE payload_disposed_at IS NULL;
CREATE INDEX artifacts_retention_sources_idx ON research.artifacts USING gin(retention_source_urls);
UPDATE research.artifacts SET retention_until=created_at+interval '180 days' WHERE status IN ('proposed','quarantined','rejected');
CREATE TABLE evidence.capture_orphan_disposals (
  bucket text NOT NULL,
  object_path text NOT NULL,
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  PRIMARY KEY(bucket,object_path)
);
ALTER TABLE evidence.capture_orphan_disposals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON evidence.capture_orphan_disposals TO service_role;
GRANT SELECT ON evidence.capture_orphan_disposals TO research_worker;
CREATE POLICY orphan_disposal_worker_read ON evidence.capture_orphan_disposals FOR SELECT TO research_worker USING (true);
CREATE OR REPLACE FUNCTION evidence.guard_origin_storage() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.storage_object->>'bucket' IS NOT DISTINCT FROM OLD.storage_object->>'bucket'
    AND NEW.storage_object->>'path' IS NOT DISTINCT FROM OLD.storage_object->>'path' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM evidence.capture_disposals WHERE bucket=NEW.storage_object->>'bucket'
    AND object_path=NEW.storage_object->>'path') OR EXISTS (
    SELECT 1 FROM evidence.capture_orphan_disposals WHERE bucket=NEW.storage_object->>'bucket'
      AND object_path=NEW.storage_object->>'path'
  ) THEN RAISE EXCEPTION 'Capture storage key was queued for disposal; use a new reviewed retention revision'; END IF;
  RETURN NEW;
END $$;
COMMENT ON COLUMN research.artifacts.retention_source_urls IS 'Exact source origins inherited transitively by derived proposal payloads.';
COMMENT ON COLUMN research.artifacts.payload_disposed_at IS 'Payload erased; content hash and provenance identities retained.';
COMMIT;
