/**
 * HUD CHAS Phase 1 Cook County cost-burden-by-race constants — Table 9 county
 * tabulation (ACS 2017-2021) for theme-impact Q3/Q4 affordability juxtaposition.
 */

/** Registry homepage — cite on every published observation. */
export const HUD_CHAS_HOMEPAGE_URL = 'https://www.huduser.gov/portal/datasets/cp.html';

/** CHAS data download anchor (2017-2021 ACS 5-year tabulation). */
export const HUD_CHAS_DATA_DOWNLOAD_URL =
  'https://www.huduser.gov/portal/datasets/cp.html#data_2006-2023';

/** CHAS API documentation (optional live aggregate fetch). */
export const HUD_CHAS_API_DOCS_URL = 'https://www.huduser.gov/portal/dataset/chas-api.html';

export const PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID =
  'hud-chas-cost-burden-black-county';
export const PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID =
  'hud-chas-cost-burden-white-county';

/** Chicago pilot — Cook County, Illinois (5-digit FIPS). */
export const PHASE1_HUD_CHAS_DEFAULT_COUNTY_FIPS = '17031';

export const PHASE1_HUD_CHAS_COOK_JURISDICTION_ID = 'county:17031';

export const PHASE1_HUD_CHAS_BOUNDARY_VERSION = 'county-2020';

export const PHASE1_HUD_CHAS_DATASET_VINTAGE =
  'HUD CHAS 2017-2021 ACS 5-year Table 9 county (050); curated Cook 17031 fixture';

export const PHASE1_HUD_CHAS_REFERENCE_PERIOD = '2017-2021';

export const HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME =
  'chas-cook-county-17031-cost-burden-2017-2021.csv';

/**
 * Universe and methodology stored on observations — CHAS Table 9 cost burden >30%
 * for householder race alone (not Hispanic); owners and renters combined; excludes
 * households where cost burden is not computed.
 */
export const HUD_CHAS_TABLE9_COST_BURDEN_METHOD_NOTE =
  'Share of occupied households with HUD CHAS cost burden greater than 30% of household ' +
  'income (owners and renters combined), among householders who are Black alone or White ' +
  'alone and not Hispanic or Latino. Source table: CHAS Table 9 (county summary level 050), ' +
  '2017-2021 ACS 5-year tabulation. Excludes rows where CHAS marks cost burden as not computed.';

/** HUD CHAS Table 9 source table for statistical_series.source_table. */
export const HUD_CHAS_TABLE9_SOURCE_TABLE = 'Table9';
