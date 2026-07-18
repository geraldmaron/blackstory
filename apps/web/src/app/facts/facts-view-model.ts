/**
 * Pure query-building + result-shaping core for the fact library page.
 *
 * Runs the real `runPublicSearch` pipeline over the seed fact search index produced by
 * `../../data/facts-seed.ts`'s `getSeedFactSearchIndex` — the same primitives the entity
 * search page uses (`../search/search-view-model.ts`), scoped to published/corrected facts only.
 * Claim-type and confidence sidebar filters are applied as a pre-pass over the index docs (the
 * generic filter vocabulary has no dedicated claimType/confidence fields see
 * `packages/domain/src/facts/search-index.ts`'s mapping of claimType -> `topicTags` and
 * confidence -> `researchCoverage`). No Next.js runtime dependency so this module is directly
 * unit-testable.
 */
import {
  computeFacetCounts,
  runPublicSearch,
  slugifyFactStatement,
  type PublicSearchIndexDoc,
  type SearchFilter,
  type SearchResultView,
} from '@blap/domain';
import { normalizeSearchText } from '@blap/security';

export const FACT_LIBRARY_PAGE_SIZE = 20;

export type RawFactSearchParams = {
  readonly q?: string;
  readonly claimType?: string;
  readonly confidence?: string;
  readonly offset?: string;
};

export type FacetOption = {
  readonly value: string;
  readonly label: string;
};

export type FactLibraryViewModel = {
  readonly q: string;
  readonly claimType: string;
  readonly confidence: string;
  readonly offset: number;
  readonly results: readonly SearchResultView[];
  readonly totalMatched: number;
  readonly hasMore: boolean;
  readonly nextOffset?: number;
  readonly previousOffset?: number;
  readonly claimTypeOptions: readonly FacetOption[];
  readonly confidenceOptions: readonly FacetOption[];
};

export type FactConfidenceLookup = Readonly<Record<string, string>>;

function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

export function parseOffset(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function humanizeFacetKey(key: string): string {
  return key
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildFacetOptions(
  counts: Readonly<Record<string, number>>,
  allLabel: string,
): readonly FacetOption[] {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  return [
    { value: 'all', label: allLabel },
    ...entries.map(([key, count]) => ({
      value: key,
      label: `${humanizeFacetKey(key)} (${count})`,
    })),
  ];
}

function confidenceFacetCounts(
  docs: readonly PublicSearchIndexDoc[],
  confidenceById: FactConfidenceLookup,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const doc of docs) {
    const grade = confidenceById[doc.id];
    if (!grade) continue;
    counts[grade] = (counts[grade] ?? 0) + 1;
  }
  return counts;
}

function applyFactLibraryFilters(
  index: readonly PublicSearchIndexDoc[],
  claimType: string,
  confidence: string,
  confidenceById: FactConfidenceLookup,
): readonly PublicSearchIndexDoc[] {
  return index.filter((doc) => {
    if (claimType !== 'all' && !doc.topicTags.includes(claimType)) return false;
    if (confidence !== 'all' && confidenceById[doc.id] !== confidence) return false;
    return true;
  });
}

export function buildFactLibraryViewModel(
  raw: RawFactSearchParams,
  index: readonly PublicSearchIndexDoc[],
  confidenceById: FactConfidenceLookup,
): FactLibraryViewModel {
  const q = raw.q ?? '';
  const claimType = cleanSelectParam(raw.claimType);
  const confidence = cleanSelectParam(raw.confidence);
  const offset = parseOffset(raw.offset);

  const filteredIndex = applyFactLibraryFilters(index, claimType, confidence, confidenceById);
  const facetSource = applyFactLibraryFilters(index, 'all', 'all', confidenceById);
  const claimTypeCounts = computeFacetCounts(facetSource).theme;
  const confidenceCounts = confidenceFacetCounts(facetSource, confidenceById);

  const normalizedQuery = normalizeSearchText(q);
  const filters: readonly SearchFilter[] = [{ field: 'kind', value: 'fact' }];

  const executionResult = runPublicSearch(
    { normalizedQuery, filters, sort: 'relevance', offset, pageSize: FACT_LIBRARY_PAGE_SIZE },
    filteredIndex,
  );

  const nextOffset = executionResult.hasMore ? offset + FACT_LIBRARY_PAGE_SIZE : undefined;
  const previousOffset = offset > 0 ? Math.max(0, offset - FACT_LIBRARY_PAGE_SIZE) : undefined;

  return {
    q,
    claimType,
    confidence,
    offset,
    results: executionResult.results,
    totalMatched: executionResult.totalMatched,
    hasMore: executionResult.hasMore,
    ...(nextOffset !== undefined ? { nextOffset } : {}),
    ...(previousOffset !== undefined ? { previousOffset } : {}),
    claimTypeOptions: buildFacetOptions(claimTypeCounts, 'All claim types'),
    confidenceOptions: buildFacetOptions(confidenceCounts, 'All confidence grades'),
  };
}

export function buildFactLibraryHref(view: FactLibraryViewModel, offset: number): string {
  const params = new URLSearchParams();
  if (view.q) params.set('q', view.q);
  if (view.claimType !== 'all') params.set('claimType', view.claimType);
  if (view.confidence !== 'all') params.set('confidence', view.confidence);
  if (offset > 0) params.set('offset', String(offset));
  const qs = params.toString();
  return qs ? `/facts?${qs}` : '/facts';
}

export function factPageHref(id: string, shortStatement: string): string {
  return `/facts/${id}/${slugifyFactStatement(shortStatement)}`;
}
