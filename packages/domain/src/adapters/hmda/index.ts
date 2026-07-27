/**
 * HMDA county and national aggregate adapter surface for Phase 1 denial-rate ingest (FFIEC Data Browser).
 */
export {
  HMDA_AGGREGATE_STRATEGY_NOTE,
  HMDA_COUNTY_AGGREGATIONS_URL_TEMPLATE,
  HMDA_DATA_BROWSER_AGGREGATIONS_API_URL,
  HMDA_DATA_BROWSER_HOMEPAGE_URL,
  HMDA_DERIVED_RACE_BLACK,
  HMDA_DERIVED_RACE_WHITE,
  HMDA_DENIAL_RATE_ACTIONS_TAKEN,
  HMDA_NATION_AGGREGATE_STRATEGY_NOTE,
  PHASE1_HMDA_DATASET_VINTAGE,
  PHASE1_HMDA_DEFAULT_COUNTY_FIPS,
  PHASE1_HMDA_DEFAULT_YEARS,
  PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_BLACK_NATION_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_NH_NATION_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_WHITE_NH_NATION_METRIC_ID,
  PHASE1_HMDA_NATION_DATASET_VINTAGE,
  PHASE1_HMDA_NATION_YEARS,
} from './constants.js';
export {
  listPhase1HmdaIndicators,
  mapHmdaCountyCountsToObservations,
  mapHmdaNationCountsToObservations,
  parseHmdaCountyAggregationResponse,
  parseHmdaNationAggregationResponse,
  type HmdaAggregationSlice,
  type HmdaAggregationsResponse,
  type Phase1HmdaObservationDraft,
} from './phase1-hmda-mapper.js';
export {
  fetchPhase1HmdaCountyObservations,
  type Phase1HmdaFetchResult,
} from './fetch-phase1-hmda-aggregates.js';
export {
  fetchPhase1NationHmdaObservations,
  type Phase1NationHmdaFetchResult,
} from './fetch-national-hmda-aggregates.js';
