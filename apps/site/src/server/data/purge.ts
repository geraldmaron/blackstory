/**
 * Explicit purge and the cache report. This is the operator's answer to "I corrected a record in place;
 * make it visible now":
 *
 *   1. Republish the catalog artifact (the existing runbook: apps/web CLAUDE.md, "Republishing the CDN
 *      catalog after a published write") and purge the Cloudflare zone for the changed documents.
 *   2. `POST /internal/purge` (this file) drops this instance's process caches, so the next read loads
 *      the republished artifact instead of waiting for the soft TTL.
 *
 * Without step 2 every instance converges on its own within the soft TTL (5 minutes by default) through
 * the ETag refresh in cache.ts, so a missed purge costs minutes, not correctness. The endpoint reaches
 * one instance per call; on a multi-instance host call it per instance or rely on the soft TTL.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { CacheStats } from './cache';
import type { ReleasePointer } from './release';

export type PurgeScope = 'all' | 'catalog' | 'release-pointer';

export const PURGE_SCOPES: readonly PurgeScope[] = ['all', 'catalog', 'release-pointer'];

export type PurgeResult = {
  readonly scope: PurgeScope;
  readonly droppedEntries: number;
  readonly releasePointerCleared: boolean;
  readonly caches: readonly string[];
};

export function isPurgeScope(value: unknown): value is PurgeScope {
  return typeof value === 'string' && (PURGE_SCOPES as readonly string[]).includes(value);
}

export type PurgeTargets = {
  readonly caches: () => readonly {
    readonly kind: string;
    invalidate(): number;
    stats(): CacheStats;
  }[];
  readonly releasePointer: ReleasePointer;
};

export function createOperator(targets: PurgeTargets) {
  return {
    purge(scope: PurgeScope): PurgeResult {
      const clearPointer = scope === 'all' || scope === 'release-pointer';
      const clearCatalog = scope === 'all' || scope === 'catalog';
      let droppedEntries = 0;
      const names: string[] = [];
      if (clearCatalog) {
        for (const cache of targets.caches()) {
          droppedEntries += cache.invalidate();
          names.push(cache.kind);
        }
      }
      if (clearPointer) targets.releasePointer.invalidate();
      return { scope, droppedEntries, releasePointerCleared: clearPointer, caches: names };
    },
    report() {
      return {
        releasePointer: targets.releasePointer.stats(),
        caches: targets.caches().map((cache) => cache.stats()),
      };
    },
  };
}

/**
 * Bearer-token check over fixed-length digests, so length and content do not leak through timing.
 * An unset token disables the endpoints entirely; callers answer 404, not 401, so the route is not
 * advertised on a site that has not configured it.
 */
export function isPurgeAuthorized(
  authorization: string | null,
  token: string | undefined,
): boolean {
  if (!token || token.length < 16) return false;
  const presented = /^Bearer (.+)$/i.exec(authorization ?? '')?.[1] ?? '';
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b);
}
