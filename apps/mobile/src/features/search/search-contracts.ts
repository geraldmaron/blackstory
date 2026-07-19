/**
 * Vendored `/v1/search` wire-contract types + request/response shaping (MOB-013).
 *
 * INTEGRATION GAP (same one apps/mobile/src/data/contracts.ts already documents): apps/mobile
 * cannot import @repo/public-contracts (own isolated npm lockfile, not in the pnpm workspace
 * graph). That file's own header says "EntityV1 / SearchResponseV1 / MapViewport ->
 * packages/public-contracts/src/v1/{entity,search,map}.ts" as its source-of-truth list, but does
 * NOT actually vendor SearchResponseV1 -- this module fills that specific gap for the search
 * feature, kept field-identical to packages/public-contracts/src/v1/search.ts. When the workspace
 * wiring is fixed (tracked as a follow-up), delete this and import the real zod types instead.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT CARRY: packages/public-contracts/src/v1/search.ts's own
 * header states the guarantee this type set exists to preserve -- "Nothing here exposes a raw
 * relevance score, an evidence count, or any other numeric ranking signal to end users." Every
 * field below is a 1:1 mirror of that schema; there is no `relevanceScore`/`rank`/`score`/
 * `claimCount`/`relatedCount` field anywhere in `SearchResultV1`, on purpose, matching the source
 * of truth exactly rather than "trusting" it from a distance. `assertNoRankingSignal` (below) is
 * the runtime backstop for the "don't just trust it blindly" requirement: it inspects the ACTUAL
 * parsed response for a forbidden field name before anything is handed to the UI layer, so even
 * if a future contract regression (or a compromised/misbehaving server) added one, this feature
 * would refuse to render the field, not silently pass it through.
 *
 * SERVER-SUPPORTED FILTERS: apps/api-public/src/search-guardrails.ts's `PublicSearchHttpQuery`
 * allow-lists exactly `kind`, `state`, `precision`, `releaseId` as HTTP filter query params for
 * `/v1/search` (there is no `era` param on this endpoint, unlike the web page's own
 * domain-level search, which runs a different code path). This feature therefore only wires the
 * `kind` filter through to the real request; passing `era` here would silently do nothing on the
 * server, so it is intentionally not offered as a live-query filter (browse-mode's category
 * chips still use `kind`, which IS supported end-to-end).
 */

export const SEARCH_MATCH_FIELDS = ['displayName', 'alias', 'summary', 'topicTags'] as const;
export type SearchMatchFieldV1 = (typeof SEARCH_MATCH_FIELDS)[number];

export const SEARCH_SORTS = [
  'relevance',
  'name_asc',
  'name_desc',
  'date_asc',
  'date_desc',
  'distance',
] as const;
export type SearchSortV1 = (typeof SEARCH_SORTS)[number];

/** A single client-facing search result. Mirrors `searchResultV1Schema` field-for-field. */
export interface SearchResultV1 {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly matchedOn: SearchMatchFieldV1;
  readonly matchedText: string;
  readonly explanation: string;
  readonly status?: string;
  readonly eraBuckets: readonly string[];
  readonly notabilityLabels: readonly string[];
  readonly sensitivityClass?: string;
}

export interface SearchFacetCountsV1 {
  readonly kind: Readonly<Record<string, number>>;
  readonly status: Readonly<Record<string, number>>;
  readonly era: Readonly<Record<string, number>>;
  readonly theme: Readonly<Record<string, number>>;
  readonly state: Readonly<Record<string, number>>;
  readonly recordMaturity: Readonly<Record<string, number>>;
  readonly researchCoverage: Readonly<Record<string, number>>;
}

export const MAX_SEARCH_RESULTS_PER_RESPONSE = 100;

export interface SearchResponseV1 {
  readonly results: readonly SearchResultV1[];
  readonly facets: SearchFacetCountsV1;
  readonly totalMatched: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

/** Field names that must NEVER appear on a search result reaching this app's UI layer -- numeric
 * ranking/relevance/evidence-volume signals the public contract is designed to exclude. Checked
 * at runtime against the ACTUAL parsed payload (see `assertNoRankingSignal`), not merely assumed
 * from the TypeScript type (a compile-time type cannot protect against a malformed/compromised
 * runtime response). */
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

/** Throws if any object in `results` (as actually parsed from the network, before any mapping to
 * UI props) carries a forbidden ranking-signal field. Called once, immediately after parsing a
 * `/v1/search` response, before anything downstream (cache write, card mapping) ever sees it. */
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

/** Matches `DEFAULT_QUERY_GUARDRAIL_LIMITS.defaultPageSize` (packages/security/src/query-guardrails.ts). */
export const DEFAULT_SEARCH_PAGE_SIZE = 20;

const SEARCH_PATH = '/v1/search';

/**
 * Builds the `/v1/search` request path + query string. Deterministic: the same params always
 * produce the same path (required for the "deterministic filters" requirement and for the
 * release-cache hash key to be stable across calls for the same logical query+filter shape).
 */
export function buildSearchRequestPath(params: SearchRequestParams): string {
  const search = new URLSearchParams();
  search.set('q', params.query);
  if (params.kind) search.set('kind', params.kind);
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  if (params.cursor) search.set('cursor', params.cursor);
  return `${SEARCH_PATH}?${search.toString()}`;
}

/**
 * The bounded, normalized "query shape" used as the cache/salt-hash input (never the raw display
 * text alone in isolation from its filters -- two different filter combinations for the same
 * text are different cached entries, matching ADR-022's "normalized query-shape hash"). Filters
 * are serialized in a fixed key order so the shape string is stable regardless of object key
 * insertion order.
 */
export function buildQueryShapeKey(params: { readonly query: string; readonly kind?: string }): string {
  return `q=${params.query}&kind=${params.kind ?? ''}`;
}
