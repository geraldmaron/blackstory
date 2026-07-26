/**
 * DKKS "Wealth of Two Nations" adapter surface for Phase 2 national racial
 * wealth-gap ingest (repo-zxjz.2).
 */
export {
  DKKS_WEALTH_GAP_SOURCE_URL,
  DKKS_PERCAPITA_WEALTH_BLACK_NATION_METRIC_ID,
  DKKS_PERCAPITA_WEALTH_WHITE_NATION_METRIC_ID,
  DKKS_WEALTH_RATIO_WHITE_BLACK_NATION_METRIC_ID,
  DKKS_WEALTH_NATION_JURISDICTION_ID,
  DKKS_WEALTH_BOUNDARY_VERSION,
  DKKS_WEALTH_SOURCE_DATASET,
  DKKS_WEALTH_DATASET_VINTAGE,
  DKKS_WEALTH_FIXTURE_FILENAME,
} from './constants.js';
export {
  parseDkksWealthGapFixtureCsv,
  mapDkksWealthRowsToObservations,
  listPhase2DkksWealthIndicators,
  PHASE2_DKKS_WEALTH_INDICATOR_CATALOG,
  type Phase2DkksWealthObservationDraft,
  type Phase2DkksWealthIndicatorDefinition,
  type DkksWealthGapRow,
} from './phase2-dkks-wealth-mapper.js';
export {
  fetchPhase2DkksWealthObservations,
  DEFAULT_FIXTURE_PATH as DKKS_WEALTH_DEFAULT_FIXTURE_PATH,
  type Phase2DkksWealthFetchResult,
} from './fetch-phase2-dkks-wealth.js';
