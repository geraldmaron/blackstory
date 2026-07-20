/**
 * Local USPS ZIP centroid lookup for translate-then-discard flows. Census Geocoder's
 * `onelineaddress` endpoint does not match bare ZIP codes; this module resolves a 5-digit ZIP to
 * an approximate lat/lng using the open-source `zipcodes` dataset, then callers reverse-geocode
 * those coordinates through Census for jurisdiction ids. ZIP text is never stored — ADR-016.
 */
import zipcodes from 'zipcodes';

export type UsZipCentroid = {
  readonly zip5: string;
  readonly lat: number;
  readonly lng: number;
  readonly city?: string;
  readonly stateAbbrev?: string;
};

export type LookupUsZipCentroid = (zip5: string) => UsZipCentroid | undefined;

/** Returns an approximate centroid for a normalized 5-digit U.S. ZIP, or `undefined` when unknown. */
export function lookupUsZipCentroid(zip5: string): UsZipCentroid | undefined {
  const hit = zipcodes.lookup(zip5.trim());
  if (!hit) return undefined;
  if (!Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return undefined;
  return {
    zip5: hit.zip,
    lat: hit.latitude,
    lng: hit.longitude,
    ...(hit.city ? { city: hit.city } : {}),
    ...(hit.state ? { stateAbbrev: hit.state } : {}),
  };
}
