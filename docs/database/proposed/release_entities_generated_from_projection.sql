-- NOT YET APPLIED, AND NOT IN supabase/migrations/ ON PURPOSE.
--
-- This migration CANNOT land on its own. Postgres refuses any INSERT or UPDATE that supplies a
-- value for a generated column, and `toReleaseEntityRow` in
-- packages/ops-data/scripts/lib/incremental-publish.ts plus the three upsert statements in
-- publish-release-entities-incremental.ts all write the eleven columns it converts. Apply this
-- without that TypeScript change and the next publish fails. Apply that change without this and
-- the columns stop being written at all. They go together, in one commit, with the migration run
-- against the live database in the same session.
--
-- It lives here rather than in supabase/migrations/ so a `supabase db push` cannot pick it up
-- half-finished. Move it back when the TypeScript half is ready.
--
-- ALREADY VERIFIED, 2026-09-13, so the next session does not redo it:
--   * The whole body was run against the live database inside BEGIN ... ROLLBACK. It completes.
--   * After it, on all 4,195 active-release rows: primary_image goes 146 -> 1,649 populated
--     (matching the projection exactly), taxonomy carries notabilityLabels on 4,195 rows instead
--     of 3,144, campaignIds on 13 instead of 6, display_name and kind are NOT NULL on every row,
--     and 4,191 of 4,195 carry lat (the 4 without are the rows with no location).
--   * jsonb_build_object is STABLE, not IMMUTABLE, so Postgres rejects it in a generation
--     expression. The taxonomy expression below is nested jsonb_set and `||` for that reason. Do
--     not "simplify" it back; it will not compile.
--   * Both dependent views are dropped and recreated here. bb_ops.coverage_gap_by_county_decade
--     is easy to miss: it reads re.location, so DROP COLUMN refuses while it exists.
--
-- The remaining work is the TypeScript half plus a test that pins the new row shape, tracked on
-- its own bead.

-- Make the eleven derived columns on bb_public.release_entities generated from `projection`, so
-- the drift they have produced for months becomes impossible to express rather than something a
-- repair script chases after the fact.
--
-- THE PROBLEM, MEASURED 2026-09-13 ON THE ACTIVE RELEASE (rel_20260723_authority_net_001, 4,195
-- rows). audit-projection-divergence.ts reports 2,418 divergent rows carrying 3,225 divergences:
--
--     primary_image   1,518   of which 1,503 are "the projection has an image, the column is NULL"
--     taxonomy        1,117   of which 1,051 are "the projection has notabilityLabels, the column
--                             has none"
--     summary             1
--     claims              2
--
-- and the direction is never the other way. The derived copies are systematically BEHIND the
-- projection, never ahead of it, which is the signature of a write that landed on one store and
-- not the other. primary_image is the clearest case: `toReleaseEntityRow` does not write that
-- column at all, so every image published since the incremental publisher took over exists only
-- in the projection. Only 146 rows carry the column, against 1,649 in the projection.
--
-- WHY IT MATTERS TO A READER, which is the part that makes this more than hygiene. The web and
-- api-public read paths SELECT `projection` and nothing else, so they were never wrong. But
-- `public.published_entities` — the PostgREST surface for attested clients, recovered under
-- "PostgREST published-read surface" in docs/decisions-carryover.md — selects the COLUMNS. So two
-- public surfaces of the same release have been serving different answers, and the one serving
-- the stale answer is the one nobody on this project looks at.
--
-- WHY GENERATED COLUMNS RATHER THAN ANOTHER RESYNC SCRIPT. There are already twenty-four scripts
-- that write these columns, five of which exist for no other purpose than to repair them
-- (release-taxonomy-sync, release-related-sync, notability-basis-resync,
-- resync-release-location-precision, backfill-release-related-empty-array). A twenty-fifth would
-- fix today's 3,225 and not tomorrow's. A generated column removes the class: the value is a
-- function of `projection`, evaluated by Postgres, and there is no longer a write path that can
-- disagree with it.
--
-- WHY NOT DROP THE COLUMNS INSTEAD, which is cheaper on storage (they cost 7.3MB of a 42MB table).
-- Two reasons. `public.published_entities` is consumed by clients outside this repository, by
-- design, so its shape is not ours to change silently. And two indexes —
-- release_entities_geohash_idx and release_entities_release_display_name_lower_idx — are defined
-- on these columns; they support no query today, but dropping the columns would remove the option
-- without anyone deciding to.
--
-- STORED, not VIRTUAL: this is PostgreSQL 17.6 and virtual generated columns arrive in 18.
--
-- WHAT THIS CHANGES ABOUT WRITES, deliberately. Postgres refuses any INSERT or UPDATE that
-- supplies a value for a generated column. So the twenty-four scripts above now fail loudly
-- instead of quietly writing a store no reader serves. That is the point: a script that wrote the
-- column without the projection was never taking effect for readers, and the five repair scripts
-- have nothing left to repair. `toReleaseEntityRow` and the three upsert statements in
-- publish-release-entities-incremental.ts are updated in the same change.
--
-- VERIFIED BEFORE WRITING: each expression below was run as a SELECT against all 4,195 live rows
-- and compared to the column it replaces. display_name, kind, location, geohash, lat, lng and
-- related match on every row; summary differs on 1, claims on 2, primary_image on 1,518 and
-- taxonomy on 1,117 — exactly the divergences being corrected, in the direction that adopts the
-- projection's value. Nothing else moves.
--
-- ONE DELIBERATE DATA LOSS, worth naming. Twelve rows carry topicIds in the taxonomy column that
-- the projection does not have, so those ids disappear here. They are not newer truth: they are
-- what repo-5rt81 already records as a stale column, and the sample includes "commerce-clause" and
-- "eugenics" on a DC historic site — tags from an old pass, not registry topics for that record.
-- Readers have never seen them, because readers read the projection.

