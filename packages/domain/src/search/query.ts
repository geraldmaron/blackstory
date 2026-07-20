/**
 * The public search execution pipeline: filter -> facet -> rank/sort -> paginate ->
 * explain. Pure and deterministic.
 */
import { applyFilters, computeFacetCounts } from './facets.js';
import { buildExplanation } from './explain.js';
import { rankRecords, type RankedRecord } from './ranking.js';
import type {
  PublicSearchIndexDoc,
  SearchExecutionInput,
  SearchExecutionResult,
  SearchResultView,
  SearchSort,
} from './types.js';

/** Earliest decade-bucket year on a record, or +Infinity when it carries none. */
function earliestEraYear(buckets: readonly string[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const bucket of buckets) {
    const year = Number.parseInt(bucket, 10);
    if (Number.isFinite(year) && year < min) min = year;
  }
  return min;
}

/** Latest decade-bucket year on a record, or -Infinity when it carries none. */
function latestEraYear(buckets: readonly string[]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const bucket of buckets) {
    const year = Number.parseInt(bucket, 10);
    if (Number.isFinite(year) && year > max) max = year;
  }
  return max;
}

/**
 * Reorders the relevance-ranked list per the requested sort. `relevance` keeps the rank order as
 * produced by `rankRecords` (text tier -> connection strength -> id). Every other mode re-sorts
 * with `id` ascending as the final deterministic tie-break. `distance` has no geo signal in the
 * domain search index (coordinates are resolved by the route/geo layer), so it falls back to
 * relevance order here.
 */
function sortRanked(ranked: readonly RankedRecord[], sort: SearchSort): readonly RankedRecord[] {
  if (sort === 'relevance' || sort === 'distance') return ranked;

  const copy = [...ranked];
  copy.sort((a, b) => {
    switch (sort) {
      case 'name_asc':
        return (
          a.record.nameLower.localeCompare(b.record.nameLower) ||
          a.record.id.localeCompare(b.record.id)
        );
      case 'name_desc':
        return (
          b.record.nameLower.localeCompare(a.record.nameLower) ||
          a.record.id.localeCompare(b.record.id)
        );
      case 'date_asc':
        return (
          earliestEraYear(a.record.eraBuckets) - earliestEraYear(b.record.eraBuckets) ||
          a.record.id.localeCompare(b.record.id)
        );
      case 'date_desc':
        return (
          latestEraYear(b.record.eraBuckets) - latestEraYear(a.record.eraBuckets) ||
          a.record.id.localeCompare(b.record.id)
        );
      default:
        return a.record.id.localeCompare(b.record.id);
    }
  });
  return copy;
}

function toResultView(ranked: RankedRecord, query: string): SearchResultView {
  const { record, matchedOn, matchedText } = ranked;
  return {
    id: record.id,
    kind: record.kind,
    displayName: record.displayName,
    ...(record.summary !== undefined ? { summary: record.summary } : {}),
    matchedOn,
    matchedText,
    explanation: buildExplanation(record, matchedOn, matchedText, query),
    ...(record.status !== undefined ? { status: record.status } : {}),
    eraBuckets: record.eraBuckets,
    notabilityLabels: record.notabilityLabels,
    ...(record.sensitivityClass !== undefined ? { sensitivityClass: record.sensitivityClass } : {}),
  };
}

/**
 * Executes a search over a persisted index. Steps:
 * 1. `applyFilters` narrows to the allowlisted-filter set.
 * 2. Facets are computed over that FILTERED set (independent of the text query, before
 * pagination) so counts reflect the universe reachable under the current filters the
 * standard "what you'd get if you changed this filter" faceting model. (Per-dimension
 * self-exclusion is intentionally not implemented; `computeFacetCounts` takes a single set.)
 * 3. `rankRecords` applies text matching + relevance/connection-strength ordering; `sortRanked`
 * then reorders per the requested sort. Non-matching records are dropped here, so
 * `totalMatched` reflects the text query.
 * 4. Pagination slices `[offset, offset + pageSize)`.
 * 5. Explanations are built for the page.
 */
export function runPublicSearch(
  input: SearchExecutionInput,
  index: readonly PublicSearchIndexDoc[],
): SearchExecutionResult {
  const filtered = applyFilters(index, input.filters);
  const facets = computeFacetCounts(filtered);

  const ranked = sortRanked(rankRecords(input.normalizedQuery, filtered), input.sort);
  const totalMatched = ranked.length;

  const page = ranked.slice(input.offset, input.offset + input.pageSize);
  const results = page.map((entry) => toResultView(entry, input.normalizedQuery));

  const hasMore = input.offset + input.pageSize < totalMatched;

  return { results, facets, totalMatched, hasMore };
}
