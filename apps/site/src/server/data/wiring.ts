/**
 * Default wiring: the only module that connects the pure data-layer factories (cache, release,
 * catalog, purge) to the database, the domain package and the artifact fetcher. Routes import from
 * here; tests import the factories and pass fakes.
 */
import { fetchReleaseEntitiesListArtifact, fetchReleaseSearchIndexArtifact } from './artifact';
import { listCaches } from './cache';
import { createCatalog, type CatalogDeps } from './catalog';
import { createEntityCatalog, type EntityDeps } from './entities';
import { createOperator } from './purge';
import { createReleasePointer } from './release';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  fetchPublicEntityProjectionsByIds,
  fetchPublicEntityRedirect,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  loadEntityNeighborhood,
  mapProjectionsToHydratedViews,
  projectionsFromArtifactEntities,
  thinViewsFromProjections,
  type PublicEntityView,
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

type Projection = Awaited<ReturnType<typeof listPublicEntityProjections>>[number];

const neighborhoodReaders = {
  fetchProjection: fetchPublicEntityProjection,
  fetchProjectionsByIds: fetchPublicEntityProjectionsByIds,
  warn: (message: string) => console.warn(message),
};

const entityDeps: EntityDeps<PublicEntityView, Projection> = {
  preferArtifacts: () => shouldPreferReleaseArtifacts(),
  fetchEntitiesArtifact: (releaseId) => fetchReleaseEntitiesListArtifact(releaseId),
  listProjections: (releaseId) => listPublicEntityProjections(releaseId),
  projectionsFromArtifact: (entities) => projectionsFromArtifactEntities(entities),
  hydrateAll: (projections) => mapProjectionsToHydratedViews(projections),
  loadNeighborhood: (releaseId, entityId) =>
    loadEntityNeighborhood(releaseId, entityId, neighborhoodReaders),
  loadThin: async (releaseId, entityIds) =>
    thinViewsFromProjections(await fetchPublicEntityProjectionsByIds(releaseId, entityIds)),
  fetchRedirect: (releaseId, entityId) => fetchPublicEntityRedirect(releaseId, entityId),
  idOf: (view) => view.id,
  warn: (message) => console.warn(message),
};

export const entities = createEntityCatalog(entityDeps, () => releasePointer.getActiveRelease());

export const operator = createOperator({ caches: () => listCaches(), releasePointer });
