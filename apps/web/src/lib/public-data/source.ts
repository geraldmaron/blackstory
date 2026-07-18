/**
 * Public data source selector: live release artifacts + Firestore with seed snapshot fallback.
 * Hydrates 1-hop related neighbor stubs and composes capped 2-hop continue-learning.
 * Entity pages fetch only related neighbor docs (bounded). List/map/search prefer ADR-004
 * catalog artifacts, then cross-request `unstable_cache`d Firestore reads — never rebuild
 * search from a full entity scan when the written search index (artifact or collection) exists.
 */

import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { PublicSearchIndexDoc } from '@repo/domain';
import type {
  PublicEntityProjectionDoc,
  PublicSearchIndexDoc as FirestoreSearchIndexDoc,
} from '@repo/firebase';
import {
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  type NeighborLookup,
} from '@repo/domain';
import {
  getPublicEntity,
  listPublicEntities,
  type PublicEntityView,
  type RelatedNeighborView,
} from '../../data/public-seed';
import {
  isPublicReadApiDisabled,
  resolvePublicEntity,
  type PublicReadResult,
  type PublicReadSource,
} from '../runtime-hardening/degraded-mode';
import { getSnapshotSearchIndex } from '../search/snapshot-search-index';
import {
  fetchActiveRelease,
  fetchPublicEntityProjection,
  fetchPublicEntityProjectionsByIds,
  listPublicEntityProjections,
  listPublicSearchIndexDocs,
  parseEntityProjection,
  parseSearchIndexDoc,
  shouldUseLivePublicProjections,
} from './firestore-readers';
import { mapProjectionToPublicEntityView, type PublicProjectionInput } from './map-projection';
import { mapFirestoreSearchIndexDoc } from './map-search-index';
import { collectOneHopNeighborIds, collectTwoHopNeighborIds } from './neighbor-ids';
import {
  fetchReleaseEntitiesListArtifact,
  fetchReleaseSearchIndexArtifact,
} from './release-artifacts';

export type { PublicReadSource };

/** Cross-request cache window for release catalog / search index (seconds). */
const RELEASE_CATALOG_REVALIDATE_SECONDS = 300;

function toNeighborLookup(entity: PublicEntityView): NeighborLookup {
  return {
    id: entity.id,
    displayName: entity.displayName,
    kind: entity.kind,
    summary: entity.summary,
    ...(entity.related !== undefined ? { related: entity.related } : {}),
  };
}

function asRelatedNeighborViews(
  stubs: ReturnType<typeof buildRelatedNeighborStubs>,
): readonly RelatedNeighborView[] {
  return stubs.map((stub) =>
    stub.timespan !== undefined
      ? {
          id: stub.id,
          displayName: stub.displayName,
          kind: stub.kind,
          summary: stub.summary,
          relationType: stub.relationType,
          direction: stub.direction,
          timespan: stub.timespan,
        }
      : {
          id: stub.id,
          displayName: stub.displayName,
          kind: stub.kind,
          summary: stub.summary,
          relationType: stub.relationType,
          direction: stub.direction,
        },
  );
}

/** Attach 1-hop stubs + capped 2-hop continue-learning using a neighbor catalog. */
export function hydrateEntityLearningLinks(
  entity: PublicEntityView,
  catalog: readonly PublicEntityView[],
): PublicEntityView {
  const neighborsById = new Map(catalog.map((item) => [item.id, toNeighborLookup(item)]));
  neighborsById.set(entity.id, toNeighborLookup(entity));

  const relatedNeighbors = asRelatedNeighborViews(
    buildRelatedNeighborStubs(entity.related, neighborsById),
  );
  const continueLearning = asRelatedNeighborViews(
    composeContinueLearningStubs(entity.id, relatedNeighbors, neighborsById),
  );

  return {
    ...entity,
    ...(relatedNeighbors.length > 0 ? { relatedNeighbors } : {}),
    ...(continueLearning.length > 0 ? { continueLearning } : {}),
  };
}

function mapProjectionsToHydratedViews(
  projections: readonly PublicEntityProjectionDoc[],
): readonly PublicEntityView[] {
  const mapped = projections.map((projection) =>
    mapProjectionToPublicEntityView(projection as PublicProjectionInput),
  );
  return mapped.map((entity) => hydrateEntityLearningLinks(entity, mapped));
}

function projectionsFromArtifactEntities(
  entities: readonly unknown[],
): PublicEntityProjectionDoc[] {
  const out: PublicEntityProjectionDoc[] = [];
  for (const entity of entities) {
    const parsed = parseEntityProjection(entity);
    if (parsed) out.push(parsed);
  }
  return out;
}

function searchDocsFromArtifact(
  docs: readonly unknown[],
): PublicSearchIndexDoc[] {
  const out: PublicSearchIndexDoc[] = [];
  for (const doc of docs) {
    const parsed = parseSearchIndexDoc(doc);
    if (parsed) out.push(mapFirestoreSearchIndexDoc(parsed));
  }
  return out;
}

