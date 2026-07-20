/**
 * Strict cache key builders for public pages.
 * Keys incorporate normalized query strings only never raw tracking params.
 */

import { normalizeQueryString, type QueryParamBag } from './query-normalization';

/** Build a deterministic cache key for a public HTML route.  */
export function buildPublicPageCacheKey(
  pathname: string,
  search?: URLSearchParams | QueryParamBag,
): string {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (!search) {
    return path || '/';
  }
  const qs = normalizeQueryString(path, search);
  return qs ? `${path}?${qs}` : path || '/';
}

/** Cache key for entity detail pages (path-param only; query strings ignored).  */
export function buildEntityCacheKey(entityId: string): string {
  const id = entityId.trim();
  if (!id) {
    throw new Error('Entity cache key requires a non-empty id');
  }
  return `/entity/${id}`;
}

/** Cache key for the public search index given normalized filters.  */
export function buildSearchCacheKey(filters: QueryParamBag): string {
  return buildPublicPageCacheKey('/search', filters);
}
