-- Boundary stub tables so grants and isolation tests have concrete objects (BB-012).
-- Full domain schema is BB-013; these stubs must remain grant-compatible.

CREATE TABLE IF NOT EXISTS bb_public.released_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_submissions.intake_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_research.staging_note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_evidence.raw_capture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_uri text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_publication.release_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id text NOT NULL UNIQUE,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_admin.operator_note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_audit.event_log (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  actor text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_migrations.schema_version (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
