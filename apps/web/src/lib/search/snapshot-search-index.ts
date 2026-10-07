/** Deterministic snapshot search index for isolated fixtures and explicitly supplied release data. */
import {
  buildPublicSearchIndexDocs,
  type PublicSearchIndexDoc,
  type SearchableEntityRecord,
} from '@repo/domain';
import { listPublicEntities, type PublicEntityView } from '../../data/public-seed';

function toSearchableRecord(entity: PublicEntityView): SearchableEntityRecord {
  return {
    id: entity.id,
    kind: entity.kind,
    displayName: entity.displayName,
    nameLower: entity.displayName.toLowerCase(),
    // The seed catalog has no EntityAlias data yet no fixture entity has recorded aliases.
    aliases: [],
    ...(entity.summary !== undefined ? { summary: entity.summary } : {}),
    topicTags: entity.topicTags,
    jurisdictionState: entity.jurisdictionLabel,
    ...(entity.status !== undefined ? { status: entity.status } : {}),
    eraBuckets: entity.eraBuckets ?? [],
    notabilityBasis: entity.notabilityBasis ?? [],
    notabilityLabels: entity.notabilityLabels ?? [],
    ...(entity.sensitivityClass !== undefined ? { sensitivityClass: entity.sensitivityClass } : {}),
    recordMaturity: entity.recordMaturity,
    researchCoverage: entity.researchCoverage,
    relatedCount: entity.related?.length ?? entity.relatedIds.length,
    claimCount: entity.claims.length,
  };
}

const SNAPSHOT_RELEASE_ID = 'seed-snapshot';

let cachedIndex: readonly PublicSearchIndexDoc[] | undefined;

/**
 * Builds (and memoizes) the search index from the bundled seed catalog. Any fixture missing a
 * notability basis is skipped by the real notability gate, not silently included — see
 * `buildPublicSearchIndexDocs`. Call `resetSnapshotSearchIndexCache` in tests that mutate
 * process state the gate depends on.
 */
export function getSnapshotSearchIndex(): readonly PublicSearchIndexDoc[] {
  if (!cachedIndex) {
    cachedIndex = buildSearchIndexForEntities(listPublicEntities());
  }
  return cachedIndex;
}

/**
 * Builds a search index from an arbitrary entity catalog (e.g. the live public release the
 * `/history` page actually renders), so search covers the same records on screen rather than
 * the bundled seed snapshot. Not memoized — callers own caching of the source catalog.
 */
export function buildSearchIndexForEntities(
  entities: readonly PublicEntityView[],
  releaseId: string = SNAPSHOT_RELEASE_ID,
): readonly PublicSearchIndexDoc[] {
  const records = entities.map(toSearchableRecord);
  const { docs } = buildPublicSearchIndexDocs(releaseId, records);
  return docs;
}

export function resetSnapshotSearchIndexCache(): void {
  cachedIndex = undefined;
}
