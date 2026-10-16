/**
 * The site's cache primitive. Replaces `unstable_cache` (Next Data Cache) and React `cache()`.
 *
 * Model, stated once because every data read goes through it:
 *
 *   key        kind + releaseId + activatedAt. A new release is a new key, so a release change
 *              invalidates by construction; nothing has to be told.
 *   fresh      served from process memory. Single-flight: concurrent misses share one load.
 *   soft TTL   past it, the entry is still served and ONE background refresh runs (a failed one backs
 *              off 10 s, 20 s ... 5 min instead of retrying at request rate). For the artifact
 *              path that refresh is a conditional GET (ETag), so an in-place correction that the
 *              publisher republished is picked up within the soft TTL for the price of a 304.
 *   hard TTL   past it, the entry is gone and the next read loads.
 *   stale-if-error  if a load fails and a last good value exists within `staleIfErrorMs`, serve it and
 *              count it; a database outage degrades to old data instead of a 500.
 *   purge      `invalidate()` drops everything, including the stale-if-error copy: a purge means
 *              "do not serve what you have". It also fences loads already in flight: they may finish
 *              and answer their caller, but they cannot write the cache, and a reader after the purge
 *              never joins them. Scope and endpoint: purge.ts.
 *
 * This is per process. There is no cross-instance layer here on purpose: the shared layer is the
 * release artifact on the CDN (and Postgres behind it), and large catalogs never fit Next's 2 MB Data
 * Cache anyway (they fell through to process memory there too).
 */
import { createLiveCatalogMemoryCache, createSingleFlight } from './primitives';

export type ReleaseKey = { readonly releaseId: string; readonly activatedAt: string };

export type CacheStats = {
  readonly kind: string;
  readonly entries: number;
  readonly hits: number;
  readonly misses: number;
  readonly loads: number;
  readonly refreshes: number;
  readonly errors: number;
  readonly staleServed: number;
  /** Loads that finished after a purge and were handed to their caller but not stored. */
  readonly discarded: number;
  readonly lastLoadMs: number | null;
  readonly lastLoadedAt: string | null;
  readonly lastKey: string | null;
};

export type CatalogCache<T> = {
  readonly kind: string;
  get(release: ReleaseKey, load: () => Promise<T | undefined>): Promise<T | undefined>;
  /** Drops every entry, including the stale-if-error copy. Returns how many live entries went. */
  invalidate(): number;
  stats(): CacheStats;
};

export type CatalogCacheOptions = {
  readonly kind: string;
  readonly ttlMs?: number;
  readonly softTtlMs?: number;
  readonly staleIfErrorMs?: number;
  readonly now?: () => number;
  readonly log?: (message: string, detail?: Record<string, unknown>) => void;
};

export const DEFAULT_TTL_MS = 30 * 60_000;
export const DEFAULT_SOFT_TTL_MS = 5 * 60_000;
export const DEFAULT_STALE_IF_ERROR_MS = 6 * 60 * 60_000;

type Entry<T> = { readonly value: T; readonly loadedAt: number; readonly seq: number };

/** How many releases keep a stale-if-error copy: the live one and the one it replaced. */
const LAST_GOOD_MAX_KEYS = 2;
const REFRESH_BACKOFF_START_MS = 10_000;
const REFRESH_BACKOFF_MAX_MS = 5 * 60_000;

const registry = new Map<string, CatalogCache<never>>();

export function listCaches(): readonly CatalogCache<never>[] {
  return [...registry.values()];
}

/** Test seam: caches register by kind at creation; tests start from an empty registry. */
export function resetCacheRegistryForTests(): void {
  registry.clear();
}

