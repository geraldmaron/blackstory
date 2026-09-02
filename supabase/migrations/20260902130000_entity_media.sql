-- repo-4vuf (WS5): canonical home for pinned entity media.
--
-- pin-commons-primary-images.ts (and its NRHP/QID-leftover feeder plans) previously wrote
-- primaryImage only onto the Firestore active-release projection. Supabase Postgres is the sole
-- source of truth (bb_public.release_entities.projection is what the web reads; see
-- docs/data/firebase-wind-down.md) and nothing wrote primaryImage into Postgres — the Firestore
-- write was silently discarded by every reader. This migration adds the canonical table; the
-- apply path (packages/ops-data/scripts/pin-commons-primary-images.ts) upserts here AND patches
-- bb_public.release_entities.projection in the same transaction, matching the two-copy write
-- pattern backfill-nrhp-addresses.ts already uses for entity_locations / release_entities.
--
-- entity_id is a real FK (unlike bb_research.entity_evidence's deliberately-unconstrained text
-- join): this table is only ever written for entities already promoted into bb_canonical, never
-- for landscape-candidate-only rows, so ON DELETE CASCADE is safe and desired.
--
-- role + primary key (entity_id, role): one canonical media row per entity per role today
-- ('primary' is the only role this script writes), leaving room for a future 'gallery'/'og'
-- role without a schema change.
CREATE TABLE bb_canonical.entity_media (
  entity_id text NOT NULL REFERENCES bb_canonical.entities (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary',
  source_system text,
  file_title text,
  sha1 text,
  source_page_url text,
  license text,
  credit text,
  alt text,
  url text NOT NULL,
  pinned_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, role)
);

CREATE INDEX entity_media_entity_idx ON bb_canonical.entity_media (entity_id);

ALTER TABLE bb_canonical.entity_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_media_staff_select ON bb_canonical.entity_media
  FOR SELECT TO authenticated
  USING ((SELECT bb_auth.is_staff()));

REVOKE INSERT, UPDATE, DELETE ON bb_canonical.entity_media FROM authenticated;
GRANT SELECT ON bb_canonical.entity_media TO authenticated;
GRANT ALL ON bb_canonical.entity_media TO service_role;
