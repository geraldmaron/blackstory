/** Deterministic jurisdiction identifiers for Census geography. Country, state and county identifiers match the stored reference records. Place identifiers are proposals until an operator creates the corresponding jurisdiction. */
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

/** Proposed on-demand place id see module doc. Persistence must resolve the corresponding reference record. */
export function placeJurisdictionId(stateFips: string, placeFips: string): string {
  return `us-${stateFips}-place-${placeFips}`;
}

/**
 * Resolves a normalized Census geocode match to jurisdiction ids: state and county are
 * always resolvable when the match carries their FIPS codes (Census returns them for every
 * successful match); place/city is on-demand only. `placeId` is still computed
 * deterministically so a caller can check for the doc's existence, and `placeCreateHint` is
 * attached so the on-demand-creation pass has everything it needs.
 */
export function resolveJurisdictionIdsFromMatch(
  match: CensusGeocodeMatch,
): ResolvedJurisdictionIds {
  const countryId = countryJurisdictionId();
  if (!match.stateFips) {
    return { countryId };
  }

  const stateId = stateJurisdictionId(match.stateFips);
  const countyId = match.countyFips3
    ? countyJurisdictionId(match.stateFips, match.countyFips3)
    : undefined;

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
