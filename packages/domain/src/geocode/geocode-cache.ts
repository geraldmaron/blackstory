/**
 * Bounded in-memory TTL cache for geocode results.
 * Deliberately generic over the cached value type callers cache `GeocodeResolution`
 * `ManualPlaceSearchFallback` shapes, never a raw address-history record. Mirrors
 * `packages/security/src/rate-limits.ts`'s `createInMemoryRateLimitStore` shape (bounded size,
 * TTL eviction, size) so this cache reads the same way to anyone already familiar with that
 * store, without importing `@repo/security` (circular-dependency rule, see
 * `./jurisdiction-ids.ts`'s module doc).
 *
 * Privacy note: entries are keyed by a normalized address/coordinate/ZIP hash (see
 * `./address-normalize.ts`), not a user or session id this cache has no notion of "whose"
 * lookup a cached entry came from, so it cannot become a per-user location history by
 * construction. A short default TTL (`DEFAULT_GEOCODE_CACHE_TTL_MS`) keeps entries from
 * accumulating into a long-lived reference corpus, which matters especially for ZIP lookups
 * (`../geography/location.ts`'s ZIP-is-modern-input-only guard this cache is a request-
 * deduplication mechanism, never a stored ZIP corpus).
 */

export const DEFAULT_GEOCODE_CACHE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_GEOCODE_CACHE_MAX_ENTRIES = 5_000;

export type GeocodeCache<Value> = {
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

export type CreateGeocodeCacheOptions = {
  readonly maxEntries?: number;
  readonly defaultTtlMs?: number;
  readonly now?: () => number;
};

export function createGeocodeCache<Value>(
  options: CreateGeocodeCacheOptions = {},
): GeocodeCache<Value> {
  const maxEntries = options.maxEntries ?? DEFAULT_GEOCODE_CACHE_MAX_ENTRIES;
  const defaultTtlMs = options.defaultTtlMs ?? DEFAULT_GEOCODE_CACHE_TTL_MS;
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
