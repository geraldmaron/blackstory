/**
 * ZIP-to-place translate-then-discard (; ADR-016 "ZIPs: never
 * stored as reference data"). A user-entered ZIP is used ONLY to ask the Census Geocoder what
 * place/state/county it falls within the raw ZIP is never returned by this function. This is
 * enforced at the type level, not just by convention: `ZipTranslation` carries no `zip` field,
 * so a caller cannot accidentally thread the raw ZIP through to a persisted record just by
 * spreading this function's return value.
 */
import { assertZipNotHistoricalBoundary } from '../geography/location.js';
import { buildManualPlaceSearchFallback } from './manual-fallback.js';
import { resolveJurisdictionIdsFromMatch } from './jurisdiction-ids.js';
import type {
  CensusAddressGeocodeFetcher,
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
  readonly fetchAddressGeocode: CensusAddressGeocodeFetcher;
};

const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

export async function translateZipToPlace(
  input: TranslateZipToPlaceInput,
): Promise<ZipTranslationResult> {
  const zip = input.zip.trim();
  if (!ZIP_PATTERN.test(zip)) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  // Role gate mirroring guard: this ZIP is used for lookup only, never as a stored
  // historical boundary. Throws (fails closed) if this call site is ever changed to pass a
  // different role literal.
  assertZipNotHistoricalBoundary('modern_lookup');

  let matches: readonly Awaited<ReturnType<CensusAddressGeocodeFetcher>>[number][];
  try {
    matches = await input.fetchAddressGeocode(zip);
  } catch {
    return { ok: false, fallback: buildManualPlaceSearchFallback('geocoder_unavailable') };
  }

  const best = matches[0];
  if (!best) {
    return { ok: false, fallback: buildManualPlaceSearchFallback('no_match') };
  }

  const jurisdictionIds = resolveJurisdictionIdsFromMatch(best);

  // `zip` (the input) and `best.zip` (echoed back by Census, when present) are deliberately
  // NOT included below translate-then-discard.
  return {
    ok: true,
    ...(best.placeName ? { placeName: best.placeName } : {}),
    ...(best.stateName ? { stateName: best.stateName } : {}),
    ...(best.countyName ? { countyName: best.countyName } : {}),
    jurisdictionIds,
  };
}
