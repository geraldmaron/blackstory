/**
 * 50-states-plus-D.C. product-scope gate for U.S. Census Geocoder results.
 * `docs/decisions-carryover.md`, "Search and geocoding", defines address discovery as the 50
 * states plus D.C.
 *
 * Scope membership is derived from the `US_STATES` table already used as the single source of
 * truth (`../map/us-geography.ts`), never from a second hand-typed FIPS list.
 * A Census Geocoder match for a U.S. territory (Puerto Rico `72`, Guam `66`, U.S. Virgin Islands
 * `78`, American Samoa `60`, Northern Mariana Islands `69`) has a real state-equivalent FIPS
 * code but is out of this product's scope; `evaluateGeocodeProductScope` reports that rather
 * than silently resolving jurisdiction ids for a state row that will never exist in the
 * `jurisdictions` collection (only the 50 states + D.C. are loaded from this same table).
 *
 * Non-US birthplaces do not pass through this gate because the Census Geocoder does not resolve
 * them. Supporting non-US address search would require a non-Census backend and a non-US branch
 * of `resolveJurisdictionIdsFromMatch`; `./jurisdiction-ids.ts` currently returns the `us`
 * country jurisdiction. The birthplace-pin path instead calls `lookupNonUsCityCentroid` from
 * `./city-centroid.ts` directly and never reaches this Census-specific gate.
 */
import { US_STATES } from '../map/us-geography.js';
import type { CensusGeocodeMatch } from '../adapters/census-geo/types.js';

const IN_SCOPE_STATE_FIPS = new Set(US_STATES.map((state) => state.fips));

export function isInProductScopeStateFips(stateFips: string): boolean {
  return IN_SCOPE_STATE_FIPS.has(stateFips);
}

export type GeocodeProductScopeResult =
  | { readonly inScope: true }
  | { readonly inScope: false; readonly reason: 'territory_out_of_scope' | 'no_state_resolved' };

/** Evaluates whether a geocode match's state falls within the 50-states-+-D.C. product scope. */
export function evaluateGeocodeProductScope(match: CensusGeocodeMatch): GeocodeProductScopeResult {
  if (!match.stateFips) {
    return { inScope: false, reason: 'no_state_resolved' };
  }
  if (!isInProductScopeStateFips(match.stateFips)) {
    return { inScope: false, reason: 'territory_out_of_scope' };
  }
  return { inScope: true };
}
