/**
 * Cache diagnostics + manual clear (MOB-009 §8; ADR-022 §2/§6).
 *
 * A real, callable `clearCache()` (Settings → "Clear cached data") and a
 * read-only `cacheDiagnostics()` for a diagnostics screen / MOB-018 budgets.
 * Both are network-loss-free: everything cleared is reconstructable from
 * `api-public`.
 */
import { CACHE_BYTE_CEILING } from './cache-policy';
import { CACHE_SCHEMA_VERSION } from './db/schema';
import { META_KEYS, type CacheStore } from './db/store';

export interface CacheDiagnostics {
  readonly totalBytes: number;
  readonly entryCount: number;
  readonly ceilingBytes: number;
  readonly utilization: number;
  readonly schemaVersion: number;
  readonly releaseStamp?: string;
  readonly releaseId?: string;
  /** Epoch ms the active release was last fetched (for "last updated"). */
  readonly releaseFetchedAt?: number;
}

export async function cacheDiagnostics(store: CacheStore): Promise<CacheDiagnostics> {
  const [totalBytes, entries, releaseStamp, releaseId, fetchedAt, schemaRaw] = await Promise.all([
    store.totalBytes(),
    store.entriesByAccessAsc(),
    store.getMeta(META_KEYS.releaseStamp),
    store.getMeta(META_KEYS.releaseId),
    store.getMeta(META_KEYS.fetchedAt),
    store.getMeta(META_KEYS.schemaVersion),
  ]);
  return {
    totalBytes,
    entryCount: entries.length,
    ceilingBytes: CACHE_BYTE_CEILING,
    utilization: CACHE_BYTE_CEILING > 0 ? totalBytes / CACHE_BYTE_CEILING : 0,
    schemaVersion: schemaRaw !== undefined ? Number(schemaRaw) : CACHE_SCHEMA_VERSION,
    releaseStamp,
    releaseId,
    releaseFetchedAt: fetchedAt !== undefined ? Number(fetchedAt) : undefined,
  };
}

/**
 * Wipe all cached data and reset the release markers. The schema is recreated
 * empty (drop-and-rebuild, ADR-022 §5), so the next launch/sync repopulates from
 * the network exactly like a first launch — degrading honestly (§3), never
 * crashing.
 */
export async function clearCache(store: CacheStore): Promise<void> {
  await store.dropAll();
  await store.ensureSchema();
  await store.setMeta(META_KEYS.schemaVersion, String(CACHE_SCHEMA_VERSION));
  await store.setMeta(META_KEYS.migrationState, 'clean');
}
