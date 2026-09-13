/**
 * 50-states-+-D.C. product scope gate for geocode results (;
 * ADR-008 "Product scope for address discovery is U.S.-oriented (50 states + D.C.)").
 *
 * Scope membership is derived from the SAME `US_STATES` table already treat as
 * the single source of truth (`../map/us-geography.ts`) never a second, hand-typed FIPS list.
 * A Census Geocoder match for a U.S. territory (Puerto Rico `72`, Guam `66`, U.S. Virgin Islands
 * `78`, American Samoa `60`, Northern Mariana Islands `69`) has a real state-equivalent FIPS
 * code but is out of this product's scope; `evaluateGeocodeProductScope` reports that rather
 * than silently resolving jurisdiction ids for a state row that will never exist in the
 * `jurisdictions` collection (only the 50 states + D.C. are loaded from this same table).
 *
 * NOT widened for non-US birthplaces (2026-09-12 OWNER RULING, repo-9rkh: "the Atlas supports
 * non-US birthplaces"), despite that ruling naming this file. This gate only ever receives a
 * `CensusGeocodeMatch` — a result of the US Census Geocoder, which does not geocode non-US
 * places at all, so it never returns a match with a foreign country's state-equivalent FIPS for
 * `IN_SCOPE_STATE_FIPS` to accept or reject in the first place. Widening this set would be a
 * no-op for the actual product need (a Cárdenas, Cuba lookup never reaches this function); real
 * non-US support for the address-search/`/locate` path this gate guards would need a non-Census
 * geocoder backend plus a non-US branch of `resolveJurisdictionIdsFromMatch`
 * (`./jurisdiction-ids.ts` hard-codes `countryJurisdictionId() => 'us'`) — a separate, larger
 * change than this file, deliberately left as a follow-up rather than bundled in here.
 * `lookupNonUsCityCentroid` (`./city-centroid.ts`) is the part of this ruling that ships now: it
 * is used directly by the birthplace-pin write path (`packages/ops-data/scripts/
 * fix-pin-saturation.ts`), which never calls this Census-oriented gate at all.
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
