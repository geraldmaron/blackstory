/**
 * The `/records` query model: parse raw params, build the one canonical href.
 *
 * Kept free of the catalog/map modules `build-records-index.ts` needs, because the edge proxy
 * runs this on every `/records` request to canonicalize it before anything renders. A crawler
 * or scraper sending `?kind=<random>` or `?zz=<random>` then gets a cheap 308 to a URL the CDN
 * has already cached, instead of forcing a fresh render per unique query (repo-4wb0e).
 */
import { isValidTopicId } from '@repo/domain/taxonomy/topics';
import { normalizePeriod, periodIsActive, type PeriodBound } from '../discovery/collection-period';
import { parseCollectionToken, type CollectionToken } from '../discovery/story-collection';

/** `index` is the default list and has no URL spelling; `chronology` regroups the same rows. */
export type RecordsLayout = 'index' | 'chronology';

export type RecordsQuery = {
  readonly q: string;
  readonly kind: string;
  readonly era: string;
  readonly state: string;
  readonly topic: string;
  readonly status: string;
  readonly evidence: string;
  /** `story:<slug>` or a finite sentinel (`missing`, `invalid`); `''` is the whole archive. */
  readonly collection: CollectionToken;
  /** Inclusive stored decade-start bounds, not event dates (see `collection-period.ts`). */
  readonly periodStart: PeriodBound;
  readonly periodEnd: PeriodBound;
  /** Only meaningful with a bound; redundant (and dropped) without one. */
  readonly includeUndated: boolean;
  readonly sort: RecordsSort;
  readonly layout: RecordsLayout;
  readonly page: number;
};

export const EMPTY_RECORDS_QUERY: RecordsQuery = Object.freeze({
  q: '',
  kind: '',
  era: '',
  state: '',
  topic: '',
  status: '',
  evidence: '',
  collection: '',
  periodStart: '',
  periodEnd: '',
  includeUndated: false,
  sort: 'discovery',
  layout: 'index',
  page: 1,
});

/**
 * Orderings `/records` understands. `discovery` is the long-standing default — best evidence
 * first, then earliest era — and stays the one the bare URL means. The index had no sort
 * control at all, so 4,210 records could only ever be read in that one order.
 */
export const RECORDS_SORTS = Object.freeze(['discovery', 'era', 'name', 'evidence'] as const);
export type RecordsSort = (typeof RECORDS_SORTS)[number];

/** The filter keys, in the order the chip bar renders them. `q` and `page` are not chips. */
export const RECORDS_FILTER_KEYS = Object.freeze([
  'kind',
  'era',
  'state',
  'topic',
  'status',
  'evidence',
] as const);

export type RecordsFilterKey = (typeof RECORDS_FILTER_KEYS)[number];

/** Every key `/records` reads. The edge drops anything else. */
export const RECORDS_PAGE_PARAM_ALLOWLIST: readonly string[] = Object.freeze([
  'q',
  ...RECORDS_FILTER_KEYS,
  'collection',
  'periodStart',
  'periodEnd',
  'includeUndated',
  'sort',
  'layout',
  'page',
]);

/** Facet values are slugs (`school`, `1950s`, `historic`). Anything else narrows nothing. */
const FACET_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const STATE_POSTAL = /^[A-Z]{2}$/;
const EVIDENCE_GRADES = new Set(['A', 'B', 'C']);
const MAX_QUERY_LENGTH = 120;
/** Far above any real page count (the catalog is a few thousand rows); bounds `?page=<huge>`. */
const MAX_PAGE = 1000;

function slugOrEmpty(value: string): string {
  return FACET_SLUG.test(value) ? value : '';
}

/**
 * Normalizes raw search params. Anything unrecognized collapses to the empty string rather than
 * throwing, because this route is reachable from bookmarks and from three redirect families, and
 * a stale param must narrow nothing rather than 500.
 */
