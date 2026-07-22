/**
 * CDC EJI county environmental-burden adapter surface for Phase 1 theme-impact Q9 ingest.
 */
export {
  CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE,
  CDC_EJI_DATA_DOWNLOAD_URL,
  CDC_EJI_ENVIRONMENTAL_BURDEN_RANK_COLUMNS,
  CDC_EJI_FIXTURE_FILENAME,
  CDC_EJI_HOMEPAGE_URL,
  CDC_EJI_IL_FULL_FIXTURE_FILENAME,
  CDC_EJI_IL_TRACT_CACHE_FILENAME,
  CDC_EJI_NATIONAL_CACHE_FILENAME,
  CDC_EJI_STATE_CSV_URL_TEMPLATE,
  CDC_EJI_TRACT_GEOID_COLUMNS,
  CDC_EJI_ZENODO_NATIONAL_CSV_URL,
  PHASE1_EJI_DATASET_VINTAGE,
  PHASE1_EJI_DEFAULT_COUNTY_FIPS,
  PHASE1_EJI_DEFAULT_REFERENCE_YEAR,
  PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID,
} from './constants.js';
export {
  listPhase1EjiIndicators,
  mapEjiCountyRollupsToObservations,
  parseEjiTractCsv,
  rollupEjiTractsToCounties,
  type Phase1EjiObservationDraft,
} from './phase1-eji-mapper.js';
export {
  DEFAULT_FIXTURE_PATH as CDC_EJI_DEFAULT_FIXTURE_PATH,
  fetchPhase1EjiCountyObservations,
  type Phase1EjiFetchResult,
} from './fetch-phase1-eji.js';
