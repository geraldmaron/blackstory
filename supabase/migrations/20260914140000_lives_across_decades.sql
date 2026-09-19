-- Lives Across the Decades (repo-0clax.5): storage for region x decade x group x class-tier
-- cells tabulated from IPUMS USA microdata, the per-decade geography definition behind each
-- region, and the in-force windows that bind laws and rulings to places and groups.
-- Method: docs/methodology/lives-across-decades.md. Copy rules:
-- docs/methodology/juxtaposition-not-causation.md.

-- 1. Regions are a published geography. A region is a jurisdiction row (kind 'region'),
--    upserted by the ingest script, whose extent per decade lives in
--    region_decade_definitions below.
ALTER TABLE bb_reference.statistical_series
  DROP CONSTRAINT IF EXISTS statistical_series_geography_type_check;
ALTER TABLE bb_reference.statistical_series
  ADD CONSTRAINT statistical_series_geography_type_check CHECK (geography_type IN (
    'tract', 'county', 'block', 'blockgroup', 'address', 'city', 'school',
    'facility', 'state', 'nation', 'region'
  ));

-- 2. 'tabulated' is BlackStory's own weighted count from licensed microdata. It is not a
--    figure the source published, so it must never read as 'observed'.
ALTER TABLE bb_reference.statistical_observations
  DROP CONSTRAINT IF EXISTS statistical_observations_status_check;
ALTER TABLE bb_reference.statistical_observations
  ADD CONSTRAINT statistical_observations_status_check
  CHECK (status IN ('observed', 'tabulated'));

COMMENT ON COLUMN bb_reference.statistical_observations.status IS
  'observed: as reported by the source dataset. tabulated: BlackStory''s own weighted count '
  'from licensed microdata (IPUMS USA), never presented as a source-published figure. '
  'See docs/methodology/lives-across-decades.md.';

-- Same access model as 20260723204100, with region cells readable alongside county,
-- state and nation.
DROP POLICY IF EXISTS statistical_observations_select
  ON bb_reference.statistical_observations;

CREATE POLICY statistical_observations_select
  ON bb_reference.statistical_observations
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bb_reference.statistical_series s
      WHERE s.metric_id = statistical_observations.metric_id
        AND s.geography_type IN ('county', 'state', 'nation', 'region')
    )
    OR (
      bb_auth.has_any_role('admin', 'research', 'publication')
      AND EXISTS (
        SELECT 1 FROM bb_reference.statistical_series s
        WHERE s.metric_id = statistical_observations.metric_id
          AND s.geography_type IN (
            'tract', 'block', 'blockgroup', 'address', 'facility', 'school', 'city'
          )
      )
    )
  );

-- 3. What a region meant in a given decade. IPUMS identifies metro areas differently by
--    decade (METAREA, partial 1970-2000 identification, MET2013/PUMA from 2012, no CITY in
--    1970), so every region-decade records its own rule and a required comparability note.
CREATE TABLE IF NOT EXISTS bb_reference.region_decade_definitions (
  region_id text NOT NULL REFERENCES bb_reference.jurisdictions (id),
  decade integer NOT NULL CHECK (decade BETWEEN 1850 AND 2030 AND decade % 10 = 0),
  reference_period text NOT NULL,
  ipums_samples text[] NOT NULL DEFAULT '{}',
  geo_rule jsonb NOT NULL,
  member_county_fips text[] NOT NULL DEFAULT '{}',
  boundary_version text NOT NULL UNIQUE,
  measurement_regime text NOT NULL CHECK (measurement_regime IN (
    'occupational_strata', 'earnings', 'sample_line_income', 'constructed_household_income',
    'household_income', 'acs_household_income', 'no_microdata'
  )),
  comparability_note text NOT NULL CHECK (length(btrim(comparability_note)) > 0),
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region_id, decade)
);

COMMENT ON TABLE bb_reference.region_decade_definitions IS
  'Per-decade geography rule, IPUMS samples, measurement regime and comparability note for a '
  'Lives Across the Decades region. coverage records, per metric x group x tier, whether the '
  'cell is published, wide_margin, suppressed or not_measured, with the reason.';

ALTER TABLE bb_reference.region_decade_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY region_decade_definitions_select
  ON bb_reference.region_decade_definitions
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR bb_auth.has_any_role('admin', 'research', 'publication'));

GRANT SELECT ON bb_reference.region_decade_definitions TO anon, authenticated;

-- 4. Which rules were in force for whom, where. statusHistory on law and case projections
--    is entity-lifecycle status only (see the scope guardrail in
--    packages/domain/src/entity-status.ts), so in-force windows live here, taken from cited
--    claims. EDTF strings are the lexical source of truth and in_force_span is the derived
--    proleptic-Gregorian range, maintained by the write path (20260729193000 convention).
CREATE TABLE IF NOT EXISTS bb_reference.law_applicability (
  id text PRIMARY KEY,
  entity_id text NOT NULL,
  jurisdiction_id text NOT NULL REFERENCES bb_reference.jurisdictions (id),
  scope_level text NOT NULL CHECK (scope_level IN ('federal', 'state', 'local')),
  in_force_from_edtf text NOT NULL,
  in_force_to_edtf text,
  in_force_span daterange NOT NULL CHECK (NOT isempty(in_force_span)),
  date_precision text NOT NULL CHECK (date_precision IN ('day', 'month', 'year')),
  groups_named text[] NOT NULL DEFAULT '{}',
  applies_to_slices text[] NOT NULL CHECK (
    cardinality(applies_to_slices) > 0
    AND applies_to_slices <@ ARRAY['black_nh', 'white_nh', 'hispanic', 'all']::text[]
  ),
  life_domains text[] NOT NULL CHECK (
    cardinality(life_domains) > 0
    AND life_domains <@ ARRAY[
      'housing', 'credit', 'schooling', 'work', 'income_support', 'voting', 'justice',
      'family', 'public_accommodation', 'immigration'
    ]::text[]
  ),
  text_posture text NOT NULL CHECK (text_posture IN (
    'exclusionary', 'protective', 'facially_neutral'
  )),
  disputed boolean NOT NULL DEFAULT false,
  basis_claim_ids text[] NOT NULL CHECK (cardinality(basis_claim_ids) > 0),
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bb_reference.law_applicability IS
  'In-force window of a law or ruling for a jurisdiction and the groups and life domains it '
  'touched. Juxtaposition only: a row never asserts that the rule caused an indicator value. '
  'groups_named quotes the rule''s own words; disputed marks rules whose racial effect is a '
  'live scholarly dispute and must render as a dispute.';

CREATE INDEX IF NOT EXISTS law_applicability_span_gist_idx
  ON bb_reference.law_applicability USING gist (in_force_span);
CREATE INDEX IF NOT EXISTS law_applicability_jurisdiction_idx
  ON bb_reference.law_applicability (jurisdiction_id);
CREATE INDEX IF NOT EXISTS law_applicability_entity_idx
  ON bb_reference.law_applicability (entity_id);

ALTER TABLE bb_reference.law_applicability ENABLE ROW LEVEL SECURITY;

CREATE POLICY law_applicability_select
  ON bb_reference.law_applicability
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR bb_auth.has_any_role('admin', 'research', 'publication'));

GRANT SELECT ON bb_reference.law_applicability TO anon, authenticated;
