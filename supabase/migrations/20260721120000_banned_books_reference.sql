-- banned_books_reference: bb_reference banned books catalog + challenge reports (curated; public SELECT).
-- Listing snapshot key `bannedBooksListing` is stored in existing bb_public.materialized_snapshots
-- (name row; no schema change required for that publication surface).

CREATE TABLE bb_reference.banned_books (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL,
  published_date text NOT NULL,
  purchase_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  canonical_entity_id text,
  source text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banned_books_slug_kebab CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT banned_books_description_len CHECK (char_length(description) BETWEEN 40 AND 600)
);

CREATE TABLE bb_reference.banned_book_challenges (
  id text PRIMARY KEY,
  book_id text NOT NULL REFERENCES bb_reference.banned_books (id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  jurisdiction_label text,
  school_year text,
  challenge_year integer,
  status text NOT NULL CHECK (status IN ('reported', 'rescinded', 'unknown')),
  citation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX banned_book_challenges_book_id_idx ON bb_reference.banned_book_challenges (book_id);
CREATE INDEX banned_book_challenges_state_idx ON bb_reference.banned_book_challenges (state);

ALTER TABLE bb_reference.banned_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_reference.banned_book_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY banned_books_select ON bb_reference.banned_books
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY banned_book_challenges_select ON bb_reference.banned_book_challenges
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON bb_reference.banned_books TO anon, authenticated, service_role;
GRANT SELECT ON bb_reference.banned_book_challenges TO anon, authenticated, service_role;
GRANT ALL ON bb_reference.banned_books TO service_role;
GRANT ALL ON bb_reference.banned_book_challenges TO service_role;
