-- Landscape / bulk discovery candidates: research-lane intake before case assignment.
-- Complements bb_research.entity_candidates (case-bound) and bb_ops.discovery_graylist (parked).
-- Never exposes rows to anon/authenticated public reads; no path to bb_public without human gate.

CREATE TABLE bb_research.source_program_runs (
  id text PRIMARY KEY,
  lane text NOT NULL CHECK (lane IN ('dc-sites', 'greenbook', 'hbcu', 'nrhp', 'wikidata', 'other')),
  source_program_id text NOT NULL,
  source_program_name text NOT NULL,
  custodian text,
  license text,
  canonical_url text,
  attribution text,
  retrieved_at timestamptz NOT NULL,
  fixture_path text,
  rows_fetched integer NOT NULL DEFAULT 0 CHECK (rows_fetched >= 0),
  candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  dropped_count integer NOT NULL DEFAULT 0 CHECK (dropped_count >= 0),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.source_acquisition_captures (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES bb_research.source_program_runs (id) ON DELETE CASCADE,
  url text NOT NULL,
  content_sha256 text NOT NULL,
  bytes integer NOT NULL CHECK (bytes >= 0),
  cached_as text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_research.landscape_candidates (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES bb_research.source_program_runs (id) ON DELETE CASCADE,
  lane text NOT NULL,
  source_program_id text NOT NULL,
  source_item_id text NOT NULL,
  display_name text NOT NULL,
  kind text NOT NULL DEFAULT 'place',
  summary text,
  lat double precision,
  lng double precision,
  canonical_url text,
  research_lane_only boolean NOT NULL DEFAULT true CHECK (research_lane_only = true),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'quarantined', 'dead_letter', 'merged'
  )),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lane, source_item_id)
);

CREATE INDEX source_program_runs_lane_retrieved_idx
  ON bb_research.source_program_runs (lane, retrieved_at DESC);

CREATE INDEX source_acquisition_captures_run_idx
  ON bb_research.source_acquisition_captures (run_id);

CREATE INDEX landscape_candidates_run_idx
  ON bb_research.landscape_candidates (run_id);

CREATE INDEX landscape_candidates_lane_status_idx
  ON bb_research.landscape_candidates (lane, status, discovered_at DESC);

CREATE INDEX landscape_candidates_source_program_idx
  ON bb_research.landscape_candidates (source_program_id, source_item_id);

ALTER TABLE bb_research.source_program_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_research.source_acquisition_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_research.landscape_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_program_runs_staff_select ON bb_research.source_program_runs
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

CREATE POLICY source_acquisition_captures_staff_select ON bb_research.source_acquisition_captures
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

CREATE POLICY landscape_candidates_staff_select ON bb_research.landscape_candidates
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

REVOKE INSERT, UPDATE, DELETE ON bb_research.source_program_runs,
  bb_research.source_acquisition_captures, bb_research.landscape_candidates
FROM authenticated;

GRANT SELECT ON bb_research.source_program_runs,
  bb_research.source_acquisition_captures, bb_research.landscape_candidates
TO authenticated;

GRANT ALL ON bb_research.source_program_runs,
  bb_research.source_acquisition_captures, bb_research.landscape_candidates
TO service_role;
