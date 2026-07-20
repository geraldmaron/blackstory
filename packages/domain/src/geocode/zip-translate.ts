/**
 * ZIP-to-place translate-then-discard (; ADR-016 "ZIPs: never
 * stored as reference data"). A user-entered ZIP is used ONLY to ask what place/state/county it
 * falls within — the raw ZIP is never returned by this function. Census Geocoder's forward
 * `onelineaddress` endpoint does not match bare ZIP codes, so this module resolves the ZIP to an
 * approximate centroid (open-source `zipcodes` dataset) and reverse-geocodes those coordinates
 * through Census for jurisdiction ids.
 */
import { assertZipNotHistoricalBoundary } from '../geography/location.js';
import { evaluateGeocodeProductScope } from './product-scope.js';
import { buildManualPlaceSearchFallback } from './manual-fallback.js';
import { resolveJurisdictionIdsFromMatch } from './jurisdiction-ids.js';
import { lookupUsZipCentroid, type LookupUsZipCentroid } from './zip-centroid.js';
import { normalizeUsZipInput } from './zip-normalize.js';
import type {
  CensusCoordinatesGeocodeFetcher,
  ManualPlaceSearchFallback,
  ResolvedJurisdictionIds,
} from './types.js';

export type ZipTranslation = {
  readonly ok: true;
  readonly placeName?: string;
  readonly stateName?: string;
  readonly countyName?: string;
  readonly jurisdictionIds: ResolvedJurisdictionIds;
};

export type ZipTranslationFailure = {
  readonly ok: false;
  readonly fallback: ManualPlaceSearchFallback;
};

export type ZipTranslationResult = ZipTranslation | ZipTranslationFailure;

export type TranslateZipToPlaceInput = {
  readonly zip: string;
  readonly fetchCoordinatesGeocode: CensusCoordinatesGeocodeFetcher;
  readonly lookupZipCentroid?: LookupUsZipCentroid;
};

export async function translateZipToPlace(
  input: TranslateZipToPlaceInput,
): Promise<ZipTranslationResult> {
  const zip5 = normalizeUsZipInput(input.zip);
  if (!zip5) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  // Role gate mirroring guard: this ZIP is used for lookup only, never as a stored
  // historical boundary. Throws (fails closed) if this call site is ever changed to pass a
  // different role literal.
  assertZipNotHistoricalBoundary('modern_lookup');

  const lookup = input.lookupZipCentroid ?? lookupUsZipCentroid;
  const centroid = lookup(zip5);
  if (!centroid) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  let match: Awaited<ReturnType<CensusCoordinatesGeocodeFetcher>>;
  try {
    match = await input.fetchCoordinatesGeocode({ lat: centroid.lat, lng: centroid.lng });
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  const scope = evaluateGeocodeProductScope(match);
  if (!scope.inScope) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const jurisdictionIds = resolveJurisdictionIdsFromMatch(match);
  const placeName = match.placeName ?? centroid.city;

  // `zip` (the input) and any echoed ZIP from Census are deliberately NOT included below —
  // translate-then-discard.
  return {
    ok: true,
    ...(placeName ? { placeName } : {}),
    ...(match.stateName ? { stateName: match.stateName } : {}),
    ...(match.countyName ? { countyName: match.countyName } : {}),
    jurisdictionIds,
  };
}
