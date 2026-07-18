/**
 * Census decennial demographics adapter surface. Reachable as `@black-book/domain` via the
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
