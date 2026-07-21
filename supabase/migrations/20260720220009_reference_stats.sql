-- 0009_reference_stats: jurisdictions and published statistics with provenance quartet.

CREATE TABLE bb_reference.jurisdictions (
  id text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  state_fips text,
  county_fips text,
  parent_id text REFERENCES bb_reference.jurisdictions (id),
  geohash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_reference.census_county_decades (
  id text PRIMARY KEY,
  fips5 text NOT NULL,
  decade integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fips5, decade)
);

CREATE TABLE bb_reference.census_national_decades (
  id text PRIMARY KEY,
  decade integer NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_reference.census_state_decades (
  id text PRIMARY KEY,
  state_fips text NOT NULL,
  decade integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_fips, decade)
);

CREATE TABLE bb_reference.census_county_historical_decades (
  id text PRIMARY KEY,
  gis_join text NOT NULL,
  decade integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gis_join, decade)
);

CREATE TABLE bb_reference.acs_county_profiles (
  id text PRIMARY KEY,
  fips5 text NOT NULL,
  vintage integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fips5, vintage)
);

CREATE TABLE bb_reference.acs_tract_profiles (
  id text PRIMARY KEY,
  geoid11 text NOT NULL,
  vintage integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (geoid11, vintage)
);

CREATE TABLE bb_reference.ucr_agencies (
  id text PRIMARY KEY,
  ori text NOT NULL UNIQUE,
  county_fips text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_reference.opportunity_atlas_tracts (
  id text PRIMARY KEY,
  geoid11 text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bb_reference.hate_crime_county_years (
  id text PRIMARY KEY,
  fips5 text NOT NULL,
  year integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fips5, year)
);

CREATE TABLE bb_reference.ucr_state_participation (
  id text PRIMARY KEY,
  state text NOT NULL,
  year integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state, year)
);

CREATE TABLE bb_reference.holc_areas (
  id text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry jsonb,
  location geography(MultiPolygon, 4326),
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
