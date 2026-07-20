/**
 * Search wire contracts + request shaping (MOB-013 / repo-hfz0).
 *
 * Result/request types come from `@repo/public-contracts/v1/search`. This
 * module keeps mobile-only request-path helpers and the runtime ranking-signal
 * tripwire that refuses to render a leaked score/count field even if a
 * compromised response carried one.
 */
export {
  SEARCH_MATCH_FIELDS,
  SEARCH_SORTS,
  MAX_SEARCH_RESULTS_PER_RESPONSE,
  type SearchMatchFieldV1,
  type SearchSortV1,
  type SearchResultV1,
  type SearchFacetCountsV1,
  type SearchResponseV1,
} from '@repo/public-contracts/v1/search';

/** Field names that must NEVER appear on a search result reaching this app's UI layer. */
const FORBIDDEN_RANKING_FIELD_PATTERNS: readonly RegExp[] = [
  /relevance/i,
  /^score$/i,
  /_?score$/i,
  /^rank(ing)?$/i,
  /_?rank(ing)?$/i,
  /claim_?count/i,
  /related_?count/i,
  /evidence_?count/i,
];

export class RankingSignalLeakError extends Error {
  constructor(readonly field: string) {
    super(`search result carried forbidden ranking/relevance field "${field}"`);
    this.name = 'RankingSignalLeakError';
  }
}

/** Throws if any parsed search result carries a forbidden ranking-signal field. */
export function assertNoRankingSignal(results: readonly Record<string, unknown>[]): void {
  for (const result of results) {
    for (const key of Object.keys(result)) {
      if (FORBIDDEN_RANKING_FIELD_PATTERNS.some((p) => p.test(key))) {
        throw new RankingSignalLeakError(key);
      }
    }
  }
}

export interface SearchRequestParams {
  readonly query: string;
  readonly kind?: string;
  readonly cursor?: string;
  readonly pageSize?: number;
}

/** Matches DEFAULT_QUERY_GUARDRAIL_LIMITS.defaultPageSize. */
export const DEFAULT_SEARCH_PAGE_SIZE = 20;

const SEARCH_PATH = '/v1/search';

/** Deterministic `/v1/search` path builder for cache-key stability. */
export function buildSearchRequestPath(params: SearchRequestParams): string {
  const search = new URLSearchParams();
  search.set('q', params.query);
  if (params.kind) search.set('kind', params.kind);
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  if (params.cursor) search.set('cursor', params.cursor);
  return `${SEARCH_PATH}?${search.toString()}`;
}

/** Normalized query-shape hash input (query + filters; never raw text alone). */
export function buildQueryShapeKey(params: { readonly query: string; readonly kind?: string }): string {
  return `q=${params.query}&kind=${params.kind ?? ''}`;
}
