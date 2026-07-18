/**
 * Census decennial demographics adapter surface. Reachable as `@blap/domain` via the
 * existing wildcard chain (`../index.ts` → `../../index.ts`), same as `../census-geo/`.
 */
export {
  CENSUS_DECENNIAL_VINTAGES,
  type CensusDecennialVintage,
  type CountyDecadePopulation,
} from './types.js';
export {
  CENSUS_DATA_API_BASE_URL,
  buildCountyPopulationUrl,
  buildProvenanceSourceUrl,
  buildVariablesUrl,
} from './url-builder.js';
export {
  CensusVariableMismatchError,
  assertVariableLabels,
  parseCountyPopulationResponse,
} from './response-parser.js';
export {
  fetchCountyPopulations,
  type CountyPopulationFetchResult,
  type FetchLike,
} from './fetch-county-populations.js';
export {
  ACS5_2024_VINTAGE,
  ACS5_STARTER_VARIABLES,
  type AcsProfileRow,
  type AcsVariableSpec,
  type AcsVintage,
} from './acs-types.js';
export {
  buildAcsCountyProvenanceUrl,
  buildAcsCountyUrl,
  buildAcsTractProvenanceUrl,
  buildAcsTractUrl,
  buildAcsVariablesUrl,
} from './acs-url-builder.js';
export { assertAcsVariableLabels, parseAcsResponse } from './acs-response-parser.js';
export {
  assertAcsVintageDictionary,
  fetchAcsCountyProfiles,
  fetchAcsTractProfiles,
  type AcsProfileFetchResult,
} from './fetch-acs-profiles.js';
