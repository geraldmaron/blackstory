/**
 * Public data source selector: live Firestore projections with seed snapshot fallback.
 */

import type { PublicSearchIndexDoc } from '@black-book/domain';
import { buildPublicSearchIndexDocs, type SearchableEntityRecord } from '@black-book/domain';
import {
  getPublicEntity,
  listPublicEntities,
  type PublicEntityView,
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

async function loadLiveEntities(): Promise<readonly PublicEntityView[] | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await fetchActiveRelease();
  if (!active) return undefined;
  const projections = await listPublicEntityProjections(active.releaseId);
  if (projections.length === 0) return undefined;
  return projections.map((projection) =>
    mapProjectionToPublicEntityView(projection as PublicProjectionInput),
  );
}

async function loadLiveEntity(entityId: string): Promise<PublicEntityView | undefined> {
  if (!shouldUseLivePublicProjections()) return undefined;
  const active = await fetchActiveRelease();
  if (!active) return undefined;
  const projection = await fetchPublicEntityProjection(active.releaseId, entityId);
  if (!projection) return undefined;
  return mapProjectionToPublicEntityView(projection as PublicProjectionInput);
}

/** Resolve one entity: live projection first, then bundled seed snapshot. */
export async function resolvePublicEntityView(
  entityId: string,
): Promise<PublicReadResult<PublicEntityView>> {
  return resolvePublicEntity(entityId, () => loadLiveEntity(entityId));
}

/** List entities from live release, falling back to seed. */
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

/** Sync helpers for call sites that still need seed during static generation. */
export function getSeedPublicEntity(entityId: string): PublicEntityView | undefined {
  return getPublicEntity(entityId);
}

export function listSeedPublicEntities(): readonly PublicEntityView[] {
  return listPublicEntities();
}
