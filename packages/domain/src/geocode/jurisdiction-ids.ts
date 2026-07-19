/**
 * Deterministic jurisdiction id builders + geocode-match → jurisdiction-id resolution.
 *
 * The `us` / `us-{2-digit state FIPS}` / `us-{2-digit state FIPS}-{3-digit county FIPS}` id
 * scheme below is not invented here — it is the exact scheme
 * `packages/firebase/src/jurisdictions/schema.ts` (`countryJurisdictionId`,
 * `stateJurisdictionId`, `countyJurisdictionId`) and
 * `docs/adr/ADR-016-jurisdiction-reference-data.md` §2 already define and load into the real
 * `jurisdictions` Firestore collection. This module duplicates only the tiny pure
 * string-building functions (not the Firestore schema, loader, or resolver) because
 * `@repo/domain` cannot depend on `@repo/firebase` — that package already depends
 * on `@repo/domain` at runtime, so the reverse edge would be a circular workspace
 * dependency (the same rule `../adapters/internet-archive/shared/http-port.ts` documents for
 * the domain/security edge). Any change to the id format in
 * `packages/firebase/src/jurisdictions/schema.ts` must be mirrored here.
 *
 * The `us-{state}-place-{5-digit place FIPS}` city/place id below is a proposal, not yet
 * backed by any Firestore writer: ADR-016 §1 commits to "cities: on-demand only… keyed by
 * Census place FIPS" but the on-demand creation pass itself lives in `packages/firebase`.
 * `buildPlaceCreateHint` returns the id this module expects that future pass to use, plus the
 * minimal fields (name, stateFips, placeFips, parentId) it would need — a hint, never a write.
 */
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';
import type { PlaceCreateHint, ResolvedJurisdictionIds } from './types.js';

export function countryJurisdictionId(): string {
  return 'us';
}

export function stateJurisdictionId(stateFips: string): string {
  return `us-${stateFips}`;
}

export function countyJurisdictionId(stateFips: string, countyFips3: string): string {
  return `us-${stateFips}-${countyFips3}`;
}

/** Proposed on-demand place id see module doc. Not yet backed by a Firestore writer. */
export function placeJurisdictionId(stateFips: string, placeFips: string): string {
  return `us-${stateFips}-place-${placeFips}`;
}

/**
 * Resolves a normalized Census geocode match to jurisdiction ids: state and county are
 * always resolvable when the match carries their FIPS codes (Census returns them for every
 * successful match); place/city is on-demand only (ADR-016). `placeId` is still computed
 * deterministically so a caller can check for the doc's existence, and `placeCreateHint` is
 * attached so the on-demand-creation pass has everything it needs.
 */
export function resolveJurisdictionIdsFromMatch(match: CensusGeocodeMatch): ResolvedJurisdictionIds {
  const countryId = countryJurisdictionId();
  if (!match.stateFips) {
    return { countryId };
  }

  const stateId = stateJurisdictionId(match.stateFips);
  const countyId = match.countyFips3 ? countyJurisdictionId(match.stateFips, match.countyFips3) : undefined;

  if (!match.placeFips) {
    return {
      countryId,
      stateId,
      ...(countyId ? { countyId } : {}),
    };
  }

  const placeId = placeJurisdictionId(match.stateFips, match.placeFips);
  const placeCreateHint: PlaceCreateHint = {
    id: placeId,
    name: match.placeName ?? 'Unnamed place',
    stateFips: match.stateFips,
    placeFips: match.placeFips,
    parentId: stateId,
  };

  return {
    countryId,
    stateId,
    ...(countyId ? { countyId } : {}),
    placeId,
    placeCreateHint,
  };
}
