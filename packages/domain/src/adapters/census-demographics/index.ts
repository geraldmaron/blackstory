/**
 * Census decennial demographics adapter surface. Reachable as `@repo/domain` via the
 * existing wildcard chain (`../index.ts` → `../../index.ts`), same as `../census-geo/`.
 */
export {
  CENSUS_DECENNIAL_VINTAGES,
  type CensusDecennialVintage,
  type CountyDecadePopulation,
} from './types.js';
export {
  CENSUS_DATA_API_BASE_URL,
  CENSUS_DECENNIAL_HOMEPAGE_BY_DECADE,
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
  ACS_PROGRAM_HOMEPAGE_URL,
  buildAcsCountyProvenanceUrl,
  buildAcsCountyUrl,
  buildAcsTractProvenanceUrl,
  buildAcsTractUrl,
  buildAcsVariablesUrl,
} from './acs-url-builder.js';
export {
  assertAcsVariableLabels,
  loadAcsVariablesDictionary,
  parseAcsResponse,
} from './acs-response-parser.js';
export {
  assertAcsVintageDictionary,
  fetchAcsCountyProfiles,
  fetchAcsTractProfiles,
  type AcsProfileFetchResult,
} from './fetch-acs-profiles.js';
export {
  PHASE1_ACS5_VARIABLES,
  PHASE1_ACS5_2024_VINTAGE,
  PHASE1_ACS_DEFAULT_COUNTY_STATE_FIPS,
  phase1AcsReferencePeriod,
  phase1AcsDatasetVintageLabel,
} from './phase1-acs-variables.js';
export {
  parsePhase1AcsResponse,
  mapPhase1AcsRowToObservations,
  acsProfileRowToPhase1Row,
  listPhase1AcsIndicators,
  type Phase1AcsGeography,
  type Phase1AcsObservationDraft,
} from './phase1-acs-mapper.js';
export {
  fetchPhase1AcsCountyObservations,
  fetchPhase1AcsStateObservations,
  buildCountyInStatesUrl,
  buildStateUrl,
  type Phase1AcsFetchResult,
} from './fetch-phase1-acs.js';
