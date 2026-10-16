/**
 * Release-scoped catalog reads. Port of the search-index path in apps/web/src/lib/public-data/source.ts
 * (`loadLiveSearchIndexForRelease` / `cachedLiveSearchIndex`) onto the site's cache. Same order of
 * preference: the release artifact on the CDN (cheap, ETag-revalidated), then Postgres. A full
 * Postgres catalog pull is the expensive read (the 2026-08 egress incident), so every fallback is
 * logged and the read goes through the cache and single-flight.
 */
import { createCatalogCache, type CatalogCache, type ReleaseKey } from './cache';
import type { PublicSearchIndexDoc } from '@repo/domain/search';

export type CatalogDeps = {
  readonly preferArtifacts: () => boolean;
  readonly fetchArtifact: (releaseId: string) => Promise<{ docs: readonly unknown[] } | undefined>;
  readonly listPostgresDocs: (releaseId: string) => Promise<readonly unknown[]>;
  readonly parse: (doc: unknown) => unknown | undefined;
  readonly map: (parsed: never) => PublicSearchIndexDoc;
  readonly ready: (docs: readonly PublicSearchIndexDoc[]) => boolean;
  readonly warn: (message: string) => void;
};

export type SearchIndexResult = {
  readonly docs: readonly PublicSearchIndexDoc[];
  readonly release: ReleaseKey;
};

export type Catalog = {
  getSearchIndex(): Promise<SearchIndexResult>;
  readonly searchIndexCache: CatalogCache<readonly PublicSearchIndexDoc[]>;
};

export class CatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogUnavailableError';
  }
}

export function createCatalog(
  deps: CatalogDeps,
  getRelease: () => Promise<ReleaseKey | undefined>,
): Catalog {
  const searchIndexCache = createCatalogCache<readonly PublicSearchIndexDoc[]>({
    kind: 'public-release-search-index-v2',
  });

  function fromArtifactDocs(docs: readonly unknown[]): PublicSearchIndexDoc[] {
    const out: PublicSearchIndexDoc[] = [];
    for (const doc of docs) {
      const parsed = deps.parse(doc);
      if (parsed) out.push(deps.map(parsed as never));
    }
    return out;
  }

  async function loadSearchIndex(
    releaseId: string,
  ): Promise<readonly PublicSearchIndexDoc[] | undefined> {
    let artifactMapped: readonly PublicSearchIndexDoc[] | undefined;
    if (deps.preferArtifacts()) {
      const artifact = await deps.fetchArtifact(releaseId);
      if (artifact && artifact.docs.length > 0) {
        const mapped = fromArtifactDocs(artifact.docs);
        if (mapped.length > 0 && deps.ready(mapped)) return mapped;
        if (mapped.length > 0) {
          artifactMapped = mapped;
          deps.warn(
            `search-index artifact missing evidenceInputs coverage; preferring Postgres for ${releaseId}`,
          );
        }
      } else {
        deps.warn(`full Postgres search-index pull for ${releaseId} (artifact unusable)`);
      }
    }
    const projectionDocs = await deps.listPostgresDocs(releaseId);
    if (projectionDocs.length > 0) return projectionDocs.map((doc) => deps.map(doc as never));
    return artifactMapped;
  }

  return {
    searchIndexCache,
    async getSearchIndex() {
      const release = await getRelease();
      if (!release)
        throw new CatalogUnavailableError('public data is not configured to read the live catalog');
      const docs = await searchIndexCache.get(release, () => loadSearchIndex(release.releaseId));
      if (!docs || docs.length === 0)
        throw new CatalogUnavailableError(`search index unavailable for ${release.releaseId}`);
      return { docs, release };
    },
  };
}
