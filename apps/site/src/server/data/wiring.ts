/**
 * Default wiring: the only module that connects the pure data-layer factories (cache, release,
 * catalog, purge) to the database, the domain package and the artifact fetcher. Routes import from
 * here; tests import the factories and pass fakes.
 */
import { fetchReleaseSearchIndexArtifact } from './artifact';
import { listCaches } from './cache';
import { createCatalog, type CatalogDeps } from './catalog';
import { createOperator } from './purge';
import { createReleasePointer } from './release';
import {
  fetchActiveRelease,
  listPublicSearchIndexDocs,
  mapPublicSearchProjection,
  parseSearchProjection,
  searchIndexReadyForRecords,
  shouldPreferReleaseArtifacts,
  shouldUseLivePublicProjections,
} from './sources';

export const releasePointer = createReleasePointer({
  fetchActive: fetchActiveRelease,
  isLive: () => shouldUseLivePublicProjections(),
  now: () => Date.now(),
});

const catalogDeps: CatalogDeps = {
  preferArtifacts: () => shouldPreferReleaseArtifacts(),
  fetchArtifact: (releaseId) => fetchReleaseSearchIndexArtifact(releaseId),
  listPostgresDocs: (releaseId) => listPublicSearchIndexDocs(releaseId),
  parse: (doc) => parseSearchProjection(doc as never),
  map: mapPublicSearchProjection as unknown as CatalogDeps['map'],
  ready: (docs) => searchIndexReadyForRecords(docs),
  warn: (message) => console.warn(`[site-data] ${message}`),
};

export const catalog = createCatalog(catalogDeps, () => releasePointer.getActiveRelease());

export const operator = createOperator({ caches: () => listCaches(), releasePointer });
