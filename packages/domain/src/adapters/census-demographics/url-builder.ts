/** URL construction for the decennial county race pull — pure, unit-testable, no fetch.
 * Machine fetch URLs (`buildCountyPopulationUrl`) stay on api.census.gov; provenance
 * `sourceUrl` for public UI points at the Census Bureau dataset landing page that owns
 * the release (never a raw API query string).
 */
import type { CensusDecennialVintage } from './types.js';

export const CENSUS_DATA_API_BASE_URL = 'https://api.census.gov/data';

/** Owning-body dataset pages by decade — what readers should open from citations. */
export const CENSUS_DECENNIAL_HOMEPAGE_BY_DECADE: Readonly<
  Record<CensusDecennialVintage['decade'], string>
> = {
  '2000': 'https://www.census.gov/data/datasets/2000/dec/summary-file-1.html',
  '2010': 'https://www.census.gov/data/datasets/2010/dec/summary-file-1.html',
  '2020': 'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
};

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

/** Owning-body Census landing page for provenance `sourceUrl` (never an API query URL). */
export function buildProvenanceSourceUrl(vintage: CensusDecennialVintage): string {
  return CENSUS_DECENNIAL_HOMEPAGE_BY_DECADE[vintage.decade];
}
