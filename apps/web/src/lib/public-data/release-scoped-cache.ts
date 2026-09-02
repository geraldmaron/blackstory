/**
 * Cross-request cache for release-wide public reads.
 *
 * One rule for every public surface: no route reads Postgres per request. Anything that is the
 * same bytes for every reader until the release changes (the entity catalog, the search index,
 * the article list, the theme-impact packets) goes through here, keyed on the active release
 * pointer, with a stated TTL.
 *
 * Why the TTL is a real freshness bound and not just a memory bound: the key carries
 * `releaseId + activatedAt`, but the ops-data fix/backfill scripts upsert `bb_public.*` under
 * the same release id without bumping `activated_at`, so an in-place correction only becomes
 * visible when the TTL lapses. 30 minutes is the bound the catalog already accepted.
 *
 * Three layers, in order:
 *   1. process memory (per instance, TTL) — the hot path, zero I/O;
 *   2. single-flight — N concurrent misses on one instance produce one load, not N (the bursty
 *      full-pull pattern observed on 2026-08-08);
 *   3. Next's data cache (`unstable_cache`, shared across instances on Vercel) — so a cold
 *      instance fills from the platform cache rather than the database. Values over Next's 2MB
 *      limit store only a sentinel there and stay in process memory (see live-catalog-cache.ts).
 *
 * `undefined` from `load` means "nothing to cache" (no active release, empty table) and is
 * never stored, so a transient miss retries on the next request.
 */
import { unstable_cache } from 'next/cache';
import {
  createLiveCatalogMemoryCache,
  createSingleFlight,
  isOversizedLiveCatalogSentinel,
  liveCatalogCacheKey,
  nextDataCacheValueForCatalog,
  type LiveCatalogMemoryCache,
} from './live-catalog-cache';

/** Default cross-request window for release-scoped reads (seconds). */
export const RELEASE_SCOPED_REVALIDATE_SECONDS = 1_800; // 30m

export type ReleaseMeta = {
  readonly releaseId: string;
  readonly activatedAt: string;
};

/** The shape of `unstable_cache` this module needs; injected in tests. */
export type NextCacheLike = <T>(
  fn: () => Promise<T>,
  keyParts: readonly string[],
  options: { readonly revalidate: number },
) => () => Promise<T>;

export type ReleaseScopedCacheOptions<T> = {
  /** Cache key prefix. Bump it (e.g. `-v2`) when the cached shape changes. */
  readonly kind: string;
  /** Cross-request TTL, seconds. Defaults to 30 minutes. */
  readonly revalidateSeconds?: number;
  /** Test seams. Production callers never pass these. */
  readonly deps?: {
    readonly nextCache?: NextCacheLike;
    readonly memory?: LiveCatalogMemoryCache<T>;
  };
};

export type ReleaseScopedCache<T> = {
  /**
   * Resolve the value for `release`. Memory, then single-flight, then Next's data cache, then
   * `load`. Returns `undefined` when `load` does.
   */
  readonly get: (
    release: ReleaseMeta,
    load: () => Promise<T | undefined>,
  ) => Promise<T | undefined>;
  /** Test seam: drop every in-process entry. */
  readonly clearMemory: () => void;
};

export function createReleaseScopedCache<T>(
  options: ReleaseScopedCacheOptions<T>,
): ReleaseScopedCache<T> {
  const revalidate = options.revalidateSeconds ?? RELEASE_SCOPED_REVALIDATE_SECONDS;
  const nextCache: NextCacheLike = options.deps?.nextCache ?? (unstable_cache as NextCacheLike);
  const memory =
    options.deps?.memory ?? createLiveCatalogMemoryCache<T>({ defaultTtlMs: revalidate * 1000 });
  const singleFlight = createSingleFlight();

  async function loadAndCache(
    memKey: string,
    release: ReleaseMeta,
    load: () => Promise<T | undefined>,
  ): Promise<T | undefined> {
    // A load that completed while this caller queued behind the single-flight key has already
    // populated memory.
    const raced = memory.get(memKey);
    if (raced !== undefined) return raced;

    const fromNext = await nextCache(
      async () => {
        const loaded = await load();
        if (loaded === undefined) return undefined;
        const forNext = nextDataCacheValueForCatalog(loaded);
        if (isOversizedLiveCatalogSentinel(forNext)) {
          // Too big for Next's data cache: this instance keeps the real value in memory and Next
          // remembers only that it was too big, so later instances skip the doomed SET.
          memory.set(memKey, loaded);
        }
        return forNext;
      },
      [options.kind, release.releaseId, release.activatedAt],
      { revalidate },
    )();

    if (isOversizedLiveCatalogSentinel(fromNext)) {
      // Another instance found it oversized; this one has to load for itself.
      const afterFactory = memory.get(memKey);
      if (afterFactory !== undefined) return afterFactory;
      const loaded = await load();
      if (loaded !== undefined) memory.set(memKey, loaded);
      return loaded;
    }

    if (fromNext !== undefined) memory.set(memKey, fromNext as T);
    return fromNext as T | undefined;
  }

  return {
    get(release, load) {
      const memKey = liveCatalogCacheKey(options.kind, release.releaseId, release.activatedAt);
      const hit = memory.get(memKey);
      if (hit !== undefined) return Promise.resolve(hit);
      return singleFlight(memKey, () => loadAndCache(memKey, release, load));
    },
    clearMemory() {
      memory.clear();
    },
  };
}
