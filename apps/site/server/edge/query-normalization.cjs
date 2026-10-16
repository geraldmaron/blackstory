/**
 * Query-string canonicalization at the edge. Port of apps/web/src/lib/runtime-hardening/
 * {query-normalization,edge-query-normalization,constants}.ts. It exists so a cache-busting `?x=` or a
 * tracking tag cannot fragment the CDN's HTML cache: any URL whose query is not already canonical gets
 * a 308 to the canonical one.
 *
 * `/explore` is deliberately NOT normalized yet. Its canonical form comes from the Explore URL-state
 * parser (apps/web/src/lib/map-experience/url-state.ts, 561 lines plus geography and population
 * vocabularies), which belongs with the map port (repo-5tjl0). Until then `/explore` passes through
 * unchanged; a partial port would redirect differently from the original and could loop against the
 * real route later. `query-normalization.test.cjs` asserts the gap so it cannot become silent.
 */
const {
  RECORDS_PAGE_PARAM_ALLOWLIST,
  parseRecordsQuery,
  recordsQueryString,
} = require('./records-query.cjs');

const SEARCH_PAGE_PARAM_ALLOWLIST = [
  'q',
  'kind',
  'state',
  'precision',
  'releaseId',
  'status',
  'era',
  'sort',
  'pageSize',
  'cursor',
  'dateFrom',
  'dateTo',
  'topic',
  'offset',
];
const LAW_PAGE_PARAM_ALLOWLIST = ['q', 'kind', 'topic', 'sort'];
const STORIES_PAGE_PARAM_ALLOWLIST = [
  'q',
  'kind',
  'collection',
  'tag',
  'era',
  'place',
  'sort',
  'page',
];
const CORRECTIONS_PAGE_PARAM_ALLOWLIST = ['target', 'targetType'];
const PLACE_PAGE_PARAM_ALLOWLIST = [
  'from',
  'q',
  'kind',
  'era',
  'state',
  'topic',
  'theme',
  'status',
  'evidence',
  'floor',
  'selected',
];

const TRACKING_QUERY_PREFIXES = ['utm_', 'mc_', 'pk_', 'vero_'];
const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'ref',
  '_ga',
  '_gl',
  'igshid',
]);

const EXPLORE_PATH = '/explore';
const RECORDS_PATH = '/records';

function isPlatformPassthroughQueryKey(key) {
  return key.toLowerCase().startsWith('_vercel_');
}

