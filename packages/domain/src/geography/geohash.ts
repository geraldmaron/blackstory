/**
 * Geohash encode/prefix helpers for Firestore nearby queries without PostGIS (ADR-011).
 * Writers store lat/lng + geohash (+ optional prefixes); api-public filters by radius server-side.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const DEFAULT_GEOHASH_PRECISION = 9;
export const MAX_GEOHASH_PRECISION = 12;

export type GeoPoint = {
  readonly lat: number;
  readonly lng: number;
};

export type GeoPointFields = GeoPoint & {
  readonly geohash: string;
  readonly geohashPrefixes: readonly string[];
};

function assertLatLng(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`lat out of range: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`lng out of range: ${lng}`);
  }
}

/**
 * Encode a WGS84 point to a geohash string at the given character precision (1–12).
 */
export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number = DEFAULT_GEOHASH_PRECISION,
): string {
  assertLatLng(lat, lng);
  if (!Number.isInteger(precision) || precision < 1 || precision > MAX_GEOHASH_PRECISION) {
    throw new Error(`geohash precision must be 1–${MAX_GEOHASH_PRECISION}`);
  }

  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch = (ch << 1) + 1;
        minLng = mid;
      } else {
        ch = (ch << 1) + 0;
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        minLat = mid;
      } else {
        ch = (ch << 1) + 0;
        maxLat = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32.charAt(ch);
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/** Prefixes from length `minLength` through full geohash (inclusive), for range queries. */
export function geohashPrefixes(geohash: string, minLength = 1): string[] {
  if (!geohash || geohash.length > MAX_GEOHASH_PRECISION) {
    throw new Error('geohash must be 1–12 characters');
  }
  if (!Number.isInteger(minLength) || minLength < 1 || minLength > geohash.length) {
    throw new Error('minLength must be between 1 and geohash length');
  }
  const prefixes: string[] = [];
  for (let i = minLength; i <= geohash.length; i += 1) {
    prefixes.push(geohash.slice(0, i));
  }
  return prefixes;
}

/** Build Firestore-friendly geo fields from a coordinate. */
export function buildGeoPointFields(
  lat: number,
  lng: number,
  precision: number = DEFAULT_GEOHASH_PRECISION,
): GeoPointFields {
  const geohash = encodeGeohash(lat, lng, precision);
  return {
    lat,
    lng,
    geohash,
    geohashPrefixes: geohashPrefixes(geohash),
  };
}

/** Approximate great-circle distance in meters (Haversine) for server-side radius filter. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  assertLatLng(a.lat, a.lng);
  assertLatLng(b.lat, b.lng);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}
