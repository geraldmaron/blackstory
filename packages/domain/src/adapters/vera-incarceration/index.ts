/**
 * Vera Incarceration Trends adapter surface for Phase 1 county jail rate ingest.
 */
export {
  VERA_INCARCERATION_TRENDS_HOMEPAGE_URL,
  VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL,
  VERA_INCARCERATION_ATTRIBUTION_NOTE,
  PHASE1_VERA_DATASET_VINTAGE,
  PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID,
  PHASE1_VERA_DEFAULT_COUNTY_STATE_FIPS,
  VERA_COUNTY_JAIL_RATE_COLUMN,
} from './constants.js';
export {
  parseVeraCountyJailCsv,
  selectVeraCountyJailRows,
  mapVeraCountyJailRowsToObservations,
  listPhase1VeraJailIndicators,
  type VeraCountyJailRow,
  type Phase1VeraJailObservationDraft,
} from './phase1-vera-jail-mapper.js';
export {
  fetchPhase1VeraJailCountyObservations,
  type Phase1VeraJailFetchResult,
} from './fetch-phase1-vera-jail.js';
