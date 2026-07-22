/**
 * SCF wealth adapter surface for Phase 1 national median net worth ingest.
 */
export {
  SCF_HOMEPAGE_URL,
  SCF_FEDS_NOTE_MEDIAN_WEALTH_BY_RACE_URL,
  SCF_MEDIAN_WEALTH_FIXTURE_FILENAME,
  PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID,
  PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID,
  PHASE1_SCF_WEALTH_BOUNDARY_VERSION,
  PHASE1_SCF_WEALTH_DATASET_VINTAGE,
  PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID,
  PHASE1_SCF_WEALTH_TRIENNIAL_YEARS,
} from './constants.js';
export {
  parseScfMedianWealthFixtureCsv,
  mapScfWealthRowsToObservations,
  listPhase1ScfWealthIndicators,
  type Phase1ScfWealthObservationDraft,
  type ScfMedianWealthByRaceRow,
} from './phase1-scf-wealth-mapper.js';
export {
  fetchPhase1ScfWealthObservations,
  DEFAULT_FIXTURE_PATH,
  type Phase1ScfWealthFetchResult,
} from './fetch-phase1-scf-wealth.js';
