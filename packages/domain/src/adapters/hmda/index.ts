/**
 * HMDA county aggregate adapter surface for Phase 1 denial-rate ingest (FFIEC Data Browser).
 */
export {
  HMDA_AGGREGATE_STRATEGY_NOTE,
  HMDA_COUNTY_AGGREGATIONS_URL_TEMPLATE,
  HMDA_DATA_BROWSER_AGGREGATIONS_API_URL,
  HMDA_DATA_BROWSER_HOMEPAGE_URL,
  HMDA_DERIVED_RACE_BLACK,
  HMDA_DERIVED_RACE_WHITE,
  HMDA_DENIAL_RATE_ACTIONS_TAKEN,
  PHASE1_HMDA_DATASET_VINTAGE,
  PHASE1_HMDA_DEFAULT_COUNTY_FIPS,
  PHASE1_HMDA_DEFAULT_YEARS,
  PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID,
  PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID,
} from './constants.js';
export {
  listPhase1HmdaIndicators,
  mapHmdaCountyCountsToObservations,
  parseHmdaCountyAggregationResponse,
  type HmdaAggregationSlice,
  type HmdaAggregationsResponse,
  type Phase1HmdaObservationDraft,
} from './phase1-hmda-mapper.js';
export {
  buildCountyAggregationsUrl,
  fetchPhase1HmdaCountyObservations,
  normalizeHmdaAggregationPayloadForCountyYear,
  type Phase1HmdaFetchResult,
} from './fetch-phase1-hmda-aggregates.js';
