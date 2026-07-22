/**
 * EPA TRI county facility-count adapter surface for Phase 1 theme-impact Q9 ingest.
 */
export {
  EPA_TRI_AGGREGATE_STRATEGY_NOTE,
  EPA_TRI_BASIC_DATA_URL,
  EPA_TRI_FIXTURE_FILENAME,
  EPA_TRI_HOMEPAGE_URL,
  EPA_TRI_IL_FACILITY_API_URL,
  PHASE1_TRI_DATASET_VINTAGE,
  PHASE1_TRI_DEFAULT_COUNTY_FIPS,
  PHASE1_TRI_DEFAULT_REPORTING_YEAR,
  PHASE1_TRI_DEFAULT_REPORTING_YEARS,
  PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID,
} from './constants.js';
export {
  aggregateTriFacilityCounts,
  listPhase1TriIndicators,
  mapTriFacilityCountsToObservations,
  parseTriFacilityCsv,
  parseTriFacilityJsonPayload,
  type Phase1TriObservationDraft,
  type TriFacilityRow,
} from './phase1-tri-mapper.js';
export {
  DEFAULT_FIXTURE_PATH as EPA_TRI_DEFAULT_FIXTURE_PATH,
  fetchPhase1TriCountyObservations,
  type Phase1TriFetchResult,
} from './fetch-phase1-tri.js';
