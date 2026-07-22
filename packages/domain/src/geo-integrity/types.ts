/**
 * Shared types for publish-time geo-integrity: state boundary polygons, containment checks,
 * and audit rows. Coordinates follow GeoJSON order ([longitude, latitude]) in polygon rings.
 */

/** Decimal-degree point in WGS84 (EPSG:4326). */
export type GeoPoint = {
  readonly lat: number;
  readonly lng: number;
};

/** GeoJSON-style polygon ring: closed loop of [lng, lat] vertices. */
export type GeoRing = readonly (readonly [lng: number, lat: number])[];

/**
 * Simplified state boundary used by the in-process containment gate before PostGIS polygons
 * are wired in Supabase. `rings[0]` is the exterior ring; holes are ignored for v1 fixtures.
 */
export type StateBoundary = {
  readonly stateCode: string;
  readonly stateFips?: string;
  readonly name?: string;
  readonly rings: readonly GeoRing[];
};

/** Lookup table keyed by uppercase USPS postal code (e.g. `MA`, `NY`). */
export type StateBoundaryIndex = ReadonlyMap<string, StateBoundary>;

/** Minimal entity location row for batch audit (no auto-fix). */
export type EntityLocationAuditRow = {
  readonly id: string;
  readonly stateCode: string;
  readonly lat: number;
  readonly lng: number;
};

export type GeoIntegrityMismatchReason =
  | 'point_not_in_declared_state'
  | 'unknown_state_code'
  | 'missing_boundary';

export type GeoIntegrityMismatch = {
  readonly id: string;
  readonly declaredStateCode: string;
  readonly lat: number;
  readonly lng: number;
  readonly reason: GeoIntegrityMismatchReason;
  /** Uppercase postal code inferred from boundaries when containment fails; omitted when unknown. */
  readonly inferredStateCode?: string;
};

export type GeoIntegrityAuditResult =
  | { readonly ok: true; readonly checked: number }
  | {
      readonly ok: false;
      readonly checked: number;
      readonly mismatches: readonly GeoIntegrityMismatch[];
    };

export type GeoIntegrityPublishGateFailure = {
  readonly id: string;
  readonly reason: GeoIntegrityMismatchReason;
  readonly message: string;
};

export type GeoIntegrityPublishGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: readonly GeoIntegrityPublishGateFailure[] };