async function loadLiveEntitiesForRelease(
  releaseId: string,
): Promise<readonly PublicEntityView[] | undefined> {
  const artifact = await fetchReleaseEntitiesListArtifact(releaseId);
  if (artifact && artifact.entities.length > 0) {
    const projections = projectionsFromArtifactEntities(artifact.entities);
    if (projections.length > 0) return mapProjectionsToHydratedViews(projections);
  }

  const projections = await listPublicEntityProjections(releaseId);
  if (projections.length === 0) return undefined;
  return mapProjectionsToHydratedViews(projections);
}

async function loadLiveSearchIndexForRelease(
  releaseId: string,
): Promise<readonly PublicSearchIndexDoc[] | undefined> {
  const artifact = await fetchReleaseSearchIndexArtifact(releaseId);
  if (artifact && artifact.docs.length > 0) {
    const mapped = searchDocsFromArtifact(artifact.docs);
    if (mapped.length > 0) return mapped;
  }

  const firestoreDocs = await listPublicSearchIndexDocs(releaseId);
  if (firestoreDocs.length > 0) {
    return firestoreDocs.map((doc: FirestoreSearchIndexDoc) => mapFirestoreSearchIndexDoc(doc));
  }
  return undefined;
}

function cachedLiveEntities(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicEntityView[] | undefined> {
  return unstable_cache(
    async () => loadLiveEntitiesForRelease(releaseId),
    ['public-release-entities', releaseId, activatedAt],
    { revalidate: RELEASE_CATALOG_REVALIDATE_SECONDS },
  )();
}

function cachedLiveSearchIndex(
  releaseId: string,
  activatedAt: string,
): Promise<readonly PublicSearchIndexDoc[] | undefined> {
  return unstable_cache(
    async () => loadLiveSearchIndexForRelease(releaseId),
    ['public-release-search-index', releaseId, activatedAt],
    { revalidate: RELEASE_CATALOG_REVALIDATE_SECONDS },
  )();
}

async function loadLiveEntities(): Promise<readonly PublicEntityView[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await fetchActiveRelease();
  if (!active) return undefined;
  return cachedLiveEntities(active.releaseId, active.activatedAt);
}

/**
 * Live single-entity path: point-get the entity + bounded related/2-hop neighbors.
 * Must not full-scan `publicReleases/{id}/entities` (that was ~N reads per entity page).
 */
async function loadLiveEntity(entityId: string): Promise<PublicEntityView | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await fetchActiveRelease();
  if (!active) return undefined;
  const projection = await fetchPublicEntityProjection(active.releaseId, entityId);
  if (!projection) return undefined;
  const entity = mapProjectionToPublicEntityView(projection as PublicProjectionInput);

  try {
    const oneHopIds = collectOneHopNeighborIds(entity);
    const oneHopProjections = await fetchPublicEntityProjectionsByIds(
      active.releaseId,
      oneHopIds,
    );
    const oneHopViews = oneHopProjections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    const twoHopIds = collectTwoHopNeighborIds(entityId, oneHopIds, oneHopViews);
    const twoHopProjections = await fetchPublicEntityProjectionsByIds(
      active.releaseId,
      twoHopIds,
    );
    const twoHopViews = twoHopProjections.map((item) =>
      mapProjectionToPublicEntityView(item as PublicProjectionInput),
    );
    const catalog = [entity, ...oneHopViews, ...twoHopViews];
    return hydrateEntityLearningLinks(entity, catalog);
  } catch {
    return hydrateEntityLearningLinks(entity, [...listPublicEntities(), entity]);
  }
}

/** Resolve one entity: live projection first, then bundled seed snapshot.  */
export const resolvePublicEntityView = cache(
  async function resolvePublicEntityView(
    entityId: string,
  ): Promise<PublicReadResult<PublicEntityView>> {
    return resolvePublicEntity(entityId, () => loadLiveEntity(entityId));
  },
);

/** List entities from live release artifacts/cache, falling back to seed.  */
export const listPublicEntityViews = cache(async function listPublicEntityViews(): Promise<{
  readonly data: readonly PublicEntityView[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: listPublicEntities(), source: 'snapshot' };
  }

  try {
    const live = await loadLiveEntities();
    if (live !== undefined) {
      return { data: live, source: 'live' };
    }
  } catch {
    // fall through
  }

  return { data: listPublicEntities(), source: 'snapshot' };
});

/**
 * Search index: prefer release search-index artifact, then Firestore `publicSearchIndex`,
 * then bundled seed. Never rebuilds from a full entity projection scan when live index exists.
 */
export const getPublicSearchIndex = cache(async function getPublicSearchIndex(): Promise<{
  readonly data: readonly PublicSearchIndexDoc[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: getSnapshotSearchIndex(), source: 'snapshot' };
  }

  try {
    if (shouldUseLivePublicProjections()) {
      const active = await fetchActiveRelease();
      if (active) {
        const live = await cachedLiveSearchIndex(active.releaseId, active.activatedAt);
        if (live !== undefined && live.length > 0) {
          return { data: live, source: 'live' };
        }
      }
    }
  } catch {
    // fall through
  }

  return { data: getSnapshotSearchIndex(), source: 'snapshot' };
});

/** Sync helpers for call sites that still need seed during static generation.  */
export function getSeedPublicEntity(entityId: string): PublicEntityView | undefined {
  return getPublicEntity(entityId);
}

export function listSeedPublicEntities(): readonly PublicEntityView[] {
  return listPublicEntities();
}
