-- Legal publishing spine: a Supabase home for the statute/case document surface
-- that until now lived only in apps/web/src/data/legal-seed.ts.
--
-- Mirrors bb_reference.articles / bb_public.release_articles exactly:
-- bb_reference.legal_snapshots is the authoring table (draft/review/published),
-- bb_public.release_legal_snapshots carries frozen, release-scoped projections
-- that anon reads through the active-release RLS pattern.
--
-- This is NOT a duplicate of release_entities kind='law'. Those are entity
-- records (identity, claims, relationships); a legal snapshot is the *document*
-- record for one statute/case — its canonical citation, archive capture, and the
-- plain-language explainer shown on /law. The two are linked by
-- canonical_entity_id, the same way an article links to related entities.
--
-- canonical_entity_id is nullable on purpose. The seed carried its own
-- `ent_seed_law_*` id namespace, which exists nowhere in Supabase; 9 of the 12
-- seed rows map cleanly onto real ent_law_* / ent_case_* entities, and 3
-- (42-usc-1983, title-vii-cfr-part-1604, georgia-sb202-2021) have no canonical
-- entity yet. Publishing those entities is a separate decision, so they land here
-- unlinked rather than blocking the migration or inventing ids.

CREATE TABLE IF NOT EXISTS bb_reference.legal_snapshots (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL,
  kind text NOT NULL,
  law_status text NOT NULL,
  jurisdiction_id text NOT NULL,
  topics text[] NOT NULL DEFAULT '{}',
  citation jsonb NOT NULL,
  explainer jsonb,
  fact_id text,
  canonical_entity_id text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  row_updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bb_reference.legal_snapshots IS
  'Authoring table for statute/case documents (the /law surface). citation carries '
  'the canonical citation plus archive capture; explainer carries the '
  'plain-language whatItSays/whatItMeans/whyItMatters/rightsToday editorial block. '
  'canonical_entity_id links to bb_public.release_entities where an entity exists.';

CREATE INDEX IF NOT EXISTS legal_snapshots_entity_idx
  ON bb_reference.legal_snapshots (canonical_entity_id);

CREATE TABLE IF NOT EXISTS bb_public.release_legal_snapshots (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  snapshot_id text NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  canonical_entity_id text,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, snapshot_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS release_legal_snapshots_slug_idx
  ON bb_public.release_legal_snapshots (release_id, slug);

COMMENT ON TABLE bb_public.release_legal_snapshots IS
  'Frozen legal snapshot projections per release. payload is the full public '
  'document; content_hash guards drift audits against bb_reference.legal_snapshots.';

ALTER TABLE bb_reference.legal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_public.release_legal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_snapshots_select ON bb_reference.legal_snapshots
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY release_legal_snapshots_select_active
  ON bb_public.release_legal_snapshots
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

REVOKE UPDATE, DELETE ON bb_public.release_legal_snapshots
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON bb_reference.legal_snapshots TO anon, authenticated;
GRANT SELECT ON bb_public.release_legal_snapshots TO anon, authenticated;
GRANT ALL ON bb_reference.legal_snapshots TO service_role;
GRANT ALL ON bb_public.release_legal_snapshots TO service_role;
