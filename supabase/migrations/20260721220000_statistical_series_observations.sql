-- Normalized statistical series / observations + entity↔indicator bindings.
-- Aligns bb_reference with packages/domain/src/statistics/types.ts.
-- Opaque payload tables (acs_*, census_*) remain for legacy loaders; new indicators
-- prefer these typed tables. Jurisdictions seed helper is documented in
-- docs/runbooks/load-reference-jurisdictions.md (TIGER load is a separate bead).

CREATE TABLE IF NOT EXISTS bb_reference.statistical_series (
  metric_id text PRIMARY KEY,
  metric_definition text NOT NULL,
  universe text NOT NULL,
  unit text NOT NULL,
  source_dataset text NOT NULL,
  source_table text NOT NULL,
  source_variable text NOT NULL,
  geography_type text NOT NULL CHECK (geography_type IN (
    'tract', 'county', 'block', 'blockgroup', 'address', 'city', 'school',
    'facility', 'state', 'nation'
  )),
  estimate_type text NOT NULL CHECK (estimate_type IN (
    'count', 'percentage', 'rate', 'ratio', 'median', 'mean', 'index'
  )),
  period_type text NOT NULL CHECK (period_type IN (
    'point-in-time', '1-year-estimate', '5-year-estimate', 'annual', 'decennial', 'custom-range'
  )),
  external_data_source_id text,
  theme text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_reference.statistical_observations (
  id text PRIMARY KEY,
  metric_id text NOT NULL REFERENCES bb_reference.statistical_series (metric_id),
  jurisdiction_id text NOT NULL REFERENCES bb_reference.jurisdictions (id),
  boundary_version text NOT NULL,
  reference_period text NOT NULL,
  dataset_vintage text NOT NULL,
  estimate double precision NOT NULL,
  margin_of_error double precision,
  standard_error double precision,
  numerator double precision,
  denominator double precision,
  race_ethnicity_slice text,
  status text NOT NULL DEFAULT 'observed' CHECK (status = 'observed'),
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  source_item_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_id, jurisdiction_id, reference_period, boundary_version, race_ethnicity_slice)
);

CREATE INDEX IF NOT EXISTS statistical_observations_metric_period_idx
  ON bb_reference.statistical_observations (metric_id, reference_period);

CREATE INDEX IF NOT EXISTS statistical_observations_jurisdiction_idx
  ON bb_reference.statistical_observations (jurisdiction_id);

CREATE TABLE IF NOT EXISTS bb_reference.derived_measurements (
  id text PRIMARY KEY,
  method_id text NOT NULL,
  method_version text NOT NULL,
  input_observation_ids text[] NOT NULL,
  value double precision NOT NULL,
  uncertainty double precision,
  formula text NOT NULL,
  assumptions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('derived', 'modeled')),
  generated_at timestamptz NOT NULL,
  jurisdiction_id text REFERENCES bb_reference.jurisdictions (id),
  reference_period text,
  metric_id text REFERENCES bb_reference.statistical_series (metric_id),
  source text NOT NULL,
  source_url text NOT NULL,
  content_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bb_reference.entity_context_bindings (
  id text PRIMARY KEY,
  entity_id text NOT NULL,
  metric_id text NOT NULL REFERENCES bb_reference.statistical_series (metric_id),
  purpose text NOT NULL CHECK (purpose IN ('map_panel', 'story', 'mcp', 'research')),
  jurisdiction_id text REFERENCES bb_reference.jurisdictions (id),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, metric_id, purpose, jurisdiction_id)
);

CREATE INDEX IF NOT EXISTS entity_context_bindings_entity_idx
  ON bb_reference.entity_context_bindings (entity_id);

COMMENT ON TABLE bb_reference.statistical_series IS
  'Metric definitions (StatisticalSeries). Observations live in statistical_observations.';
COMMENT ON TABLE bb_reference.statistical_observations IS
  'As-reported estimates with provenance quartet. status is always observed.';
COMMENT ON TABLE bb_reference.derived_measurements IS
  'Derived or modeled values; never present as raw observations. Juxtaposition ≠ causation.';
COMMENT ON TABLE bb_reference.entity_context_bindings IS
  'Curatorial links from heritage entities to indicator series for map/story/MCP context.';

ALTER TABLE bb_reference.statistical_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_reference.statistical_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_reference.derived_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_reference.entity_context_bindings ENABLE ROW LEVEL SECURITY;

-- County/state/nation series are open for read (like acs_county_profiles).
-- Tract-level observations stay staff/research until bounded surfaces exist.
CREATE POLICY statistical_series_select ON bb_reference.statistical_series
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY statistical_observations_select_open ON bb_reference.statistical_observations
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bb_reference.statistical_series s
      WHERE s.metric_id = statistical_observations.metric_id
        AND s.geography_type IN ('county', 'state', 'nation')
    )
  );

CREATE POLICY statistical_observations_select_staff_tract ON bb_reference.statistical_observations
  FOR SELECT TO authenticated
  USING (
    bb_auth.has_any_role('admin', 'research', 'publication')
    AND EXISTS (
      SELECT 1 FROM bb_reference.statistical_series s
      WHERE s.metric_id = statistical_observations.metric_id
        AND s.geography_type IN ('tract', 'block', 'blockgroup', 'address', 'facility', 'school', 'city')
    )
  );

CREATE POLICY derived_measurements_select_staff ON bb_reference.derived_measurements
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));

CREATE POLICY entity_context_bindings_select_staff ON bb_reference.entity_context_bindings
  FOR SELECT TO authenticated
  USING (bb_auth.has_any_role('admin', 'research', 'publication'));
