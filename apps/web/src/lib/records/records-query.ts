/**
 * The `/records` query model: parse raw params, build the one canonical href.
 *
 * Kept free of the catalog/map modules `build-records-index.ts` needs, because the edge proxy
 * runs this on every `/records` request to canonicalize it before anything renders. A crawler
 * or scraper sending `?kind=<random>` or `?zz=<random>` then gets a cheap 308 to a URL the CDN
 * has already cached, instead of forcing a fresh render per unique query (repo-4wb0e).
 */
import { isValidTopicId } from '@repo/domain/taxonomy/topics';

export type RecordsQuery = {
  readonly q: string;
  readonly kind: string;
  readonly era: string;
  readonly state: string;
  readonly topic: string;
  readonly status: string;
  readonly evidence: string;
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
  page: 1,
});

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
  return {
    q: one('q').replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH).trim(),
    kind: slugOrEmpty(one('kind').toLowerCase()),
    era: slugOrEmpty(one('era').toLowerCase()),
    state: STATE_POSTAL.test(state) ? state : '',
    topic: topic.length > 0 && isValidTopicId(topic) ? topic : '',
    status: slugOrEmpty(one('status').toLowerCase()),
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
  const constraints = RECORDS_FILTER_KEYS.filter((key) => query[key].length > 0).length;
  return constraints + (query.page > 1 ? 1 : 0) > 1;
}
