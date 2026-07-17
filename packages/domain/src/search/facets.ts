/**
 * Faceted-search aggregation and allowlisted filtering.
 *
 * Both functions are pure. `computeFacetCounts` is a plain counting aggregation; `applyFilters`
 * enforces the 6 allowlisted filter fields with AND semantics across fields.
 */
import type {
  SearchFacetCounts,
  SearchFilter,
  SearchableEntityRecord,
} from './types.js';

function increment(counts: Record<string, number>, key: string | undefined): void {
  if (key === undefined || key === '') return;
  counts[key] = (counts[key] ?? 0) + 1;
}

/**
 * Counts records across every facet dimension. Multi-valued dimensions (era buckets, topic tags)
 * increment every value a record carries. Undefined/empty values are skipped rather than counted
 * under an empty-string key.
 */
export function computeFacetCounts(records: readonly SearchableEntityRecord[]): SearchFacetCounts {
  const kind: Record<string, number> = {};
  const status: Record<string, number> = {};
  const era: Record<string, number> = {};
  const theme: Record<string, number> = {};
  const state: Record<string, number> = {};
  const recordMaturity: Record<string, number> = {};
  const researchCoverage: Record<string, number> = {};

  for (const record of records) {
    increment(kind, record.kind);
    increment(status, record.status);
    increment(state, record.jurisdictionState);
    increment(recordMaturity, record.recordMaturity);
    increment(researchCoverage, record.researchCoverage);
    for (const bucket of record.eraBuckets) increment(era, bucket);
    for (const tag of record.topicTags) increment(theme, tag);
  }

  return { kind, status, era, theme, state, recordMaturity, researchCoverage };
}

/**
 * Returns whether a record satisfies a single filter.
 *
 * `precision` and `releaseId` are handled as pass-through no-ops when the field is absent from the
 * record shape rather than crashing: `SearchableEntityRecord` has no `precision` field (public
 * location precision is enforced upstream at projection-build time, not in the domain search
 * index), and `releaseId` exists only on `PublicSearchIndexDoc`. When the field IS present
 * (a `PublicSearchIndexDoc` carrying `releaseId`), it is matched exactly.
 */
function recordSatisfies(record: SearchableEntityRecord, filter: SearchFilter): boolean {
  switch (filter.field) {
    case 'kind':
      return record.kind === filter.value;
    case 'state':
      return record.jurisdictionState === filter.value;
    case 'status':
      return record.status === filter.value;
    case 'era':
      return record.eraBuckets.includes(filter.value);
    case 'releaseId': {
      const releaseId = (record as { readonly releaseId?: string }).releaseId;
      return releaseId === undefined || releaseId === filter.value;
    }
    case 'precision':
      // No `precision` field on the domain search record pass-through no-op (documented above).
      return true;
    default:
      return true;
  }
}

/**
 * Narrows records to those satisfying EVERY filter (AND across fields). Generic in the record type
 * so a `PublicSearchIndexDoc` in yields a `PublicSearchIndexDoc` out preserving `releaseId`
 * for downstream use in `runPublicSearch`.
 */
export function applyFilters<T extends SearchableEntityRecord>(
  records: readonly T[],
  filters: readonly SearchFilter[],
): readonly T[] {
  if (filters.length === 0) return records;
  return records.filter((record) => filters.every((filter) => recordSatisfies(record, filter)));
}
