/**
 * Maps Postgres/artifact search-index projections into `@repo/domain`'s `PublicSearchIndexDoc`
 * so `runPublicSearch` can consume the written index without rebuilding from entity scans.
 */
import type { NotabilityBasisRecord, PublicSearchIndexDoc } from '@repo/domain';
import type { PublicSearchProjectionDoc } from '@repo/schemas';

export function mapPublicSearchProjection(doc: PublicSearchProjectionDoc): PublicSearchIndexDoc {
  const notabilityBasis: readonly NotabilityBasisRecord[] = doc.notabilityBasis.map((entry) => ({
    criterion: entry.criterion as NotabilityBasisRecord['criterion'],
    note: entry.note,
    evidenceIds: entry.evidenceIds,
  }));

  return {
    id: doc.id,
    releaseId: doc.releaseId,
    kind: doc.kind,
    displayName: doc.displayName,
    nameLower: doc.nameLower,
    aliases: doc.aliases,
    ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
    topicTags: doc.topicTags,
    ...(doc.topicIds.length > 0 ? { topicIds: doc.topicIds } : {}),
    ...(doc.jurisdictionState !== undefined ? { jurisdictionState: doc.jurisdictionState } : {}),
    ...(doc.status !== undefined ? { status: doc.status } : {}),
    eraBuckets: doc.eraBuckets,
    notabilityBasis,
    notabilityLabels: doc.notabilityLabels,
    ...(doc.sensitivityClass !== undefined ? { sensitivityClass: doc.sensitivityClass } : {}),
    recordMaturity: doc.recordMaturity,
    researchCoverage: doc.researchCoverage,
    relatedCount: doc.relatedCount,
    claimCount: doc.claimCount,
  };
}
