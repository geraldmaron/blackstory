/**
 * Caches materialized snapshots by release and snapshot name across requests. Each name gets
 * its own cache instance; an entity catalog and a demographic snapshot must not share a cached
 * value.
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
