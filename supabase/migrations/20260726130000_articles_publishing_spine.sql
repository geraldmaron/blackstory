-- Articles publishing spine: the single long-form publication surface that
-- replaces the split /themes + /stories + /topics presentation.
--
-- bb_reference.articles is the authoring table (draft/review/published),
-- mirroring bb_reference.theme_impact_packets. bb_public.release_articles
-- carries frozen, release-scoped projections that anon reads through the
-- active-release RLS pattern. An article's body blocks reference theme-impact
-- packets by packet_id; those packets keep their own reference/release tables.

CREATE TABLE IF NOT EXISTS bb_reference.articles (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL,
  summary text NOT NULL,
  theme_id text,
  era_label text NOT NULL,
  place_label text NOT NULL,
  published_at date NOT NULL,
  updated_at date,
  hero_image jsonb,
  body jsonb NOT NULL,
  "references" jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_entity_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  row_updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bb_reference.articles IS
  'Authoring table for long-form Articles (the /articles surface). Body is a '
  'typed block array; body figure/stat/document blocks reference '
  'bb_reference.theme_impact_packets by packet id.';

CREATE TABLE IF NOT EXISTS bb_public.release_articles (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  article_id text NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  theme_id text,
  published_at date NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, article_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS release_articles_slug_idx
  ON bb_public.release_articles (release_id, slug);

COMMENT ON TABLE bb_public.release_articles IS
  'Frozen Article projections per release. payload is the full public article '
  'document; content_hash guards drift audits against bb_reference.articles.';

ALTER TABLE bb_public.release_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY release_articles_select_active
  ON bb_public.release_articles
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

REVOKE UPDATE, DELETE ON bb_public.release_articles
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON bb_public.release_articles TO anon, authenticated;
