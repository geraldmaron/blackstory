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

/**
 * Aggregate map GeoJSON FeatureCollection artifact (ADR-013 map stack). This is the
 * release-coupled map source `buildMapSource` produces — every coordinate already passed
 * through `redactLocationForPublic`. See `workers/publication/MAP_SOURCE_INTEGRATION.md`.
 */
export function publicReleaseMapSourcePath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/map/source.json`;
}

/** State-level presence aggregate for the map surface (ADR-013). */
export function publicReleaseMapStateAggregatesPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/map/state-aggregates.json`;
}

/** County-level presence aggregate for the map surface (ADR-013). */
export function publicReleaseMapCountyAggregatesPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/map/county-aggregates.json`;
}

/**
 * Bounded flat-point artifact the mobile client downloads once per release for offline map
 * dots (ADR-013 / ADR-022). Distinct from `map/source.json` so a size/gzip budget can be
 * enforced on the client-shipped payload independently of the fuller web map source.
 */
export function publicReleaseBoundedPointsPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/map/bounded-points.json`;
}

/** Static-content index artifact (stories / methodology / learn) for the active release. */
export function publicReleaseContentIndexPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/content/index.json`;
}

/**
 * Mobile cold-start bootstrap manifest artifact (MOB-005). One JSON object the `/v1/bootstrap`
 * handler in `apps/api-public` projects the active-release pointer from. Content-addressed like
 * every other release artifact so rollback restores the exact bootstrap the client last saw.
 */
export function publicReleaseBootstrapPath(releaseId: string): string {
  assertSafePathSegment(releaseId, 'releaseId');
  return `public/releases/${releaseId}/bootstrap.json`;
}
