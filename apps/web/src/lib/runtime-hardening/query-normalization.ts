/**
 * Query-string normalization for public routes.
 * Random tracking params must not alter cache keys or force regeneration.
 * Shareable map/history links are canonicalized so revisit/bookmark URLs stay stable.
 * Vercel Authentication `_vercel_share` (and other `_vercel_*` keys) are preserved on
 * redirects only — never in cache keys — to avoid Preview SSO redirect loops.
 *
 * Redirect decisions ignore query-param *order*. Sorting is for cache-key stability only.
 * Reorder-only 308s can emit a Location equal to the request on Vercel/Next middleware,
 * which loops (`ERR_TOO_MANY_REDIRECTS`) — notably the /search form order q/kind/status/era.
 */

import { buildExploreSearchParams, parseExploreSearchParams } from '../map-experience/url-state';
import {
  CORRECTIONS_PAGE_PARAM_ALLOWLIST,
  EXPLORE_PAGE_PARAM_ALLOWLIST,
  LAW_PAGE_PARAM_ALLOWLIST,
  SEARCH_PAGE_PARAM_ALLOWLIST,
  TRACKING_QUERY_KEYS,
  TRACKING_QUERY_PREFIXES,
  isPlatformPassthroughQueryKey,
} from './constants';

export type QueryParamBag = Record<string, string | string[] | undefined>;

/**
 * The map surface answers on two paths. Both run the same allowlist and the same parse→build
 * pair, so `/` and `/explore` cannot end up accepting different vocabularies for the same view.
 */
const EXPLORE_SURFACE_PATHS = new Set(['/', '/explore']);

function isTrackingKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_QUERY_KEYS.has(lower)) return true;
  return TRACKING_QUERY_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizePathname(pathname: string): string {
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

/** Routes that may carry user-facing filters; all other paths ignore query strings for caching.  */
export function getAllowedQueryParamsForPath(pathname: string): readonly string[] {
  const path = normalizePathname(pathname);
  if (path === '/search') {
    return SEARCH_PAGE_PARAM_ALLOWLIST;
  }
  if (EXPLORE_SURFACE_PATHS.has(path)) {
    return EXPLORE_PAGE_PARAM_ALLOWLIST;
  }
  // No `/history` branch: the route is not in the middleware matcher and must not be. See the
  // note where HISTORY_PAGE_PARAM_ALLOWLIST used to live in `constants.ts`.
  if (path === '/law') {
    return LAW_PAGE_PARAM_ALLOWLIST;
  }
  if (path === '/corrections') {
    return CORRECTIONS_PAGE_PARAM_ALLOWLIST;
  }
  return [];
}

function readParamBag(input: URLSearchParams | QueryParamBag): QueryParamBag {
  if (input instanceof URLSearchParams) {
    const bag: QueryParamBag = {};
    for (const key of new Set(input.keys())) {
      bag[key] = input.getAll(key).length > 1 ? input.getAll(key) : (input.get(key) ?? undefined);
    }
    return bag;
  }
  return input;
}

function allowlistedBag(pathname: string, bag: QueryParamBag): QueryParamBag {
  const allowed = new Set(getAllowedQueryParamsForPath(pathname));
  const out: QueryParamBag = {};
  for (const key of allowed) {
    if (isTrackingKey(key)) continue;
    const raw = firstString(bag[key]);
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out[key] = trimmed;
  }
  return out;
}

/**
 * Returns a stable query string containing only allowed, non-tracking params.
 * The map surface (`/` and `/explore`) and `/history` go through their parse→build helpers so
 * revisit URLs match what the client writes (`layerMode=presence`, uppercase state).
 * Empty string means no query component should appear in cache keys or redirects.
 */
export function normalizeQueryString(
  pathname: string,
  input: URLSearchParams | QueryParamBag,
): string {
  const path = normalizePathname(pathname);
  const bag = allowlistedBag(path, readParamBag(input));

  if (EXPLORE_SURFACE_PATHS.has(path)) {
    return buildExploreSearchParams(parseExploreSearchParams(bag));
  }

  const normalized = new URLSearchParams();
  for (const key of Object.keys(bag).sort()) {
    const value = firstString(bag[key]);
    if (value === undefined) continue;
    normalized.set(key, value);
  }
  return normalized.toString();
}

/**
 * Collect Vercel (and similar) platform handshake params to re-attach after
 * allowlist normalization. Order is stable (sorted keys) so redirect checks stay idempotent.
 */
function platformPassthroughQueryString(searchParams: URLSearchParams): string {
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

/** Merge allowlisted app query with preserved platform handshake params.  */
function redirectQueryString(pathname: string, searchParams: URLSearchParams): string {
  const appQs = normalizeQueryString(pathname, searchParams);
  const platformQs = platformPassthroughQueryString(searchParams);
  if (!appQs) return platformQs;
  if (!platformQs) return appQs;
  return `${appQs}&${platformQs}`;
}

/** Stable pathname + query string for redirect/cache comparisons.  */
export function canonicalPathAndSearch(url: URL): string {
  const path = normalizePathname(url.pathname);
  const qs = normalizeQueryString(path, url.searchParams);
  return qs ? `${path}?${qs}` : path;
}

/**
 * Canonical URL for edge redirects: allowlisted app params + platform passthrough
 * (`_vercel_share`, …). Cache keys still use `normalizeQueryString` alone so share
 * tokens never enter CDN keys.
 */
export function buildNormalizedUrl(url: URL): URL {
  const normalized = new URL(url.toString());
  const path = normalizePathname(normalized.pathname);
  normalized.pathname = path;
  const qs = redirectQueryString(path, normalized.searchParams);
  normalized.search = qs ? `?${qs}` : '';
  return normalized;
}

/**
 * Order-insensitive query fingerprint for redirect comparisons.
 * Same keys/values in any order compare equal; used so we never 308 solely to re-sort.
 */
function stableSearchFingerprint(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return [...params.entries()]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .sort((a, b) => a.localeCompare(b))
    .join('&');
}

/**
 * True when the incoming URL needs a normalization redirect (strip tracking, drop
 * unknown keys, canonicalize values/path). Param reorder alone is not a reason to redirect.
 */
export function needsQueryNormalizationRedirect(url: URL): boolean {
  const normalized = buildNormalizedUrl(url);
  // Compare the request pathname as-is so trailing-slash cleanup still 308s.
  if (url.pathname !== normalized.pathname) {
    return true;
  }
  return stableSearchFingerprint(url.search) !== stableSearchFingerprint(normalized.search);
}

/** Normalize App Router searchParams records for server components.  */
export function normalizeSearchParamsRecord(
  pathname: string,
  params: QueryParamBag,
): Record<string, string> {
  const qs = normalizeQueryString(pathname, params);
  const out: Record<string, string> = {};
  if (!qs) return out;
  const parsed = new URLSearchParams(qs);
  for (const [key, value] of parsed.entries()) {
    out[key] = value;
  }
  return out;
}
