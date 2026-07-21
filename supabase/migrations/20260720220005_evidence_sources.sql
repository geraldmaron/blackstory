-- 0005_evidence_sources: organizations, domains, sources, items, captures, evidence, lineage.

CREATE TABLE bb_evidence.source_organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  homepage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_evidence.source_domains (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES bb_evidence.source_organizations (id),
  hostname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hostname)
);

CREATE TABLE bb_evidence.evidence_sources (
  id text PRIMARY KEY,
  organization_id text REFERENCES bb_evidence.source_organizations (id),
  display_name text NOT NULL,
  adapter_id text,
  adapter_enabled boolean NOT NULL DEFAULT false,
  rights jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_evidence.source_items (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES bb_evidence.evidence_sources (id),
  stable_identifier text NOT NULL,
  title text,
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, stable_identifier)
);

CREATE TABLE bb_evidence.source_captures (
  id text PRIMARY KEY,
  source_item_id text REFERENCES bb_evidence.source_items (id),
  content_hash_algorithm text NOT NULL,
  content_hash_digest text NOT NULL,
  parser_version text,
  snapshot_mode text,
  dedup_of_capture_id text REFERENCES bb_evidence.source_captures (id),
  storage_object jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_hash_algorithm, content_hash_digest)
);

CREATE TABLE bb_evidence.retrieval_events (
  id text PRIMARY KEY,
  source_id text REFERENCES bb_evidence.evidence_sources (id),
  adapter_id text,
  status text NOT NULL,
  http_status integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_evidence.evidence_records (
  id text PRIMARY KEY,
  source_item_id text NOT NULL REFERENCES bb_evidence.source_items (id),
  rights_status text,
  excerpt text,
  lineage_root_id text,
  storage_object jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_evidence.evidence_lineage (
  id text PRIMARY KEY,
  kind text NOT NULL,
  from_evidence_id text NOT NULL REFERENCES bb_evidence.evidence_records (id),
  to_evidence_id text NOT NULL REFERENCES bb_evidence.evidence_records (id),
  lineage_root_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
