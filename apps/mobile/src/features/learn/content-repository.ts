/**
 * Content read-and-cache orchestration (MOB-015 requirement #8; ADR-022).
 *
 * Wires the bundled catalog (content-catalog.ts — today's stand-in for a live `/v1/content/{slug}`
 * endpoint, see that file's header) through the REAL MOB-009 cache primitives exported from
 * `@/data` (`ReleaseCache.read`/`write`, the same `FreshnessSignal`/`CachedRead` shapes every other
 * feature uses) so content pages are genuinely available offline, not just conceptually. This
 * module takes its `ReleaseCache` (and connectivity/stamp signals) as injected dependencies —
 * it never constructs `createRuntimeCache()` itself — so tests exercise the exact same code path
 * with a `createMemoryStore()`-backed cache (see content-repository.test.ts) rather than a mock of
 * this module's own behavior.
 *
 * Namespace choice: content pages are cached under the existing `'artifact'` `CacheNamespace`
 * (src/data/db/store.ts) — release-coupled static content is exactly what that namespace already
 * models (the bootstrap manifest's own `contentVersion` doc comment: "present once static content
 * — stories/methodology/etc — is release-versioned"). No new namespace is added (that would be a
 * `src/data/**` change, outside this bead's ownership).
 */
import type { CitationV1, ContentPageV1 } from './content-types';
import { findCatalogEntry, type CatalogSectionId } from './content-catalog';

export interface CachedContentValue {
  readonly page: ContentPageV1;
  readonly sources: readonly CitationV1[];
  readonly requiresCitation: boolean;
  readonly contentVersion: string;
}

export type ContentReadResult =
  | {
      readonly status: 'ok';
      readonly value: CachedContentValue;
      readonly source: 'network' | 'cache';
      readonly fetchedAt: number;
      /** True when served from cache while offline/degraded — the UI must label it (ADR-022 §3). */
      readonly degraded: boolean;
    }
  | { readonly status: 'not-found' }
  /** Offline AND nothing usable is cached yet — an explicit state, never a hung spinner or an
   * empty state that reads as "this page doesn't exist" (ADR-022 §3 "no silent failures"). */
  | { readonly status: 'offline-miss' };

/** The minimal slice of `@/data`'s `ReleaseCache` this module needs — kept as a narrow structural
 * type (not imported from `@/data` at the type level either) so this feature has zero import-time
 * coupling to `src/data/**`'s module graph; callers pass a real `ReleaseCache` instance, whose
 * shape already satisfies this. */
export interface ContentCachePort {
  read<T>(
    namespace: 'artifact',
    key: string,
    opts: { readonly activeStamp: string; readonly degraded: boolean; readonly now: number },
  ): Promise<{ readonly value: T; readonly freshness: { readonly fetchedAt: number } } | undefined>;
  write<T>(
    namespace: 'artifact',
    key: string,
    value: T,
    meta: { readonly releaseStamp: string; readonly fetchedAt: number },
  ): Promise<void>;
}

export interface ContentRepositoryDeps {
  readonly cache: ContentCachePort;
  readonly isOnline: () => boolean;
  /** The release stamp to cache under / validate against. Falls back to a stable local constant
   * before the first successful bootstrap sync has ever run (see doc comment above). */
  readonly activeStamp: () => Promise<string>;
  readonly now?: () => number;
}

export const UNBOOTSTRAPPED_STAMP = 'local-unbootstrapped';

function cacheKey(section: CatalogSectionId, slug: string): string {
  return `content:${section}:${slug}`;
}

export interface ContentRepository {
  getPage(section: CatalogSectionId, slug: string): Promise<ContentReadResult>;
}

export function createContentRepository(deps: ContentRepositoryDeps): ContentRepository {
  const now = deps.now ?? Date.now;

  async function getPage(section: CatalogSectionId, slug: string): Promise<ContentReadResult> {
    const key = cacheKey(section, slug);
    const activeStamp = await deps.activeStamp();

    if (deps.isOnline()) {
      const entry = findCatalogEntry(section, slug);
      if (!entry) return { status: 'not-found' };
      const value: CachedContentValue = {
        page: entry.page,
        sources: entry.sources ?? [],
        requiresCitation: entry.requiresCitation ?? false,
        contentVersion: entry.contentVersion,
      };
      const fetchedAt = now();
      await deps.cache.write('artifact', key, value, { releaseStamp: activeStamp, fetchedAt });
      return { status: 'ok', value, source: 'network', fetchedAt, degraded: false };
    }

    const cached = await deps.cache.read<CachedContentValue>('artifact', key, {
      activeStamp,
      degraded: true,
      now: now(),
    });
    if (!cached) return { status: 'offline-miss' };
    return {
      status: 'ok',
      value: cached.value,
      source: 'cache',
      fetchedAt: cached.freshness.fetchedAt,
      degraded: true,
    };
  }

  return { getPage };
}
