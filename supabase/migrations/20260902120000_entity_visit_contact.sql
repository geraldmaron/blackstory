-- repo-el9p (WS3): public contract for "a reader can physically go to a place" — a structured
-- address at the precision the location-precision standard allows, phone, website, hours, and
-- visitability. Today these are claim-mined at web render time
-- (apps/web/src/lib/geography/public-visit-contact.ts) and there is no address street column
-- anywhere: bb_canonical.entity_locations carries only label/precision/geometry, never street.
--
-- Purely additive. Nullable columns and a new table; no existing row, constraint, or read path
-- is touched. The release builder (packages/domain/src/publication/release-builder.ts) reads
-- these through `publicVisitForTier` (packages/domain/src/geography/visit.ts), which is the
-- single gate deciding what a public projection may actually carry — this migration only adds
-- the storage, it makes no publication decision itself.

ALTER TABLE bb_canonical.entity_locations
  ADD COLUMN street text,
  ADD COLUMN postal_code text;

CREATE TABLE bb_canonical.entity_visit (
  entity_id text PRIMARY KEY REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  phone_e164 text,
  phone_display text,
  website text,
  hours text,
  visitability text
    CHECK (visitability IN ('open_to_public', 'exterior_only', 'private', 'demolished', 'unknown')),
  source_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entity_visit_visitability_idx ON bb_canonical.entity_visit (visitability)
  WHERE visitability IS NOT NULL;
