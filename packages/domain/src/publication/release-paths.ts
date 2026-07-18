/**
 * Storage path helpers for ADR-004 release catalog artifacts (CDN / public-media bucket).
 * Kept free of `node:crypto` so Node and TypeScript consumers can import without the
 * publication signing surface.
 */

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

function assertSafePathSegment(value: string, field: string): void {
  if (!SAFE_PATH_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`${field} is not a safe storage path segment`);
  }
}

/**
 * Aggregate release catalog for map/list/history/sitemap (ADR-004). One JSON object replaces
 * an unbounded Firestore `publicReleases/{id}/entities` collection scan on the public web.
 */
export function publicReleaseEntitiesListPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/entities.json`;
}

/**
 * Aggregate search-index artifact for the public search surface (ADR-004 / ADR-008).
 * Prefer this (or Firestore `publicSearchIndex` reads) over rebuilding the index from entity
 * projections at request time.
 */
export function publicReleaseSearchIndexPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/search-index.json`;
}
