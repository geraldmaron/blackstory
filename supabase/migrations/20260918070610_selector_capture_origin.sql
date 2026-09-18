BEGIN;
-- Selectors identify both immutable bytes and their reviewed source origin.
ALTER TABLE evidence.evidence_selectors ADD COLUMN source_item_id text;
ALTER TABLE evidence.evidence_selectors DISABLE TRIGGER evidence_selectors_append_only;
UPDATE evidence.evidence_selectors selector SET source_item_id=capture.source_item_id
FROM evidence.source_captures capture
JOIN evidence.capture_origins origin ON origin.capture_id=capture.id
  AND origin.source_item_id=capture.source_item_id
WHERE selector.capture_id=capture.id;
ALTER TABLE evidence.evidence_selectors ENABLE TRIGGER evidence_selectors_append_only;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM evidence.evidence_selectors WHERE source_item_id IS NULL) THEN
    RAISE EXCEPTION 'Existing selectors need reviewed capture origins before this migration';
  END IF;
END $$;
ALTER TABLE evidence.evidence_selectors
  ALTER COLUMN source_item_id SET NOT NULL,
  ADD CONSTRAINT selector_capture_origin FOREIGN KEY (capture_id,source_item_id)
    REFERENCES evidence.capture_origins(capture_id,source_item_id),
  DROP CONSTRAINT evidence_selectors_capture_id_selector_hash_key,
  ADD CONSTRAINT selector_origin_hash UNIQUE (capture_id,source_item_id,selector_hash);
CREATE INDEX evidence_selectors_source_item_idx ON evidence.evidence_selectors(source_item_id);
COMMIT;
