/**
 * Maps U.S. state postal codes to Census Bureau regions for geographic diversity
 * reporting. Product scope is 50 states + D.C. (no territories), matching.
 */
import type { UsCensusRegion } from './types.js';

const STATE_TO_REGION: Readonly<Record<string, UsCensusRegion>> = {
  CT: 'Northeast',
  ME: 'Northeast',
  MA: 'Northeast',
  NH: 'Northeast',
  NJ: 'Northeast',
  NY: 'Northeast',
  PA: 'Northeast',
  RI: 'Northeast',
  VT: 'Northeast',
  IL: 'Midwest',
  IN: 'Midwest',
  IA: 'Midwest',
  KS: 'Midwest',
  MI: 'Midwest',
  MN: 'Midwest',
  MO: 'Midwest',
  NE: 'Midwest',
  ND: 'Midwest',
  OH: 'Midwest',
  SD: 'Midwest',
  WI: 'Midwest',
  AL: 'South',
  AR: 'South',
  DE: 'South',
  DC: 'South',
  FL: 'South',
  GA: 'South',
  KY: 'South',
  LA: 'South',
  MD: 'South',
  MS: 'South',
  NC: 'South',
  OK: 'South',
  SC: 'South',
  TN: 'South',
  TX: 'South',
  VA: 'South',
  WV: 'South',
  AK: 'West',
  AZ: 'West',
  CA: 'West',
  CO: 'West',
  HI: 'West',
  ID: 'West',
  MT: 'West',
  NV: 'West',
  NM: 'West',
  OR: 'West',
  UT: 'West',
  WA: 'West',
  WY: 'West',
};

export function censusRegionForState(postalCode: string): UsCensusRegion | undefined {
  return STATE_TO_REGION[postalCode.toUpperCase()];
}

export function assertKnownUsState(postalCode: string): UsCensusRegion {
  const region = censusRegionForState(postalCode);
  if (!region) {
    throw new Error(`Unknown or out-of-scope state/territory postal code: ${postalCode}`);
  }
  return region;
}
