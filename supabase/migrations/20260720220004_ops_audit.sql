-- 0004_ops_audit: policy, kill switches, outbox, idempotency, audit, catalog, story reviews.

CREATE TABLE bb_ops.policy_versions (
  id text PRIMARY KEY,
  policy_version text NOT NULL,
  checksum text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.policy_active (
  id text PRIMARY KEY DEFAULT 'active' CHECK (id = 'active'),
  policy_version text NOT NULL,
  activated_at timestamptz NOT NULL
);

CREATE TABLE bb_ops.kill_switches (
  id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.discovery_campaign_runs (
  id text PRIMARY KEY,
  job_id text NOT NULL,
  job_run_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'skipped_kill_switch', 'error')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  mode text NOT NULL CHECK (mode IN ('fixture', 'live')),
  accepted_count integer NOT NULL DEFAULT 0,
  survivor_count integer NOT NULL DEFAULT 0,
  kind text,
  error_message text,
  public_effect text NOT NULL DEFAULT 'none' CHECK (public_effect = 'none'),
  kill_switch_id text NOT NULL DEFAULT 'research-campaigns',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.outbox_messages (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  topic text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'processed', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL
);

CREATE TABLE bb_ops.idempotency_keys (
  key text PRIMARY KEY,
  event_id text,
  outbox_message_id text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.outbox_consumer_receipts (
  id text PRIMARY KEY,
  consumer_id text NOT NULL,
  message_id text NOT NULL REFERENCES bb_ops.outbox_messages (id),
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer_id, message_id)
);

CREATE TABLE bb_ops.catalog_decisions (
  entity_id text PRIMARY KEY,
  decision text NOT NULL CHECK (decision IN ('flag_for_retraction', 'needs_review', 'clear_flag')),
  actor_id text NOT NULL,
  reason text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE bb_ops.story_packet_reviews (
  id text PRIMARY KEY,
  submission_id text NOT NULL,
  decision text CHECK (decision IN ('approved', 'rejected', 'needs_evidence')),
  reviewer_id text,
  notes text,
  packet jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.external_datasets (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  registry_state text NOT NULL DEFAULT 'disabled'
    CHECK (registry_state IN ('disabled', 'enabled', 'deprecated')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.external_dataset_versions (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES bb_ops.external_datasets (id),
  version_label text NOT NULL,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, version_label)
);

CREATE TABLE bb_ops.dataset_subscriptions (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES bb_ops.external_datasets (id),
  subscriber text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.import_batches (
  id text PRIMARY KEY,
  dataset_version_id text REFERENCES bb_ops.external_dataset_versions (id),
  stage text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.import_validation_findings (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES bb_ops.import_batches (id),
  severity text NOT NULL,
  message text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_ops.import_quarantines (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES bb_ops.import_batches (id),
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_audit.events (
  id text PRIMARY KEY,
  action text NOT NULL,
  category text NOT NULL,
  actor jsonb NOT NULL,
  subject jsonb NOT NULL,
  reason text NOT NULL,
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  release_id text,
  entity_id text,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
