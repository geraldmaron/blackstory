-- Allow presumed_deceased living status (WP:BDP plausibility token, WS3).
ALTER TABLE bb_canonical.entities
  DROP CONSTRAINT IF EXISTS entities_living_status_check;

ALTER TABLE bb_canonical.entities
  ADD CONSTRAINT entities_living_status_check
  CHECK (living_status IN ('living', 'deceased', 'presumed_deceased', 'unknown', 'not_applicable'));
