BEGIN;
-- A rebuildable private index over authorized captured text, not a second evidence system.
CREATE TABLE evidence.retrieval_passages (
  id text PRIMARY KEY,
  capture_id text NOT NULL,
  source_item_id text NOT NULL,
  parser_version text NOT NULL,
  document_text_hash text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  start_offset integer NOT NULL CHECK (start_offset >= 0),
  end_offset integer NOT NULL CHECK (end_offset > start_offset),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  body_hash text NOT NULL,
  search_text tsvector GENERATED ALWAYS AS (to_tsvector('simple',body)) STORED,
  retention_decision jsonb NOT NULL,
  retention_expires_at timestamptz NOT NULL,
  embedding extensions.vector(768),
  embedding_model text,
  embedding_text_hash text,
  withdrawn_at timestamptz,
  FOREIGN KEY (capture_id,source_item_id) REFERENCES evidence.capture_origins(capture_id,source_item_id) ON DELETE CASCADE,
  UNIQUE (capture_id,source_item_id,parser_version,document_text_hash,ordinal),
  CHECK (char_length(body) = end_offset-start_offset),
  CHECK ((embedding IS NULL) = (embedding_model IS NULL)),
  CHECK ((embedding IS NULL) = (embedding_text_hash IS NULL)),
  CHECK (embedding_text_hash IS NULL OR embedding_text_hash=body_hash)
);
CREATE INDEX retrieval_passages_origin_idx ON evidence.retrieval_passages(source_item_id,capture_id);
CREATE INDEX retrieval_passages_text_idx ON evidence.retrieval_passages USING gin(search_text);
CREATE INDEX retrieval_passages_vector_idx ON evidence.retrieval_passages USING hnsw(embedding extensions.vector_cosine_ops)
  WHERE withdrawn_at IS NULL;
ALTER TABLE evidence.retrieval_passages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON evidence.retrieval_passages TO service_role;
GRANT SELECT ON evidence.retrieval_passages TO authenticated;
CREATE POLICY retrieval_passages_staff_read ON evidence.retrieval_passages FOR SELECT TO authenticated
  USING ((SELECT access_control.is_staff()));
COMMIT;