export function createCatalogCache<T>(options: CatalogCacheOptions): CatalogCache<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const softTtlMs = Math.min(options.softTtlMs ?? DEFAULT_SOFT_TTL_MS, ttlMs);
  const staleIfErrorMs = options.staleIfErrorMs ?? DEFAULT_STALE_IF_ERROR_MS;
  const now = options.now ?? (() => Date.now());
  const log =
    options.log ?? ((message, detail) => console.warn(`[site-data] ${message}`, detail ?? {}));

  const memory = createLiveCatalogMemoryCache<Entry<T>>({ defaultTtlMs: ttlMs, now });
  const lastGood = new Map<string, Entry<T>>();
  const singleFlight = createSingleFlight();
  const refreshBackoff = new Map<string, { nextAt: number; delayMs: number }>();
  const counters = {
    hits: 0,
    misses: 0,
    loads: 0,
    refreshes: 0,
    errors: 0,
    staleServed: 0,
    discarded: 0,
  };
  // Every purge bumps the generation. A load remembers the generation it started in and may not
  // write into a later one, and flights are keyed by generation so a post-purge reader never joins
  // a pre-purge load. Without both, a slow load finishing after a purge would put withdrawn data back.
  let generation = 0;
  let loadSeq = 0;
  let lastLoadMs: number | null = null;
  let lastLoadedAt: string | null = null;
  let lastKey: string | null = null;

  function remember(key: string, entry: Entry<T>): void {
    lastGood.delete(key);
    lastGood.set(key, entry);
    for (const [other, kept] of lastGood) {
      if (now() - kept.loadedAt > staleIfErrorMs) lastGood.delete(other);
    }
    while (lastGood.size > LAST_GOOD_MAX_KEYS) {
      const oldest = lastGood.keys().next().value;
      if (oldest === undefined) break;
      lastGood.delete(oldest);
    }
  }

  /** One flight per generation and key, shared by foreground loads and background refreshes. */
  function flight(
    key: string,
    loader: () => Promise<T | undefined>,
    refresh: boolean,
  ): Promise<T | undefined> {
    const startedGeneration = generation;
    return singleFlight(`${startedGeneration}|${key}`, async () => {
      const seq = (loadSeq += 1);
      const startedAt = now();
      let value: T | undefined;
      try {
        value = await loader();
      } catch (error) {
        counters.errors += 1;
        throw error;
      }
      if (value === undefined) return undefined;
      if (startedGeneration !== generation) {
        // Purged while loading: the caller still gets what it asked for, the cache does not keep it.
        counters.discarded += 1;
        return value;
      }
      const current = memory.get(key, now());
      if (current && current.seq > seq) return value; // a newer load already wrote; never go backwards
      const entry: Entry<T> = { value, loadedAt: now(), seq };
      memory.set(key, entry, now(), ttlMs);
      remember(key, entry);
      refreshBackoff.delete(key);
      lastLoadMs = now() - startedAt;
      lastLoadedAt = new Date(entry.loadedAt).toISOString();
      lastKey = key;
      if (refresh) counters.refreshes += 1;
      else counters.loads += 1;
      return value;
    });
  }

  function refreshInBackground(key: string, loader: () => Promise<T | undefined>): void {
    const gate = refreshBackoff.get(key);
    if (gate && now() < gate.nextAt) return;
    flight(key, loader, true).catch((error: unknown) => {
      // Keep serving the current value, and back off so a failing source is not retried at request rate.
      const delayMs = Math.min(
        (gate?.delayMs ?? REFRESH_BACKOFF_START_MS / 2) * 2,
        REFRESH_BACKOFF_MAX_MS,
      );
      refreshBackoff.set(key, { nextAt: now() + delayMs, delayMs });
      log(`${options.kind}: background refresh failed, keeping the current value`, {
        retryInMs: delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  const cache: CatalogCache<T> = {
    kind: options.kind,
    async get(release, loader) {
      const key = `${options.kind}:${release.releaseId}:${release.activatedAt}`;
      const entry = memory.get(key, now());
      if (entry) {
        counters.hits += 1;
        if (now() - entry.loadedAt > softTtlMs) refreshInBackground(key, loader);
        return entry.value;
      }
      counters.misses += 1;
      try {
        return await flight(key, loader, false);
      } catch (error) {
        const fallback = lastGood.get(key);
        if (fallback && now() - fallback.loadedAt <= staleIfErrorMs) {
          counters.staleServed += 1;
          log(`${options.kind}: load failed, serving last good value`, {
            ageMs: now() - fallback.loadedAt,
            error: error instanceof Error ? error.message : String(error),
          });
          return fallback.value;
        }
        throw error;
      }
    },
    invalidate() {
      const dropped = memory.size();
      generation += 1;
      memory.clear();
      lastGood.clear();
      refreshBackoff.clear();
      return dropped;
    },
    stats() {
      return {
        kind: options.kind,
        entries: memory.size(),
        ...counters,
        lastLoadMs,
        lastLoadedAt,
        lastKey,
      };
    },
  };
  registry.set(options.kind, cache as unknown as CatalogCache<never>);
  return cache;
}
