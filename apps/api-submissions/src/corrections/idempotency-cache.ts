/**
 * In-memory idempotency cache for correction submit retries (MOB-016 / repo-zir9).
 *
 * When a client retries the same submission with an identical `Idempotency-Key` header
 * (content-derived on mobile), the route returns the original 202 receipt without a second
 * quarantine write. This complements — does not replace — the authoritative content-hash
 * duplicate detection inside `@repo/security`.
 */
export type IdempotencyCacheEntry = {
  readonly receiptCode: string;
  readonly statusHref: string;
  readonly submissionId: string;
};

export type IdempotencyCache = {
  get(key: string): IdempotencyCacheEntry | undefined;
  set(key: string, entry: IdempotencyCacheEntry): void;
};

export function createIdempotencyCache(): IdempotencyCache {
  const entries = new Map<string, IdempotencyCacheEntry>();
  return {
    get(key) {
      const normalized = key.trim();
      if (!normalized) return undefined;
      return entries.get(normalized);
    },
    set(key, entry) {
      const normalized = key.trim();
      if (!normalized) return;
      entries.set(normalized, Object.freeze({ ...entry }));
    },
  };
}
