/**
 * Geography domain types for places, geometries, jurisdictions, and ZIP policy.
 * Historical and current locations coexist; ZIP is modern input only never a historical boundary.
 */
import type { LocationId } from '../ids.js';
import type { GeoPointFields } from './geohash.js';
import type { PublicPrecisionLevel } from './precision.js';
import type { GeoPrecisionTier, PrecisionBasis } from './precision.js';

/** Firestore-friendly geometry shapes (no PostGIS WKT required). */
export type GeoGeometry =
  | { readonly type: 'Point'; readonly coordinates: readonly [lng: number, lat: number] }
  | {
      readonly type: 'Polygon';
      /** Exterior ring of [lng, lat] pairs; first === last. */
      readonly coordinates: readonly (readonly [number, number])[];
    }
  | {
      readonly type: 'BBox';
      /** west, south, east, north */
      readonly bbox: readonly [number, number, number, number];
    };

export type LocationRole = 'historical' | 'current' | 'approximate';

/**
 * How a coordinate or place match was produced. Recorded with precision for auditability.
 */
export const GEOGRAPHIC_MATCH_METHODS = [
  'manual_research',
  'geocode_census',
  'geocode_other',
  'geohash_nearby',
  'user_submitted',
  'imported',
  'unknown',
] as const;

export type GeographicMatchMethod = (typeof GEOGRAPHIC_MATCH_METHODS)[number];

export type GeographicMatch = {
  readonly method: GeographicMatchMethod;
  /** Constitution public precision level (or internal research note when not public). */
  readonly precision: PublicPrecisionLevel;
  readonly confidence?: number;
  readonly recordedAt: string;
  readonly notes?: string;
};

/**
 * ZIP postal code is modern geography for input and lookup only.
 * It must never be treated as a permanent historical boundary.
 */
export type ZipCodeRole = 'modern_input' | 'modern_lookup';

export type ZipCodeInput = {
  readonly zip: string;
  readonly role: ZipCodeRole;
  readonly countryCode?: string;
};

export function assertZipNotHistoricalBoundary(role: string): void {
  if (role !== 'modern_input' && role !== 'modern_lookup') {
    throw new Error(
      `ZIP role "${role}" is invalid; ZIP is modern input/lookup only, not a historical boundary`,
    );
  }
}

export type JurisdictionKind =
  'country' | 'state' | 'county' | 'city' | 'district' | 'school_district' | 'other';

export type Jurisdiction = {
  readonly id: string;
  readonly kind: JurisdictionKind;
  readonly name: string;
  readonly parentId?: string;
  /** Inclusive start of historical validity (ISO date or year). */
  readonly validFrom?: string;
  readonly validTo?: string | null;
};

/**
 * A located occurrence for an entity. Historical and current rows may coexist on one entity.
 */
export type EntityLocation = {
  readonly id: LocationId | string;
  readonly entityId: string;
  readonly role: LocationRole;
  readonly geometry: GeoGeometry;
  /** Geohash fields when geometry is (or reduces to) a point suitable for nearby queries. */
  readonly point?: GeoPointFields;
  readonly precision: PublicPrecisionLevel;
  /**
   * geoPrecision anchor tier (exact-site|block|locality|county|state) and the basis it
   * was resolved at a DIFFERENT vocabulary from `precision` above (constitution public-output
   * scale); see `geography/precision.ts`'s module doc for why the two must not be conflated.
   * Both optional/additive: existing rows without them are unaffected.
   */
  readonly geoPrecisionTier?: GeoPrecisionTier;
  readonly precisionBasis?: PrecisionBasis;
  readonly match?: GeographicMatch;
  readonly validFrom?: string;
  readonly validTo?: string | null;
  readonly jurisdictionIds?: readonly string[];
  /** Modern ZIP input only never a substitute for historical boundaries. */
  readonly modernZip?: ZipCodeInput;
  readonly label?: string;
  readonly evidenceIds?: readonly string[];
};

export type PlaceFields = {
  readonly historicalNames?: readonly string[];
  readonly jurisdictionIds?: readonly string[];
  /** Optional primary current point for maps; historical locations live on EntityLocation rows. */
  readonly primaryLocationId?: string;
};

/**
 * Historical, current, and approximate locations may all be stored on one entity.
 * The model does not force a single "current" row to replace historical rows.
 */
export function locationsMayCoexist(a: LocationRole, b: LocationRole): boolean {
  void a;
  void b;
  return true;
}

/** Whether a location set includes both historical and current roles. */
export function hasHistoricalAndCurrent(
  locations: readonly Pick<EntityLocation, 'role'>[],
): boolean {
  const hasHistorical = locations.some((loc) => loc.role === 'historical');
  const hasCurrent = locations.some((loc) => loc.role === 'current');
  return hasHistorical && hasCurrent;
}
