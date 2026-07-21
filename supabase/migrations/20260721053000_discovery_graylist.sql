-- Discovery graylist table for admin ops (parity with Firestore discoveryGraylist).
-- Service-role writes; authenticated denied via RLS (same pattern as other bb_ops tables).

CREATE TABLE IF NOT EXISTS bb_ops.discovery_graylist (
  id text PRIMARY KEY,
  candidate_id text NOT NULL,
  disposition text NOT NULL,
  status text NOT NULL,
  composite_score double precision NOT NULL,
  parked_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  adapter_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE bb_ops.discovery_graylist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discovery_graylist_deny_authenticated ON bb_ops.discovery_graylist;
CREATE POLICY discovery_graylist_deny_authenticated
  ON bb_ops.discovery_graylist
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS discovery_graylist_parked_at_idx
  ON bb_ops.discovery_graylist (parked_at DESC);
