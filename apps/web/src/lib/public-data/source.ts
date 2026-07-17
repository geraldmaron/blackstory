/**
 * Public data source selector: live Firestore projections with seed snapshot fallback.
 * Hydrates 1-hop related neighbor stubs and composes capped 2-hop continue-learning.
 */

import type { PublicSearchIndexDoc } from '@black-book/domain';
import {
  buildPublicSearchIndexDocs,
  buildRelatedNeighborStubs,
  composeContinueLearningStubs,
  type NeighborLookup,
  type SearchableEntityRecord,
} from '@black-book/domain';
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
  listPublicEntityProjections,
  shouldUseLivePublicProjections,
} from './firestore-readers';
import { mapProjectionToPublicEntityView, type PublicProjectionInput } from './map-projection';

export type { PublicReadSource };

function toSearchableRecord(entity: PublicEntityView): SearchableEntityRecord {
  return {
    id: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    nameLower: entity.displayName.toLowerCase(),
    aliases: [],
    ...(entity.summary !== undefined ? { summary: entity.summary } : {}),
    topicTags: entity.topicTags,
    jurisdictionState: entity.jurisdictionLabel,
    ...(entity.status !== undefined ? { status: entity.status } : {}),
    eraBuckets: entity.eraBuckets ?? [],
    notabilityBasis: (entity.notabilityLabels ?? []).map((note) => ({
      criterion: 'documented_site' as const,
      note,
      evidenceIds: [],
    })),
    notabilityLabels: entity.notabilityLabels ?? [],
    ...(entity.sensitivityClass !== undefined ? { sensitivityClass: entity.sensitivityClass } : {}),
    recordMaturity: entity.recordMaturity,
    researchCoverage: entity.researchCoverage,
    relatedCount: entity.related?.length ?? entity.relatedIds.length,
    claimCount: entity.claims.length,
  };
}

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
  // Ensure the entity itself is in the map even if catalog is partial.
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

async function loadLiveEntities(): Promise<readonly PublicEntityView[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await fetchActiveRelease();
  if (!active) return undefined;
  const projections = await listPublicEntityProjections(active.releaseId);
  if (projections.length === 0) return undefined;
  const mapped = projections.map((projection) =>
    mapProjectionToPublicEntityView(projection as PublicProjectionInput),
  );
  return mapped.map((entity) => hydrateEntityLearningLinks(entity, mapped));
}

async function loadLiveEntity(entityId: string): Promise<PublicEntityView | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await fetchActiveRelease();
  if (!active) return undefined;
  const projection = await fetchPublicEntityProjection(active.releaseId, entityId);
  if (!projection) return undefined;
  const entity = mapProjectionToPublicEntityView(projection as PublicProjectionInput);

  // Load sibling projections for neighbor hydration when possible.
  let catalog: readonly PublicEntityView[] = [entity];
  try {
    const all = await listPublicEntityProjections(active.releaseId);
    catalog = all.map((item) => mapProjectionToPublicEntityView(item as PublicProjectionInput));
  } catch {
    // Fall back to seed neighbors for stubs.
    catalog = [...listPublicEntities(), entity];
  }

  return hydrateEntityLearningLinks(entity, catalog);
}

/** Resolve one entity: live projection first, then bundled seed snapshot.  */
export async function resolvePublicEntityView(
  entityId: string,
): Promise<PublicReadResult<PublicEntityView>> {
  return resolvePublicEntity(entityId, () => loadLiveEntity(entityId));
}

/** List entities from live release, falling back to seed.  */
export async function listPublicEntityViews(): Promise<{
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
}

/**
 * Search index: prefer an index rebuilt from live entities when available;
 * otherwise the bundled snapshot index (bootstrap search docs are stubs today).
 */
export async function getPublicSearchIndex(): Promise<{
  readonly data: readonly PublicSearchIndexDoc[];
  readonly source: PublicReadSource;
}> {
  if (isPublicReadApiDisabled()) {
    return { data: getSnapshotSearchIndex(), source: 'snapshot' };
  }

  try {
    const live = await loadLiveEntities();
    if (live !== undefined && live.length > 0) {
      const releaseId = live[0]?.revision.releaseId ?? 'live';
      const { docs } = buildPublicSearchIndexDocs(releaseId, live.map(toSearchableRecord));
      if (docs.length > 0) {
        return { data: docs, source: 'live' };
      }
    }
  } catch {
    // fall through
  }

  return { data: getSnapshotSearchIndex(), source: 'snapshot' };
}

/** Sync helpers for call sites that still need seed during static generation.  */
export function getSeedPublicEntity(entityId: string): PublicEntityView | undefined {
  return getPublicEntity(entityId);
}

export function listSeedPublicEntities(): readonly PublicEntityView[] {
  return listPublicEntities();
}
