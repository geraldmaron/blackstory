/**
 * Pure query-building + result/facet-shaping core for the search page.
 *
 * Split out of `page.tsx` (not merely "kept in the same file") because Next.js's generated typed
 * route module (`.next/types/app/search/page.ts`) rejects any named export from a `page.tsx` other
 * than the framework's own allowlisted route conventions (`default`, `metadata`,
 * `generateStaticParams`, etc.) exporting `buildSearchViewModel` etc. directly from `page.tsx`
 * fails `tsc` there. This co-located module is what the spec's test guidance calls out as
 * the fallback ("in the same file or a co-located helper"). No Next.js runtime dependency, so it's
 * directly unit-testable see `./search-view-model.test.ts`.
 *
 * Pagination note (deliberate scope boundary): the page's own "next/previous page" links use a
 * plain, page-local `offset` query param NOT `@repo/security`'s opaque `cursor`
 * token. That signed cursor is bound to a specific `queryHash` and is meant to be minted by the
 * HTTP search route (`apps/web/src/app/search/api/route.ts`) for
 * external/programmatic callers, not hand-constructed here. A plain offset is the simplest correct
 * mechanism for this server-rendered page's own forward/back links.
 */
import { buildSearchRecommendations, runPublicSearch } from '@repo/domain';
import type {
  PublicSearchIndexDoc,
  SearchFilter,
  SearchRecommendation,
  SearchResultView,
} from '@repo/domain';
import { normalizeSearchText } from '@repo/security';

/** Matches `DEFAULT_QUERY_GUARDRAIL_LIMITS.defaultPageSize`. Kept as a local constant
 * since this page intentionally does not import the guardrails module. */
export const SEARCH_PAGE_SIZE = 20;

export type RawSearchParams = {
  readonly q?: string;
  readonly kind?: string;
  readonly status?: string;
  readonly era?: string;
  readonly offset?: string;
};

export type FacetOption = {
  readonly value: string;
  readonly label: string;
};

export type SearchViewModel = {
  readonly q: string;
  readonly kind: string;
  readonly status: string;
  readonly era: string;
  readonly offset: number;
  readonly results: readonly SearchResultView[];
  readonly totalMatched: number;
  readonly hasMore: boolean;
  readonly nextOffset?: number;
  readonly previousOffset?: number;
  readonly kindOptions: readonly FacetOption[];
  readonly statusOptions: readonly FacetOption[];
  readonly eraOptions: readonly FacetOption[];
  /**
   * Catalog-grounded suggestions for empty / zero-result states (and a short "from the
   * archive" strip when browsing with no query).
   */
  readonly recommendations: readonly SearchRecommendation[];
};

/** Trims a select-style param and defaults an empty value to `'all'`.  */
function cleanSelectParam(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? 'all' : trimmed;
}

/** Parses the page-local `offset` param: non-negative integer, defaulting to 0 on anything else.  */
export function parseOffset(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/** `in_force` -> `In Force`, `1860s` -> `1860s` (no separators, first-char uppercase is a no-op).  */
function humanizeFacetKey(key: string): string {
  return key
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Builds a `FilterBar` field's option list from real facet counts (no hardcoded
 * era/topic vocabulary). Always leads with an "All ___" option; when the facet carries zero keys
 * (e.g. no records have that dimension under the current filters), the list is just that one
 * option rather than an empty/broken select.
 */
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

function buildFilters(kind: string, status: string, era: string): readonly SearchFilter[] {
  const filters: SearchFilter[] = [];
  if (kind !== 'all') filters.push({ field: 'kind', value: kind });
  if (status !== 'all') filters.push({ field: 'status', value: status });
  if (era !== 'all') filters.push({ field: 'era', value: era });
  return filters;
}

/**
 * Pure query-building + result/facet-shaping core of the search page. Parses raw string params,
 * normalizes the text query (`@repo/security`'s `normalizeSearchText`), runs the real
 * `runPublicSearch` pipeline, and shapes its output (results + dynamic facet options + pagination
 * offsets) into everything the page's JSX needs.
 */
export function buildSearchViewModel(
  raw: RawSearchParams,
  index: readonly PublicSearchIndexDoc[],
): SearchViewModel {
  const q = raw.q ?? '';
  const kind = cleanSelectParam(raw.kind);
  const status = cleanSelectParam(raw.status);
  const era = cleanSelectParam(raw.era);
  const offset = parseOffset(raw.offset);

  const normalizedQuery = normalizeSearchText(q);
  const filters = buildFilters(kind, status, era);

  const executionResult = runPublicSearch(
    { normalizedQuery, filters, sort: 'relevance', offset, pageSize: SEARCH_PAGE_SIZE },
    index,
  );

  const nextOffset = executionResult.hasMore ? offset + SEARCH_PAGE_SIZE : undefined;
  const previousOffset = offset > 0 ? Math.max(0, offset - SEARCH_PAGE_SIZE) : undefined;

  // Zero-result only: suggest real catalog records (browse-ranked when the query itself
  // matched nothing). Populated browse already surfaces the index — no duplicate strip.
  const recommendations =
    executionResult.totalMatched === 0
      ? buildSearchRecommendations({
          query: '',
          index,
          limit: 8,
          allowBrowse: true,
        })
      : [];

  return {
    q,
    kind,
    status,
    era,
    offset,
    results: executionResult.results,
    totalMatched: executionResult.totalMatched,
    hasMore: executionResult.hasMore,
    ...(nextOffset !== undefined ? { nextOffset } : {}),
    ...(previousOffset !== undefined ? { previousOffset } : {}),
    kindOptions: buildFacetOptions(executionResult.facets.kind, 'All kinds'),
    statusOptions: buildFacetOptions(executionResult.facets.status, 'All statuses'),
    eraOptions: buildFacetOptions(executionResult.facets.era, 'All eras'),
    recommendations,
  };
}

/** Builds a plain `/search?...` href for a pagination link, preserving the current filters.  */
export function buildSearchPageHref(view: SearchViewModel, offset: number): string {
  const params = new URLSearchParams();
  if (view.q) params.set('q', view.q);
  if (view.kind !== 'all') params.set('kind', view.kind);
  if (view.status !== 'all') params.set('status', view.status);
  if (view.era !== 'all') params.set('era', view.era);
  if (offset > 0) params.set('offset', String(offset));
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}
