-- Add PostGIS geography column for state jurisdiction containment checks.
-- Polygon fixtures are coarse bbox rectangles until Census TIGER load lands.

ALTER TABLE bb_reference.jurisdictions
  ADD COLUMN IF NOT EXISTS location geography(Polygon, 4326);

CREATE INDEX IF NOT EXISTS jurisdictions_location_gix
  ON bb_reference.jurisdictions
  USING GIST (location);
