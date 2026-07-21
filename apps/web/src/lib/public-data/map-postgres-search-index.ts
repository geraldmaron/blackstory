/**
 * Maps `bb_public.search_index` rows into Firestore-shaped search docs for existing parsers
 * and `mapFirestoreSearchIndexDoc` (denormalized columns + optional `facets` overflow).
 */
import type { PublicSearchIndexDoc as FirestorePublicSearchIndexDoc } from '@repo/firebase';
import { parseSearchIndexDoc } from './firestore-readers';

type SearchIndexRow = {
  readonly id: string;
  readonly release_id: string;
  readonly entity_id: string | null;
  readonly name: string | null;
  readonly name_lower: string | null;
  readonly aliases: readonly string[] | null;
  readonly topics: readonly string[] | null;
  readonly kind: string | null;
  readonly status: string | null;
  readonly geohash: string | null;
  readonly related_count: number | null;
  readonly claim_count: number | null;
  readonly facets: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

export function mapPostgresSearchIndexRow(row: SearchIndexRow): FirestorePublicSearchIndexDoc | undefined {
  const facets = asRecord(row.facets);
  if (typeof facets.recordMaturity === 'string' && typeof facets.researchCoverage === 'string') {
    return parseSearchIndexDoc(facets);
  }

  const displayName = row.name ?? facets.displayName;
  if (typeof displayName !== 'string' || displayName.length === 0) return undefined;
  const nameLower =
    row.name_lower ??
    (typeof facets.nameLower === 'string' ? facets.nameLower : displayName.toLowerCase());
  const kind = row.kind ?? facets.kind;
  if (typeof kind !== 'string' || kind.length === 0) return undefined;

  const doc: Record<string, unknown> = {
    id: row.id,
    releaseId: row.release_id,
    kind,
    displayName,
    nameLower,
    aliases: row.aliases ?? asStringArray(facets.aliases),
    topicTags: row.topics ?? asStringArray(facets.topicTags),
    topicIds: asStringArray(facets.topicIds),
    mentionedEntityIds: asStringArray(facets.mentionedEntityIds),
    keywords: asStringArray(facets.keywords),
    campaignIds: asStringArray(facets.campaignIds),
    eraBuckets: asStringArray(facets.eraBuckets),
    notabilityBasis: Array.isArray(facets.notabilityBasis) ? facets.notabilityBasis : [],
    notabilityLabels: asStringArray(facets.notabilityLabels),
    recordMaturity:
      typeof facets.recordMaturity === 'string' ? facets.recordMaturity : 'minimum_record',
    researchCoverage:
      facets.researchCoverage === 'minimal' ||
      facets.researchCoverage === 'partial' ||
      facets.researchCoverage === 'substantial'
        ? facets.researchCoverage
        : 'minimal',
    relatedCount: row.related_count ?? (typeof facets.relatedCount === 'number' ? facets.relatedCount : 0),
    claimCount: row.claim_count ?? (typeof facets.claimCount === 'number' ? facets.claimCount : 0),
    ...(typeof facets.summary === 'string' ? { summary: facets.summary } : {}),
    ...(typeof row.status === 'string'
      ? { status: row.status }
      : typeof facets.status === 'string'
        ? { status: facets.status }
        : {}),
    ...(typeof facets.jurisdictionState === 'string'
      ? { jurisdictionState: facets.jurisdictionState }
      : {}),
    ...(typeof facets.sensitivityClass === 'string'
      ? { sensitivityClass: facets.sensitivityClass }
      : {}),
    ...(typeof row.geohash === 'string' ? { geohash: row.geohash } : {}),
    ...(typeof row.entity_id === 'string' ? { entityId: row.entity_id } : {}),
    ...(toIso(facets.createdAt) !== undefined ? { createdAt: toIso(facets.createdAt) } : {}),
  };

  return parseSearchIndexDoc(doc);
}