export function parseRecordsQuery(
  raw: Record<string, string | readonly string[] | undefined>,
): RecordsQuery {
  const one = (key: string): string => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' ? first.trim() : '';
  };
  const rawPage = Number.parseInt(one('page'), 10);
  const state = one('state').toUpperCase();
  const topic = one('topic').toLowerCase();
  // The floor vocabulary is upper-case letters ('A' | 'B' | 'C'), unlike every other filter.
  const evidence = one('evidence').toUpperCase();
  const period = normalizePeriod({
    start: raw.periodStart,
    end: raw.periodEnd,
    includeUndated: raw.includeUndated,
  });
  return {
    collection: parseCollectionToken(raw.collection),
    periodStart: period.start,
    periodEnd: period.end,
    includeUndated: period.includeUndated,
    layout: one('layout').toLowerCase() === 'chronology' ? 'chronology' : 'index',
    q: one('q').replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH).trim(),
    kind: slugOrEmpty(one('kind').toLowerCase()),
    era: slugOrEmpty(one('era').toLowerCase()),
    state: STATE_POSTAL.test(state) ? state : '',
    topic: topic.length > 0 && isValidTopicId(topic) ? topic : '',
    status: slugOrEmpty(one('status').toLowerCase()),
    sort: (RECORDS_SORTS as readonly string[]).includes(one('sort').toLowerCase())
      ? (one('sort').toLowerCase() as RecordsSort)
      : 'discovery',
    evidence: EVIDENCE_GRADES.has(evidence) ? evidence : '',
    page: Number.isFinite(rawPage) && rawPage > 1 ? Math.min(rawPage, MAX_PAGE) : 1,
  };
}

/** Canonical query string for a narrowing (no leading `?`), in the fixed emit order. */
export function recordsQueryString(query: Partial<RecordsQuery>): string {
  const merged = { ...EMPTY_RECORDS_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.q.length > 0) params.set('q', merged.q);
  for (const key of RECORDS_FILTER_KEYS) {
    if (merged[key].length > 0) params.set(key, merged[key]);
  }
  if (merged.collection.length > 0) params.set('collection', merged.collection);
  // Re-normalized rather than echoed, so reversed bounds and a redundant `includeUndated` never
  // become a second URL for the same set.
  const period = normalizePeriod({
    start: merged.periodStart,
    end: merged.periodEnd,
    includeUndated: merged.includeUndated,
  });
  if (period.start.length > 0) params.set('periodStart', period.start);
  if (period.end.length > 0) params.set('periodEnd', period.end);
  if (period.includeUndated) params.set('includeUndated', '1');
  // The default sort is never emitted, for the same reason `page=1` is not: it would give one
  // ordering two URLs, and both would claim to be canonical.
  if (merged.sort !== 'discovery') params.set('sort', merged.sort);
  if (merged.layout === 'chronology') params.set('layout', 'chronology');
  // `page=1` is never emitted: `/records` and `/records?page=1` would otherwise be two URLs for
  // one page, and each would claim to be canonical.
  if (merged.page > 1) params.set('page', String(merged.page));
  return params.toString();
}

/**
 * Builds a `/records` href. Params are emitted in a fixed order so a given narrowing has exactly
 * one URL, which is what makes the self-referential canonical honest.
 */
export function recordsHref(query: Partial<RecordsQuery>): string {
  const search = recordsQueryString(query);
  return search.length > 0 ? `/records?${search}` : '/records';
}

/**
 * True when a narrowing is one crawlers should not enumerate: free-text search results, or two
 * or more constraints at once. Single-facet pages and plain pagination stay indexable (a
 * filtered page is a distinct, useful set); combinations are where the URL space explodes.
 * `app/robots.ts` disallows the same shapes.
 */
export function isRecordsCombinationQuery(query: RecordsQuery): boolean {
  if (query.q.length > 0) return true;
  // A story collection, a decade range and the chronology layout are reader-built views, and a
  // malformed one is an error page. None is a set a crawler should enumerate.
  if (
    query.collection.length > 0 ||
    query.layout === 'chronology' ||
    periodIsActive({
      start: query.periodStart,
      end: query.periodEnd,
      includeUndated: query.includeUndated,
    })
  ) {
    return true;
  }
  const constraints = RECORDS_FILTER_KEYS.filter((key) => query[key].length > 0).length;
  // A re-ordering counts as a dimension. Every sort multiplies the crawlable combinations of
  // the same rows, which is the crawl trap robots.txt already exists to stop; the default
  // ordering is the one a crawler sees.
  const reordered = query.sort !== 'discovery' ? 1 : 0;
  return constraints + reordered + (query.page > 1 ? 1 : 0) > 1;
}
