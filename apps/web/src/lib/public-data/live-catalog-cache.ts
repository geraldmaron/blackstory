/**
 * Process-local TTL cache and Next.js data-cache size gates for live public catalogs.
 * Next.js rejects `unstable_cache` entries over 2MB; national entity lists can exceed that.
 * Fat payloads stay in this bounded in-memory store (public projections only — same dignity
 * boundary as release artifacts). Entries small enough still may use Next's shared data cache;
 * oversized catalogs write only a tiny sentinel so later instances skip doomed 2MB SET attempts.
 */

/** Hard limit enforced by Next.js incremental/data cache for fetchCache entries. */
export const NEXT_DATA_CACHE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Soft ceiling before attempting `unstable_cache` SET. Leaves headroom for Next's wrapper
 * metadata so we do not trip the hard 2MB reject after serialization.
 */
export const NEXT_DATA_CACHE_SAFE_BYTES = Math.floor(NEXT_DATA_CACHE_MAX_BYTES * 0.9);

export const DEFAULT_LIVE_CATALOG_CACHE_MAX_ENTRIES = 8;

/** Tiny marker stored in Next data cache when the real catalog exceeds the safe byte ceiling. */
export const OVERSIZED_LIVE_CATALOG_SENTINEL = {
  __liveCatalog: 'oversized' as const,
};

export type OversizedLiveCatalogSentinel = typeof OVERSIZED_LIVE_CATALOG_SENTINEL;

export type LiveCatalogMemoryCache<Value> = {
  get(key: string, nowMs?: number): Value | undefined;
  set(key: string, value: Value, nowMs?: number, ttlMs?: number): void;
  delete(key: string): void;
  size(): number;
  clear(): void;
};

type CacheEntry<Value> = {
  readonly value: Value;
  readonly expiresAtMs: number;
};

export type CreateLiveCatalogMemoryCacheOptions = {
  readonly maxEntries?: number;
  readonly defaultTtlMs?: number;
  readonly now?: () => number;
};

/** Estimate UTF-8 JSON byte length the way Next's data cache sizes serialized values. */
export function estimateJsonCacheBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

/**
 * Lower bound on the serialized size of an array, without serializing it.
 *
 * `estimateJsonCacheBytes` on the national catalog stringifies >13MB purely to conclude "too
 * big", then throws the string away — on every cold start, on both the artifact and Postgres
 * paths. Any JSON array element serializes to at least a couple of bytes plus its comma, so
 * once `length * MIN_BYTES_PER_ELEMENT` already exceeds the ceiling the answer is settled and
 * the full stringify can be skipped. Deliberately conservative: it only short-circuits the
 * definitely-oversized case and never claims something fits.
 */
const MIN_BYTES_PER_ARRAY_ELEMENT = 2;

export function isDefinitelyOversizedArray(
  value: unknown,
  safeBytes: number = NEXT_DATA_CACHE_SAFE_BYTES,
): boolean {
  return Array.isArray(value) && value.length * MIN_BYTES_PER_ARRAY_ELEMENT > safeBytes;
}

/** True when a payload is safe to store in Next's shared data cache. */
export function fitsNextDataCache(
  byteLength: number,
  safeBytes: number = NEXT_DATA_CACHE_SAFE_BYTES,
): boolean {
  return byteLength > 0 && byteLength <= safeBytes;
}

export function isOversizedLiveCatalogSentinel(
  value: unknown,
): value is OversizedLiveCatalogSentinel {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __liveCatalog?: unknown }).__liveCatalog === 'oversized'
  );
}

/**
 * Decide what Next's data cache may store for a loaded catalog: the value itself when it
 * fits, otherwise only the oversized sentinel (fat payload must live in process memory).
 */
export function nextDataCacheValueForCatalog<T>(loaded: T): T | OversizedLiveCatalogSentinel {
  if (isDefinitelyOversizedArray(loaded)) {
    return OVERSIZED_LIVE_CATALOG_SENTINEL;
  }
  if (!fitsNextDataCache(estimateJsonCacheBytes(loaded))) {
    return OVERSIZED_LIVE_CATALOG_SENTINEL;
  }
  return loaded;
}

/**
 * Bounded in-memory TTL cache (geocode / rate-limit store shape).
 * Keyed by release identity only — never by user or session.
 */
export function createLiveCatalogMemoryCache<Value>(
  options: CreateLiveCatalogMemoryCacheOptions = {},
): LiveCatalogMemoryCache<Value> {
  const maxEntries = options.maxEntries ?? DEFAULT_LIVE_CATALOG_CACHE_MAX_ENTRIES;
  const defaultTtlMs = options.defaultTtlMs ?? 300_000;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, CacheEntry<Value>>();

  function prune(nowMs: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAtMs <= nowMs) {
        entries.delete(key);
      }
    }
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }
  }

  return {
    get(key, nowMs = now()) {
      prune(nowMs);
      const entry = entries.get(key);
      if (!entry || entry.expiresAtMs <= nowMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, nowMs = now(), ttlMs = defaultTtlMs) {
      prune(nowMs);
      // Refresh key order (Map insertion order) for LRU-ish eviction.
      entries.delete(key);
      entries.set(key, { value, expiresAtMs: nowMs + ttlMs });
      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
    },
    delete(key) {
      entries.delete(key);
    },
    size() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
  };
}

export type LiveCatalogKind = 'entities' | 'search-index' | 'graph';

export function liveCatalogCacheKey(
  kind: LiveCatalogKind,
  releaseId: string,
  activatedAt: string,
): string {
  return `${kind}:${releaseId}:${activatedAt}`;
}

/**
 * Collapses concurrent loads of the same key onto one in-flight promise.
 *
 * Every full-catalog reader has the same failure mode: the process-memory TTL expires, N
 * concurrent requests all miss at that instant, and each one issues its own multi-MB Postgres
 * pull. That produced the bursty read pattern observed on 2026-08-08 (several full pulls within
 * seconds, then quiet). One load per key now serves all waiters.
 *
 * The key is released in `finally`, not `then`, so a rejected load cannot wedge the key and
 * starve every later request.
 */
export function createSingleFlight(): <T>(key: string, load: () => Promise<T>) => Promise<T> {
  const inFlight = new Map<string, Promise<unknown>>();

  return function singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return existing;
    const started = load().finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, started);
    return started;
  };
}
