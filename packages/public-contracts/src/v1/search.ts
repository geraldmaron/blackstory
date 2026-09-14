/**
 * Public search request/result shapes — extracted from `packages/domain/src/search/types.ts`'s
 * `SearchResultView`, `SearchFacetCounts`, `SearchFilter`, `SearchSort`, `SearchExecutionInput`.
 *
 * That module's own doc comment is the clearest statement of the exclusion this schema must
 * preserve: "Nothing here exposes a raw relevance score, an evidence count, or any other numeric
 * ranking signal to end users: the only numeric fields (`relatedCount`, `claimCount`) live on the
 * server-internal record/index-doc shapes ... and are explicitly NEVER carried into the
 * client-facing `SearchResultView`." This schema has no field for either — see `search.test.ts`'s
 * negative-snapshot case for the proof that a fixture carrying them gets stripped on parse.
 *
 * `confidenceTier` on the result below does not weaken that: it is a graded assessment, already
 * public on `/v1/map`, not a number anyone can rank by. The line the exclusion draws is
 * count-versus-assessment, not evidence-versus-silence.
 */
import { z } from 'zod';
import { boundedArray, idString, nonEmptyText } from '../internal/primitives.js';
import { confidenceTierSchema } from './map.js';
import { cursorPageRequestSchema } from './pagination.js';

export const SEARCH_MATCH_FIELDS = ['displayName', 'alias', 'summary', 'topicTags'] as const;
export const searchMatchFieldSchema = z.enum(SEARCH_MATCH_FIELDS);
export type SearchMatchFieldV1 = (typeof SEARCH_MATCH_FIELDS)[number];

export const SEARCH_FILTER_FIELDS = [
  'kind',
  'state',
  'precision',
  'releaseId',
  'status',
  'era',
] as const;
export const searchFilterFieldSchema = z.enum(SEARCH_FILTER_FIELDS);
export type SearchFilterFieldV1 = (typeof SEARCH_FILTER_FIELDS)[number];

export const searchFilterV1Schema = z.object({
  field: searchFilterFieldSchema,
  value: nonEmptyText(200),
});

export type SearchFilterV1 = z.infer<typeof searchFilterV1Schema>;

export const SEARCH_SORTS = [
  'relevance',
  'name_asc',
  'name_desc',
  'date_asc',
  'date_desc',
  'distance',
] as const;
export const searchSortSchema = z.enum(SEARCH_SORTS);
export type SearchSortV1 = (typeof SEARCH_SORTS)[number];

export const searchRequestV1Schema = z.object({
  query: z.string().max(500),
  filters: boundedArray(searchFilterV1Schema, 20).optional(),
  sort: searchSortSchema.default('relevance'),
  page: cursorPageRequestSchema.optional(),
});

export type SearchRequestV1 = z.infer<typeof searchRequestV1Schema>;

/**
 * A single client-facing search result. Deliberately carries NO numeric relevance score, NO
 * evidence/connection count — results indicate WHY they match in words (`explanation`), not a
 * number.
 *
 * `confidenceTier` is the one exception, and it is not a counter-example: a tier is an
 * ASSESSMENT of how well a record is supported, the same four-value vocabulary `/v1/map` already
 * publishes on every feature. What is banned here is a per-record NUMBER a reader could sort or
 * rank by — `relatedCount`, `claimCount`, a relevance score, `evidenceCount`. A grade lets the
 * phone draw the same three-segment meter the site draws without handing anyone a ranking key,
 * so the archive stops asking readers to judge a result with no idea how well it is sourced.
 */
export const searchResultV1Schema = z.object({
  id: idString(200),
  kind: nonEmptyText(100),
  displayName: nonEmptyText(300),
  summary: z.string().max(2000).optional(),
  matchedOn: searchMatchFieldSchema,
  matchedText: z.string().max(2000),
  explanation: z.string().max(1000),
  status: z.string().max(100).optional(),
  eraBuckets: boundedArray(z.string().max(20), 200),
  notabilityLabels: boundedArray(z.string().max(300), 100),
  sensitivityClass: z.string().max(100).optional(),
  /**
   * How well the record is supported — the shared `ConfidenceTier` vocabulary, never a count.
   *
   * Optional so a payload minted before this field existed (a cached page on a phone, an older
   * deployment behind the same client) still parses instead of failing the whole response; a
   * reader that gets `undefined` knows the grade is unavailable, which is not the same claim as
   * `unrated`. Producers derive it at read time — it is never cached as a graded conclusion on
   * the search index (see `packages/domain/src/search/types.ts`'s `evidenceInputs`).
   */
  confidenceTier: confidenceTierSchema.optional(),
});

export type SearchResultV1 = z.infer<typeof searchResultV1Schema>;

export const searchFacetCountsV1Schema = z.object({
  kind: z.record(z.string().max(100), z.number().int().min(0)),
  status: z.record(z.string().max(100), z.number().int().min(0)),
  era: z.record(z.string().max(20), z.number().int().min(0)),
  theme: z.record(z.string().max(100), z.number().int().min(0)),
  state: z.record(z.string().max(100), z.number().int().min(0)),
  recordMaturity: z.record(z.string().max(100), z.number().int().min(0)),
  researchCoverage: z.record(z.string().max(100), z.number().int().min(0)),
});

export type SearchFacetCountsV1 = z.infer<typeof searchFacetCountsV1Schema>;

export const MAX_SEARCH_RESULTS_PER_RESPONSE = 100;

export const searchResponseV1Schema = z.object({
  results: boundedArray(searchResultV1Schema, MAX_SEARCH_RESULTS_PER_RESPONSE),
  facets: searchFacetCountsV1Schema,
  totalMatched: z.number().int().min(0),
  hasMore: z.boolean(),
  nextCursor: idString(2048).optional(),
});

export type SearchResponseV1 = z.infer<typeof searchResponseV1Schema>;
