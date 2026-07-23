/**
 * HUD CHAS Phase 1 county cost-burden adapter exports (Table 20 Con Plan, Cook 17031 fixture spine).
 */
export {
  HUD_CHAS_API_DOCS_URL,
  HUD_CHAS_COOK_CON_PLAN_TABLE20_SOURCE_URL,
  HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME,
  HUD_CHAS_DATA_DOWNLOAD_URL,
  HUD_CHAS_HOMEPAGE_URL,
  HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE,
  HUD_CHAS_TABLE20_SOURCE_TABLE,
  HUD_CHAS_TABLE9_COST_BURDEN_METHOD_NOTE,
  HUD_CHAS_TABLE9_SOURCE_TABLE,
  PHASE1_HUD_CHAS_BOUNDARY_VERSION,
  PHASE1_HUD_CHAS_COOK_JURISDICTION_ID,
  PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID,
  PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID,
  PHASE1_HUD_CHAS_DATASET_VINTAGE,
  PHASE1_HUD_CHAS_DEFAULT_COUNTY_FIPS,
  PHASE1_HUD_CHAS_REFERENCE_PERIOD,
} from './constants.js';
export {
  DEFAULT_FIXTURE_PATH as HUD_CHAS_PHASE1_DEFAULT_FIXTURE_PATH,
  fetchPhase1ChasObservations,
  type Phase1ChasFetchResult,
} from './fetch-phase1-chas.js';
export {
  assertChasCookThemeImpactRowsPresent,
  mapChasRowsToObservations,
  parseChasCookCostBurdenFixtureCsv,
  type ChasCookCostBurdenRow,
  type Phase1ChasObservationDraft,
} from './phase1-chas-mapper.js';
export { listPhase1ChasIndicators } from '../../statistics/phase1-chas-indicator-catalog.js';
