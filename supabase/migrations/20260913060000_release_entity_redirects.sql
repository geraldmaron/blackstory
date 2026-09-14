-- repo-n7p6.29: publish the absorbed -> survivor map into bb_public so a merged-away entity URL
-- can redirect instead of dying.
--
-- The merge ledger (bb_canonical.entity_merges / entity_merge_absorbed, and entities.merge_state)
-- is staff-only: its RLS policies are `bb_auth.has_any_role('admin','research','publication')`, and
-- apps/web + apps/api-public read bb_public exclusively. repo-n7p6.15 correctly stopped publishing
-- absorbed records (reconcile-absorbed-entities.ts deletes their bb_public.release_entities and
-- bb_public.search_index rows), but that left /entity/ent_sclc_001 and /entity/ent_sncc_001 — URLs
-- that were publicly resolvable and are in search-engine indexes — with nothing to resolve to.
--
-- Shape follows the other published release surfaces (release_entities, search_index,
-- release_graph_*): release-scoped rows, a FK onto bb_publication.releases, and a SELECT policy
-- that exposes only the active release. A release-scoped TABLE rather than a field on the release
-- because the map is per-absorbed-id, not per-release: 16 active merges today (measured
-- 2026-09-13) and one row per merge as the corpus is deduped, which a single release-level jsonb
-- blob would make awkward to point-read and to write incrementally.
--
-- `to_entity_id` carries the FULLY RESOLVED survivor, not the immediate one. A merge chain
-- (A -> B, then B -> C) is walked to its terminal survivor by the publisher
-- (packages/ops-data/scripts/reconcile-absorbed-entities.ts `loadActiveMerges`), so a reader is a
-- single point-get and can never loop. The CHECK below is the last line of defense against a
-- self-redirect; it cannot see a longer cycle, which is why the publisher detects those and
-- refuses rather than writing them.
--
-- No `mark_release_catalog_dirty` trigger: redirects are not part of the CDN catalog artifacts
-- (entities.json / search-index.json), so a redirect write must not force a 13MB republish.
CREATE TABLE IF NOT EXISTS bb_public.release_entity_redirects (
  release_id text NOT NULL REFERENCES bb_publication.releases (id),
  from_entity_id text NOT NULL,
  to_entity_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, from_entity_id),
  CONSTRAINT release_entity_redirects_no_self_redirect CHECK (from_entity_id <> to_entity_id)
);

-- Reverse lookup: "what redirects at this survivor", used when auditing a merge.
CREATE INDEX IF NOT EXISTS release_entity_redirects_target_idx
  ON bb_public.release_entity_redirects (release_id, to_entity_id);

ALTER TABLE bb_public.release_entity_redirects ENABLE ROW LEVEL SECURITY;

-- Same active-release visibility rule as release_entities / search_index
-- (supabase/migrations/20260720220010_rls_policies.sql).
DROP POLICY IF EXISTS release_entity_redirects_select_active ON bb_public.release_entity_redirects;
CREATE POLICY release_entity_redirects_select_active ON bb_public.release_entity_redirects
  FOR SELECT TO anon, authenticated
  USING (
    release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  );

-- Read-only for the public roles; only the publisher (service_role / postgres) writes.
GRANT SELECT ON bb_public.release_entity_redirects TO anon, authenticated, service_role;
GRANT ALL ON bb_public.release_entity_redirects TO service_role;
REVOKE INSERT, UPDATE, DELETE ON bb_public.release_entity_redirects FROM PUBLIC, anon, authenticated;