BEGIN;

-- Two views select the columns being replaced, so both have to go first and come back after.
-- Postgres refuses DROP COLUMN while a view depends on it, and CASCADE would drop them silently.
-- Both are recreated below with their definitions, options and grants unchanged.
DROP VIEW IF EXISTS public.published_entities;
DROP VIEW IF EXISTS bb_ops.coverage_gap_by_county_decade;

ALTER TABLE bb_public.release_entities
  DROP COLUMN display_name,
  DROP COLUMN kind,
  DROP COLUMN summary,
  DROP COLUMN location,
  DROP COLUMN geohash,
  DROP COLUMN lat,
  DROP COLUMN lng,
  DROP COLUMN claims,
  DROP COLUMN taxonomy,
  DROP COLUMN related,
  DROP COLUMN primary_image;

-- Every expression is immutable (jsonb operators and the text casts both are), which is what a
-- STORED generated column requires.
--
-- The NOT NULL columns take a COALESCE rather than trusting the projection to carry the key:
-- `claims`, `taxonomy` and `related` were NOT NULL before and stay that way, and a projection
-- without the key would otherwise fail the constraint on write.
--
-- `taxonomy` is built from the projection's own fields rather than copied, because the old
-- column's shape was whatever the last pass to touch it happened to write: topicIds and topicTags
-- on all 4,195 rows, notabilityLabels on 3,144, campaignIds on 6. Building it makes the shape a
-- rule instead of an accident. topicIds and topicTags are always present (empty array when the
-- projection has none); notabilityLabels appears only when the projection carries the key, and
-- campaignIds only when non-empty, both matching how the column carried them.
--
-- It reads awkwardly, as nested jsonb_set and `||` rather than one jsonb_build_object call, and
-- that is forced: jsonb_build_object is STABLE, not IMMUTABLE (it resolves output functions for
-- its arguments), so Postgres rejects it in a generation expression with "generation expression is
-- not immutable". jsonb_set, `||`, `?` and jsonb_array_length are all immutable. Do not "simplify"
-- this back to jsonb_build_object; it will not compile.
ALTER TABLE bb_public.release_entities
  ADD COLUMN display_name text NOT NULL
    GENERATED ALWAYS AS (projection ->> 'displayName') STORED,
  ADD COLUMN kind text NOT NULL
    GENERATED ALWAYS AS (projection ->> 'kind') STORED,
  ADD COLUMN summary text
    GENERATED ALWAYS AS (projection ->> 'summary') STORED,
  ADD COLUMN location jsonb
    GENERATED ALWAYS AS (projection -> 'location') STORED,
  ADD COLUMN geohash text
    GENERATED ALWAYS AS (projection -> 'location' ->> 'geohash') STORED,
  ADD COLUMN lat double precision
    GENERATED ALWAYS AS ((projection -> 'location' ->> 'lat')::double precision) STORED,
  ADD COLUMN lng double precision
    GENERATED ALWAYS AS ((projection -> 'location' ->> 'lng')::double precision) STORED,
  ADD COLUMN claims jsonb NOT NULL
    GENERATED ALWAYS AS (COALESCE(projection -> 'claims', '[]'::jsonb)) STORED,
  ADD COLUMN related jsonb NOT NULL
    GENERATED ALWAYS AS (COALESCE(projection -> 'related', '[]'::jsonb)) STORED,
  ADD COLUMN primary_image jsonb
    GENERATED ALWAYS AS (projection -> 'primaryImage') STORED,
  ADD COLUMN taxonomy jsonb NOT NULL
    GENERATED ALWAYS AS (
      jsonb_set(
        jsonb_set(
          '{}'::jsonb,
          '{topicIds}',
          COALESCE(projection -> 'topicIds', '[]'::jsonb)
        ),
        '{topicTags}',
        COALESCE(projection -> 'topicTags', '[]'::jsonb)
      )
      || CASE
           WHEN projection ? 'notabilityLabels'
             THEN jsonb_set('{}'::jsonb, '{notabilityLabels}', projection -> 'notabilityLabels')
           ELSE '{}'::jsonb
         END
      || CASE
           WHEN jsonb_array_length(COALESCE(projection -> 'campaignIds', '[]'::jsonb)) > 0
             THEN jsonb_set('{}'::jsonb, '{campaignIds}', projection -> 'campaignIds')
           ELSE '{}'::jsonb
         END
    ) STORED;

