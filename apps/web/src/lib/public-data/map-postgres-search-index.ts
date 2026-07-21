/**
 * Maps `bb_public.search_index` rows into canonical public search projections.
 *
 * Migrated Supabase rows often leave `name` / `entity_id` null while `name_lower` and `id`
 * carry the display string and entity id — recover those before Zod parse.
 */
import type { PublicSearchProjectionDoc } from '@repo/schemas';
import { parseSearchProjection } from './projection-contracts';

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

function isFullSearchIndexDoc(value: Record<string, unknown>): boolean {
  return (
    typeof value.displayName === 'string' &&
    typeof value.nameLower === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.recordMaturity === 'string' &&
    (value.researchCoverage === 'minimal' ||
      value.researchCoverage === 'partial' ||
      value.researchCoverage === 'substantial')
  );
}

/** Recover a display label when migrate left `name` null but populated `name_lower`. */
function displayNameFromRow(
  row: SearchIndexRow,
  facets: Record<string, unknown>,
): string | undefined {
  if (typeof row.name === 'string' && row.name.length > 0) return row.name;
  if (typeof facets.displayName === 'string' && facets.displayName.length > 0) {
    return facets.displayName;
  }
  if (typeof row.name_lower === 'string' && row.name_lower.length > 0) {
    return row.name_lower
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return undefined;
}

export function mapPostgresSearchIndexRow(row: SearchIndexRow): PublicSearchProjectionDoc | undefined {
  const facets = asRecord(row.facets);
  if (isFullSearchIndexDoc(facets)) {
    return parseSearchProjection(facets);
  }

  const displayName = displayNameFromRow(row, facets);
  if (displayName === undefined) return undefined;
  const nameLower =
    row.name_lower ??
    (typeof facets.nameLower === 'string' ? facets.nameLower : displayName.toLowerCase());
  const kind = row.kind ?? facets.kind;
  if (typeof kind !== 'string' || kind.length === 0) return undefined;

  const entityId =
    (typeof row.entity_id === 'string' && row.entity_id.length > 0 ? row.entity_id : undefined) ??
    (typeof facets.entityId === 'string' && facets.entityId.length > 0 ? facets.entityId : undefined) ??
    row.id;

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
    entityId,
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
    ...(toIso(facets.createdAt) !== undefined ? { createdAt: toIso(facets.createdAt) } : {}),
  };

  return parseSearchProjection(doc);
}
