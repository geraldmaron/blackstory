/**
 * Illinois county FIPS helpers for Phase 1 CDC EJI + EPA TRI county rollups.
 * Illinois (state FIPS 17) has 102 counties in the 2020 vintage used by theme-impact Q9.
 */

export const PHASE1_ILLINOIS_STATE_FIPS = '17';

/** Chicago pilot subset — Cook, DuPage, Lake. */
export const PHASE1_EJI_TRI_PILOT_COUNTY_FIPS = ['17031', '17043', '17097'] as const;

export function isIllinoisCountyFips(countyFips: string): boolean {
  return countyFips.startsWith(PHASE1_ILLINOIS_STATE_FIPS) && /^\d{5}$/.test(countyFips);
}

export function filterIllinoisCountyFips(countyFips: readonly string[]): readonly string[] {
  return countyFips.filter(isIllinoisCountyFips);
}
