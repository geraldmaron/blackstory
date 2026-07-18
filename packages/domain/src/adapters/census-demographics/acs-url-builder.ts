/** URL construction for ACS 5-year pulls — pure, unit-testable, no fetch. */
import { CENSUS_DATA_API_BASE_URL } from './url-builder.js';
import type { AcsVintage } from './acs-types.js';

function variableList(vintage: AcsVintage): string {
  return `NAME,${vintage.variables.map((v) => v.id).join(',')}`;
}

/** All counties in all states, every starter variable + NAME, one request per vintage. */
export function buildAcsCountyUrl(vintage: AcsVintage, apiKey?: string): string {
  const params = new URLSearchParams({
    get: variableList(vintage),
    for: 'county:*',
    in: 'state:*',
  });
  if (apiKey) params.set('key', apiKey);
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}?${params.toString()}`;
}

/** All tracts in one state — tract queries require a concrete state, so callers fan out
 * over state FIPS codes (one request per state). */
export function buildAcsTractUrl(vintage: AcsVintage, stateFips: string, apiKey?: string): string {
  if (!/^\d{2}$/.test(stateFips)) {
    throw new Error(`stateFips must be 2 digits, got "${stateFips}"`);
  }
  const params = new URLSearchParams({
    get: variableList(vintage),
    for: 'tract:*',
    in: `state:${stateFips}`,
  });
  if (apiKey) params.set('key', apiKey);
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}?${params.toString()}`;
}

/** The dataset's own variable dictionary — used to assert our expected ids by label. */
export function buildAcsVariablesUrl(vintage: AcsVintage): string {
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}/variables.json`;
}

/** Public (keyless) county-query form, recorded as provenance `sourceUrl` — the key must
 * never be persisted into a provenance field (same rule as ./url-builder.ts). */
export function buildAcsCountyProvenanceUrl(vintage: AcsVintage): string {
  return buildAcsCountyUrl(vintage);
}

/** Public (keyless) tract-query form for one state, recorded as provenance `sourceUrl`. */
export function buildAcsTractProvenanceUrl(vintage: AcsVintage, stateFips: string): string {
  return buildAcsTractUrl(vintage, stateFips);
}
