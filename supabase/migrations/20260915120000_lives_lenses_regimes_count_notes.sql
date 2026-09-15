-- Lives Across the Decades, revised method (repo-0clax.19, repo-0clax.20).
-- Method: docs/methodology/lives-across-decades.md. Plan: docs/research/lives-regions-and-sources.md.
--
-- 1. Lenses follow each era's published definitions, so rule applicability names lenses
--    (black, white, hispanic) instead of the non-Hispanic slices that pre-1980 tables never published.
ALTER TABLE bb_reference.law_applicability
  DROP CONSTRAINT IF EXISTS law_applicability_applies_to_slices_check;

UPDATE bb_reference.law_applicability AS rule
SET applies_to_slices = remapped.slices,
    updated_at = now()
FROM (
  SELECT id,
         array_agg(
           CASE slice WHEN 'black_nh' THEN 'black' WHEN 'white_nh' THEN 'white' ELSE slice END
           ORDER BY position
         ) AS slices
  FROM bb_reference.law_applicability,
       unnest(applies_to_slices) WITH ORDINALITY AS t(slice, position)
  GROUP BY id
) AS remapped
WHERE rule.id = remapped.id
  AND rule.applies_to_slices && ARRAY['black_nh', 'white_nh']::text[];

ALTER TABLE bb_reference.law_applicability
  ADD CONSTRAINT law_applicability_applies_to_slices_check CHECK (
    cardinality(applies_to_slices) > 0
    AND applies_to_slices <@ ARRAY['black', 'white', 'hispanic', 'all']::text[]
  );

-- 2. Class regimes come from published tables rather than microdata.
ALTER TABLE bb_reference.region_decade_definitions
  DROP CONSTRAINT IF EXISTS region_decade_definitions_measurement_regime_check;
ALTER TABLE bb_reference.region_decade_definitions
  ADD CONSTRAINT region_decade_definitions_measurement_regime_check CHECK (measurement_regime IN (
    'work_based', 'wage_income', 'family_income', 'household_income', 'acs_household_income'
  ));

-- 3. What the count could see: sourced notes per decade on how the census counted each group, what it
--    could not see, and what that meant. A missing figure links to the note that explains it.
CREATE TABLE IF NOT EXISTS bb_reference.lives_count_notes (
  id text PRIMARY KEY,
  decade integer NOT NULL CHECK (decade BETWEEN 1870 AND 2020 AND decade % 10 = 0),
  applies_to text[] NOT NULL CHECK (
    cardinality(applies_to) > 0
    AND applies_to <@ ARRAY['black', 'white', 'hispanic', 'all']::text[]
  ),
  area_ids text[] NOT NULL DEFAULT '{}',
  heading text NOT NULL CHECK (length(btrim(heading)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  citations jsonb NOT NULL CHECK (
    jsonb_typeof(citations) = 'array' AND jsonb_array_length(citations) > 0
  ),
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bb_reference.lives_count_notes IS
  'Lives Across the Decades: sourced notes per decade on how the census counted Black, white and '
  'Hispanic Americans, what it could not see, and what that meant. citations is an array of '
  '{label, url}; every note needs at least one opened source.';

CREATE INDEX IF NOT EXISTS lives_count_notes_decade_idx
  ON bb_reference.lives_count_notes (decade, sort_order);

ALTER TABLE bb_reference.lives_count_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY lives_count_notes_select
  ON bb_reference.lives_count_notes
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR bb_auth.has_any_role('admin', 'research', 'publication'));

GRANT SELECT ON bb_reference.lives_count_notes TO anon, authenticated;
