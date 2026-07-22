/** URL construction for ACS 5-year pulls — pure, unit-testable, no fetch.
 * Fetch helpers stay on api.census.gov; provenance `sourceUrl` points at the ACS
 * program page that links to the estimates (owning-body surface for citations).
 */
import { CENSUS_DATA_API_BASE_URL } from './url-builder.js';
import type { AcsVintage } from './acs-types.js';

/** ACS program hub — human landing page for public citations. */
export const ACS_PROGRAM_HOMEPAGE_URL = 'https://www.census.gov/programs-surveys/acs';

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

/** Single-variable metadata — bulk variables.json omits some MOE ids (2024 acs5). */
export function buildAcsVariableUrl(vintage: AcsVintage, variableId: string): string {
  return `${CENSUS_DATA_API_BASE_URL}/${vintage.dataset}/variables/${variableId}.json`;
}

/** Owning-body ACS landing page for provenance `sourceUrl` (never an API query URL). */
export function buildAcsCountyProvenanceUrl(_vintage: AcsVintage): string {
  return ACS_PROGRAM_HOMEPAGE_URL;
}

/** Owning-body ACS landing page for tract-row provenance (same public hub as county). */
export function buildAcsTractProvenanceUrl(_vintage: AcsVintage, _stateFips: string): string {
  return ACS_PROGRAM_HOMEPAGE_URL;
}