function isTrackingKey(key) {
  const lower = key.toLowerCase();
  if (TRACKING_QUERY_KEYS.has(lower)) return true;
  return TRACKING_QUERY_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function firstString(value) {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizePathname(pathname) {
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/** The allowlist for a path. Empty for pages that take no query, which is most of them. */
function getAllowedQueryParamsForPath(pathname) {
  const path = normalizePathname(pathname);
  if (path === '/search') return SEARCH_PAGE_PARAM_ALLOWLIST;
  if (path === RECORDS_PATH) return RECORDS_PAGE_PARAM_ALLOWLIST;
  if (path === '/law') return LAW_PAGE_PARAM_ALLOWLIST;
  if (path === '/stories') return STORIES_PAGE_PARAM_ALLOWLIST;
  if (path === '/corrections') return CORRECTIONS_PAGE_PARAM_ALLOWLIST;
  if (path.startsWith('/place/') || path.startsWith('/invention/'))
    return PLACE_PAGE_PARAM_ALLOWLIST;
  return [];
}

function readParamBag(input) {
  if (input instanceof URLSearchParams) {
    const bag = {};
    for (const key of new Set(input.keys())) {
      bag[key] = input.getAll(key).length > 1 ? input.getAll(key) : (input.get(key) ?? undefined);
    }
    return bag;
  }
  return input;
}

function allowlistedBag(pathname, bag) {
  const out = {};
  for (const key of new Set(getAllowedQueryParamsForPath(pathname))) {
    if (isTrackingKey(key)) continue;
    const raw = firstString(bag[key]);
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out[key] = trimmed;
  }
  return out;
}

/** The canonical query string (no `?`) for a path. Throws for `/explore`, which is not ported. */
function normalizeQueryString(pathname, input) {
  const path = normalizePathname(pathname);
  if (path === EXPLORE_PATH)
    throw new Error('/explore query normalization is not ported (repo-5tjl0)');
  const bag = allowlistedBag(path, readParamBag(input));
  if (path === RECORDS_PATH) return recordsQueryString(parseRecordsQuery(bag));
  const normalized = new URLSearchParams();
  for (const key of Object.keys(bag).sort()) {
    const value = firstString(bag[key]);
    if (value === undefined) continue;
    normalized.set(key, value);
  }
  return normalized.toString();
}

/** `_vercel_*` keys belong to the platform (preview protection, draft mode) and survive every redirect. */
function platformPassthroughQueryString(searchParams) {
  const keys = [...new Set(searchParams.keys())]
    .filter(isPlatformPassthroughQueryKey)
    .sort((a, b) => a.localeCompare(b));
  const out = new URLSearchParams();
  for (const key of keys) {
    for (const value of searchParams.getAll(key)) {
      const trimmed = value.trim();
      if (trimmed) out.append(key, trimmed);
    }
  }
  return out.toString();
}

function redirectQueryString(pathname, searchParams) {
  const appQs = normalizeQueryString(pathname, searchParams);
  const platformQs = platformPassthroughQueryString(searchParams);
  if (!appQs) return platformQs;
  if (!platformQs) return appQs;
  return `${appQs}&${platformQs}`;
}

/** Re-encode a decoded path for a Location header without double-encoding or leaking `?` and `#`. */
function encodePath(pathname) {
  return pathname
    .split('/')
    .map((segment) => encodeURI(segment).replace(/[?#]/g, encodeURIComponent))
    .join('/');
}

/** `/path?canonical` for metadata canonicals. */
function canonicalPathAndSearch(pathname, searchParams) {
  const path = normalizePathname(pathname);
  const qs = normalizeQueryString(path, searchParams);
  return qs ? `${path}?${qs}` : path;
}

/** @returns {{pathname:string, search:string}} the canonical path and `?query` (empty string when none). */
function buildNormalizedUrl(pathname, searchParams) {
  const path = normalizePathname(pathname);
  const qs = redirectQueryString(path, searchParams);
  return { pathname: path, search: qs ? `?${qs}` : '' };
}

/** Order- and encoding-insensitive comparison so `?b=2&a=1` and `?a=1&b=2` are the same query. */
function stableSearchFingerprint(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return [...params.entries()]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .sort((a, b) => a.localeCompare(b))
    .join('&');
}

/**
 * @param {{pathname:string, search:string, searchParams:URLSearchParams}} url
 *   `pathname` as the client sent it (a trailing slash counts: it is redirected away).
 */
function needsQueryNormalizationRedirect({ pathname, search, searchParams }) {
  const normalized = buildNormalizedUrl(pathname, searchParams);
  if (pathname !== normalized.pathname) return true;
  return stableSearchFingerprint(search) !== stableSearchFingerprint(normalized.search);
}

/**
 * The 308 to the canonical URL, or null when the request is already canonical (or is `/explore`).
 * @param {{pathname:string, trailingSlash:boolean, search:string, searchParams:URLSearchParams}} facts
 */
function handleQueryNormalization(facts) {
  const sent =
    facts.trailingSlash && facts.pathname.length > 1 ? `${facts.pathname}/` : facts.pathname;
  if (normalizePathname(sent) === EXPLORE_PATH) return null;
  if (
    !needsQueryNormalizationRedirect({
      pathname: sent,
      search: facts.search,
      searchParams: facts.searchParams,
    })
  )
    return null;
  const target = buildNormalizedUrl(sent, facts.searchParams);
  return {
    status: 308,
    headers: {
      location: `/${encodePath(target.pathname).replace(/^\/+/, '')}${target.search}`,
      'cache-control': 'no-store',
    },
  };
}

module.exports = {
  SEARCH_PAGE_PARAM_ALLOWLIST,
  LAW_PAGE_PARAM_ALLOWLIST,
  STORIES_PAGE_PARAM_ALLOWLIST,
  CORRECTIONS_PAGE_PARAM_ALLOWLIST,
  PLACE_PAGE_PARAM_ALLOWLIST,
  TRACKING_QUERY_PREFIXES,
  TRACKING_QUERY_KEYS,
  isPlatformPassthroughQueryKey,
  getAllowedQueryParamsForPath,
  normalizeQueryString,
  canonicalPathAndSearch,
  buildNormalizedUrl,
  needsQueryNormalizationRedirect,
  handleQueryNormalization,
};
