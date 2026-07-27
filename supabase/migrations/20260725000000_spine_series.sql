-- Spine series: national multi-source-splice tables for era-immersion themes.
-- A "spine" is a single harmonized concept (e.g. Black homeownership rate, US)
-- stitched across time from multiple statistical_series segments, each winning
-- a non-overlapping (or explicitly-flagged-overlapping) span of years.

CREATE TABLE IF NOT EXISTS bb_reference.spine_series (
  spine_id text PRIMARY KEY,
  title text NOT NULL,
  outcome text NOT NULL,
  race_ethnicity_slice text,
  geography_type text NOT NULL DEFAULT 'nation',
  unit text NOT NULL,
  definition text NOT NULL,
  comparability_note text NOT NULL,
  theme text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_reference.spine_segments (
  id text PRIMARY KEY,
  spine_id text NOT NULL REFERENCES bb_reference.spine_series (spine_id),
  metric_id text NOT NULL REFERENCES bb_reference.statistical_series (metric_id),
  period_start text NOT NULL,
  period_end text NOT NULL,
  priority int NOT NULL DEFAULT 0,
  splice_note text NOT NULL,
  seam_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spine_segments_spine_idx
  ON bb_reference.spine_segments (spine_id);

CREATE INDEX IF NOT EXISTS spine_segments_metric_idx
  ON bb_reference.spine_segments (metric_id);

-- One row per (spine_id, reference_period): the winning segment (lowest priority
-- among segments whose [period_start, period_end] contains the year) resolved to
-- its observation. Ties on priority are broken by segment id for determinism.
CREATE OR REPLACE VIEW bb_reference.spine_observations_v AS
WITH candidates AS (
  SELECT
    seg.spine_id,
    obs.reference_period,
    seg.metric_id,
    obs.estimate,
    ser.unit,
    obs.source,
    obs.source_url,
    seg.splice_note,
    seg.priority,
    seg.id AS segment_id,
    row_number() OVER (
      PARTITION BY seg.spine_id, obs.reference_period
      ORDER BY seg.priority ASC, seg.id ASC
    ) AS rn
  FROM bb_reference.spine_segments seg
  JOIN bb_reference.statistical_series ser ON ser.metric_id = seg.metric_id
  JOIN bb_reference.statistical_observations obs ON obs.metric_id = seg.metric_id
  WHERE obs.reference_period BETWEEN seg.period_start AND seg.period_end
)
SELECT
  spine_id,
  reference_period,
  estimate,
  unit,
  metric_id AS source_metric_id,
  source,
  source_url,
  splice_note
FROM candidates
WHERE rn = 1;

COMMENT ON TABLE bb_reference.spine_series IS
  'A harmonized national concept spliced across multiple statistical_series segments over time.';
COMMENT ON TABLE bb_reference.spine_segments IS
  'One source-metric span per spine; priority breaks ties when segments overlap. seam_check holds overlap-year comparison populated by splice QA.';
COMMENT ON VIEW bb_reference.spine_observations_v IS
  'One resolved observation per (spine_id, reference_period), picking the lowest-priority segment covering that year.';

ALTER TABLE bb_reference.spine_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_reference.spine_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY spine_series_select ON bb_reference.spine_series
  FOR SELECT TO anon, authenticated
  USING (status = 'published' OR bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY spine_segments_select ON bb_reference.spine_segments
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bb_reference.spine_series sp
      WHERE sp.spine_id = spine_segments.spine_id
        AND (sp.status = 'published' OR bb_auth.has_any_role('admin', 'research', 'publication'))
    )
  );

GRANT SELECT ON bb_reference.spine_observations_v TO anon, authenticated;