-- Dropping the columns dropped these with them. Recreated with the same definitions
-- (supabase/migrations/20260720220008_publication_public.sql and its successors).
CREATE INDEX IF NOT EXISTS release_entities_geohash_idx
  ON bb_public.release_entities (release_id, geohash);
CREATE INDEX IF NOT EXISTS release_entities_release_display_name_lower_idx
  ON bb_public.release_entities (release_id, lower(display_name));

-- Recreated verbatim from its pre-migration definition. security_invoker stays true so
-- bb_public's RLS remains the fail-closed gate rather than the view.
CREATE VIEW public.published_entities
  WITH (security_invoker = true) AS
  SELECT
    release_id,
    entity_id,
    display_name,
    kind,
    summary,
    location,
    geohash,
    lat,
    lng,
    claims,
    taxonomy,
    related,
    primary_image,
    projection,
    created_at
  FROM bb_public.release_entities re
  WHERE release_id = (
    SELECT ar.release_id FROM bb_public.active_release ar WHERE ar.id = 'active'
  );

-- Matches the grants the view carried before: SELECT for the two public roles, and service_role's
-- full set, which it holds on everything in this schema by default.
GRANT SELECT ON public.published_entities TO anon, authenticated;
GRANT ALL ON public.published_entities TO service_role;

COMMENT ON VIEW public.published_entities IS
  'Active-release public read surface for attested PostgREST clients. Every column but projection, '
  'entity_id, release_id and created_at is GENERATED from projection, so this view and the '
  'projection the web and API read paths serve cannot disagree.';

-- Recreated verbatim, including security_invoker=false (it is a staff/service view whose own
-- WHERE clause is the gate, not the caller's RLS) and the COALESCE that reads `location` first and
-- falls back to the projection. That fallback is now redundant, since `location` IS the
-- projection, but it is left alone: removing it is a behavior question for coverage targeting
-- (repo-93p35.23), not part of this change.
CREATE VIEW bb_ops.coverage_gap_by_county_decade AS
  WITH county_entity_counts AS (
    SELECT
      COALESCE(
        NULLIF(re.location ->> 'countyFips', ''),
        NULLIF(re.projection -> 'county' ->> 'fipsCode', '')
      ) AS fips5,
      count(*) AS entity_count
    FROM bb_public.release_entities re
    WHERE re.release_id = (
      SELECT ar.release_id FROM bb_public.active_release ar WHERE ar.id = 'active'
    )
    GROUP BY 1
  )
  SELECT
    c.fips5,
    c.decade,
    COALESCE((c.payload ->> 'blackPopulation')::bigint, 0::bigint) AS black_population,
    COALESCE(e.entity_count, 0::bigint) AS entity_count,
    CASE
      WHEN COALESCE((c.payload ->> 'blackPopulation')::bigint, 0::bigint) > 0
        THEN round(COALESCE(e.entity_count, 0::bigint)::numeric / (c.payload ->> 'blackPopulation')::numeric, 9)
      ELSE NULL::numeric
    END AS coverage_ratio,
    c.source,
    c.retrieved_at
  FROM bb_reference.census_county_decades c
  LEFT JOIN county_entity_counts e ON e.fips5 = c.fips5
  WHERE bb_auth.is_staff() OR (auth.jwt() ->> 'role') = 'service_role';

GRANT SELECT ON bb_ops.coverage_gap_by_county_decade TO authenticated;
GRANT ALL ON bb_ops.coverage_gap_by_county_decade TO service_role;

COMMIT;
