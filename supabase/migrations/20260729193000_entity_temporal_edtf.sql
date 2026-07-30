-- Additive EDTF Level 1 temporal columns beside existing plain-date index fields.
-- EDTF strings are the lexical source of truth; valid_from/valid_to dates and valid_span
-- are derived earliest/latest bounds maintained at write time by application code.
--
-- Calendar model: all bounds are stored and indexed on the proleptic Gregorian calendar.
-- Pre-1583 (Julian) and pre-1752 (British colonies) historical dates are recorded as
-- civil-calendar EDTF strings without retroactive calendar reform — overlap queries
-- compare nominal year/month/day, not astronomical instants.

ALTER TABLE bb_canonical.entity_locations
  ADD COLUMN IF NOT EXISTS valid_from_edtf text,
  ADD COLUMN IF NOT EXISTS valid_to_edtf text,
  ADD COLUMN IF NOT EXISTS valid_span daterange;

COMMENT ON COLUMN bb_canonical.entity_locations.valid_from_edtf IS
  'EDTF Level 1 lower bound (inclusive). Source of truth for location tenure start; '
  'valid_from date is a derived earliest-bound index column rebuildable from this string.';

COMMENT ON COLUMN bb_canonical.entity_locations.valid_to_edtf IS
  'EDTF Level 1 upper bound (inclusive). Source of truth for location tenure end; '
  'valid_to date is a derived latest-bound index column rebuildable from this string.';

COMMENT ON COLUMN bb_canonical.entity_locations.valid_span IS
  'Derived [earliest, latest] daterange from valid_from_edtf/valid_to_edtf bounds '
  '(proleptic Gregorian). Maintained by application write path, not triggers.';

ALTER TABLE bb_canonical.entity_relationships
  ADD COLUMN IF NOT EXISTS valid_from_edtf text,
  ADD COLUMN IF NOT EXISTS valid_to_edtf text,
  ADD COLUMN IF NOT EXISTS valid_span daterange;

COMMENT ON COLUMN bb_canonical.entity_relationships.valid_from_edtf IS
  'EDTF Level 1 lower bound (inclusive). Source of truth for relationship tenure start; '
  'valid_from date is a derived earliest-bound index column rebuildable from this string.';

COMMENT ON COLUMN bb_canonical.entity_relationships.valid_to_edtf IS
  'EDTF Level 1 upper bound (inclusive). Source of truth for relationship tenure end; '
  'valid_to date is a derived latest-bound index column rebuildable from this string.';

COMMENT ON COLUMN bb_canonical.entity_relationships.valid_span IS
  'Derived [earliest, latest] daterange from valid_from_edtf/valid_to_edtf bounds '
  '(proleptic Gregorian). Maintained by application write path, not triggers.';

COMMENT ON COLUMN bb_canonical.entities.kind_detail IS
  'Kind-specific structured detail. Temporal EDTF keys (application-maintained, not SQL-validated): '
  'person — birth_edtf, death_edtf, death_date_state (''unknown_value'' when Wikidata somevalue '
  'marks deceased with no date); non-person — begin_edtf, end_edtf (Wikidata P571/P576 shape). '
  'EDTF strings are source of truth; plain year/date fields elsewhere are derived index columns.';

CREATE INDEX IF NOT EXISTS entity_locations_valid_span_gist_idx
  ON bb_canonical.entity_locations USING gist (valid_span)
  WHERE valid_span IS NOT NULL;

CREATE INDEX IF NOT EXISTS entity_relationships_valid_span_gist_idx
  ON bb_canonical.entity_relationships USING gist (valid_span)
  WHERE valid_span IS NOT NULL;
