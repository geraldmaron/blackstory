/**
 * Query-string normalization for public routes.
 * Random tracking params must not alter cache keys or force regeneration.
 * Shareable map/history links are canonicalized so revisit/bookmark URLs stay stable.
 */

import { buildExploreSearchParams, parseExploreSearchParams } from '../map-experience/url-state';
import { buildHistorySearchParams, parseHistorySearchParams } from '../history/url-state';
import {
  EXPLORE_PAGE_PARAM_ALLOWLIST,
  HISTORY_PAGE_PARAM_ALLOWLIST,
  SEARCH_PAGE_PARAM_ALLOWLIST,
  TRACKING_QUERY_KEYS,
  TRACKING_QUERY_PREFIXES,
} from './constants';

export type QueryParamBag = Record<string, string | string[] | undefined>;

function isTrackingKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_QUERY_KEYS.has(lower)) return true;
  return TRACKING_QUERY_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Routes that may carry user-facing filters; all other paths ignore query strings for caching.  */
export function getAllowedQueryParamsForPath(pathname: string): readonly string[] {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (path === '/search') {
    return SEARCH_PAGE_PARAM_ALLOWLIST;
  }
  if (path === '/explore') {
    return EXPLORE_PAGE_PARAM_ALLOWLIST;
  }
  if (path === '/history') {
    return HISTORY_PAGE_PARAM_ALLOWLIST;
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
 * `/explore` and `/history` go through their parse→build helpers so revisit URLs match
 * what the client writes (`layerMode=presence`, uppercase state, rounded viewport).
 * Empty string means no query component should appear in cache keys or redirects.
 */
export function normalizeQueryString(
  pathname: string,
  input: URLSearchParams | QueryParamBag,
): string {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const bag = allowlistedBag(path, readParamBag(input));

  if (path === '/explore') {
    return buildExploreSearchParams(parseExploreSearchParams(bag));
  }
  if (path === '/history') {
    return buildHistorySearchParams(parseHistorySearchParams(bag));
  }

  const normalized = new URLSearchParams();
  for (const key of Object.keys(bag).sort()) {
    const value = firstString(bag[key]);
    if (value === undefined) continue;
    normalized.set(key, value);
  }
  return normalized.toString();
}

/** Canonical URL pathname + optional query for redirects and cache keys.  */
export function buildNormalizedUrl(url: URL): URL {
  const normalized = new URL(url.toString());
  const qs = normalizeQueryString(normalized.pathname, normalized.searchParams);
  normalized.search = qs ? `?${qs}` : '';
  return normalized;
}

/** True when the incoming URL carries params that should be stripped via redirect.  */
export function needsQueryNormalizationRedirect(url: URL): boolean {
  const cleaned = buildNormalizedUrl(url);
  return cleaned.pathname + cleaned.search !== url.pathname + url.search;
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
