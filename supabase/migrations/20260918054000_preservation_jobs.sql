BEGIN;
CREATE TABLE research.preservation_jobs (
  source_url text PRIMARY KEY CHECK (source_url ~ '^https?://'),
  state text NOT NULL CHECK (state IN ('reserved','pending','anchored','failed')),
  decision jsonb NOT NULL,
  job_id text UNIQUE,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (state NOT IN ('pending','anchored') OR job_id IS NOT NULL)
);
ALTER TABLE research.preservation_jobs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON research.preservation_jobs TO service_role;
GRANT SELECT ON research.preservation_jobs TO authenticated;
CREATE POLICY preservation_jobs_staff_read ON research.preservation_jobs FOR SELECT TO authenticated
  USING ((SELECT access_control.is_staff()));
COMMIT;
