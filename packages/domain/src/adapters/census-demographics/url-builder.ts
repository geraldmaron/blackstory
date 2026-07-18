/** URL construction for the decennial county race pull — pure, unit-testable, no fetch. */
import type { CensusDecennialVintage } from './types.js';

export const CENSUS_DATA_API_BASE_URL = 'https://api.census.gov/data';

/** All counties in all states, both variables + NAME, one request per vintage. */
export function buildCountyPopulationUrl(
  vintage: CensusDecennialVintage,
  apiKey?: string,
): string {
  const params = new URLSearchParams({
    get: `NAME,${vintage.totalVariable},${vintage.blackAloneVariable}`,
    for: 'county:*',
    in: 'state:*',
  });
  if (apiKey) params.set('key', apiKey);
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}?${params.toString()}`;
}

/** The dataset's own variable dictionary — used to assert our expected ids by label. */
export function buildVariablesUrl(vintage: CensusDecennialVintage): string {
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}/variables.json`;
}

/** Public (keyless) form of the data URL, recorded as provenance `sourceUrl` — the key must
 * never be persisted into a provenance field. */
export function buildProvenanceSourceUrl(vintage: CensusDecennialVintage): string {
  return buildCountyPopulationUrl(vintage);
}
