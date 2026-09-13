/**
 * Cross-request cache for `bb_public.materialized_snapshots` point reads, keyed by snapshot
 * name. One raw reader (`fetchMaterializedSnapshot` in postgres-readers.ts) backs several
 * unrelated release-wide snapshots — banned books (`/books`), demographics (`/data`, the
 * homepage data pulse) — each requested by name from a different call site with no
 * cross-request cache of its own: 172,919 calls between 2026-07-20 and 2026-09-12, one per
 * dynamic request.
 *
 * Mirrors the release-scoped pattern already used for the entity catalog / search index in
 * `./source.ts`, keyed additionally on `name` since one release-scoped cache instance cannot
 * distinguish the different snapshots sharing that single table — a separate cache instance
 * is created per name on first use.
 */
import { cache } from 'react';
import { fetchMaterializedSnapshot as fetchReleaseMaterializedSnapshot } from './public-readers';
import { createReleaseScopedCache, type ReleaseScopedCache } from './release-scoped-cache';
import { getPublicActiveReleaseMeta } from './source';

const snapshotCachesByName = new Map<string, ReleaseScopedCache<unknown>>();

function cacheForSnapshot(name: string): ReleaseScopedCache<unknown> {
  const existing = snapshotCachesByName.get(name);
  if (existing) return existing;
  const created = createReleaseScopedCache<unknown>({
    kind: `public-materialized-snapshot-${name}`,
  });
  snapshotCachesByName.set(name, created);
  return created;
}

/** Cross-request cached read of one materialized snapshot by name. */
export const fetchMaterializedSnapshot = cache(
  async (name: string): Promise<unknown | undefined> => {
    const release = await getPublicActiveReleaseMeta();
    const load = () => fetchReleaseMaterializedSnapshot(name);
    if (!release) return load();
    return cacheForSnapshot(name).get(release, load);
  },
);
