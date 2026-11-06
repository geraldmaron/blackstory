/**
 * What the public archive currently shows for one canonical entity, read from the published
 * search index of the active release. Every field has one named source:
 *
 * - release id: `published.v_active_release_id`
 * - name, claim and related counts, facets: `published.search_index`
 * - coordinates: `published.release_entities.lat`
 *
 * Linked research cases are deliberately absent: there is no direct entity relation for them.
 */
import { queryPostgres } from './canonical-postgres-client.js';

export type EntityPublicationSummary =
  | {
      readonly status: 'published';
      readonly releaseId: string;
      readonly publicName: string;
      readonly recordMaturity: string | null;
      readonly researchCoverage: string | null;
      readonly strongestClaimLevel: string | null;
      readonly evidenceSourceCount: number;
      readonly jurisdictionState: string | null;
      readonly eraBuckets: readonly string[];
      readonly relatedCount: number;
      readonly claimCount: number;
      readonly hasCoordinates: boolean;
    }
  | { readonly status: 'not_published'; readonly releaseId: string };

export type SummaryRow = {
  readonly name: unknown;
  readonly claim_count: unknown;
  readonly related_count: unknown;
  readonly facets: unknown;
  readonly has_coordinates: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
}

function asStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/** Enum values read as words: underscores become spaces, first letter capitalized. */
export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const spaced = value.replace(/_/g, ' ').trim();
  if (!spaced) return 'Not recorded';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Pure: JSONB facets are untrusted, so a wrong type becomes null or empty, never a throw. */
export function parseEntityPublicationSummary(
  releaseId: string,
  row: SummaryRow | undefined,
): EntityPublicationSummary {
  if (!row) return { status: 'not_published', releaseId };
  const facets = asRecord(row.facets);
  const evidence = asRecord(facets.evidenceInputs);
  return {
    status: 'published',
    releaseId,
    publicName: asNonEmptyString(row.name) ?? '',
    recordMaturity: asNonEmptyString(facets.recordMaturity),
    researchCoverage: asNonEmptyString(facets.researchCoverage),
    strongestClaimLevel: asNonEmptyString(evidence.strongestClaimLevel),
    evidenceSourceCount: asStringList(evidence.evidenceLineageKeys).length,
    jurisdictionState: asNonEmptyString(facets.jurisdictionState),
    eraBuckets: asStringList(facets.eraBuckets),
    relatedCount: asCount(row.related_count),
    claimCount: asCount(row.claim_count),
    hasCoordinates: row.has_coordinates === true,
  };
}

export async function readEntityPublicationSummary(
  entityId: string,
): Promise<EntityPublicationSummary> {
  const releases = await queryPostgres<{ readonly release_id: string }>(
    `SELECT release_id FROM published.v_active_release_id`,
  );
  const releaseId = releases[0]?.release_id ?? '';

  const rows = await queryPostgres<SummaryRow>(
    `SELECT
       s.name, s.claim_count, s.related_count, s.facets,
       (SELECT re.lat IS NOT NULL
          FROM published.release_entities re
         WHERE re.release_id = s.release_id AND re.entity_id = s.entity_id
         LIMIT 1) AS has_coordinates
     FROM published.search_index s
     WHERE s.release_id = $1 AND s.entity_id = $2`,
    [releaseId, entityId],
  );
  return parseEntityPublicationSummary(releaseId, rows[0]);
}
