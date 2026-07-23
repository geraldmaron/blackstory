/**
 * HUD CHAS Phase 1 Cook County cost-burden-by-race constants — Con Plan Table 20
 * (CHAS 2016–2020 suburban Cook jurisdiction) for theme-impact Q3/Q4 affordability.
 */

/** Registry homepage — cite on every published observation. */
export const HUD_CHAS_HOMEPAGE_URL = 'https://www.huduser.gov/portal/datasets/cp.html';

/** CHAS data download anchor (multi-year tabulations). */
export const HUD_CHAS_DATA_DOWNLOAD_URL =
  'https://www.huduser.gov/portal/datasets/cp.html#data_2006-2023';

/** CHAS API documentation (optional live aggregate fetch). */
export const HUD_CHAS_API_DOCS_URL = 'https://www.huduser.gov/portal/dataset/chas-api.html';

/** Cook County Consolidated Plan 2025–2029 Table 20 (Greater Need: Housing Cost Burdens). */
export const HUD_CHAS_COOK_CON_PLAN_TABLE20_SOURCE_URL =
  'https://www.cookcountyil.gov/sites/g/files/ywwepo161/files/documents/2025-09/Cook%20County%20Consolidated%20Plan%202025-2029%20September%202025.pdf';

export const PHASE1_HUD_CHAS_COST_BURDEN_BLACK_COUNTY_METRIC_ID =
  'hud-chas-cost-burden-black-county';
export const PHASE1_HUD_CHAS_COST_BURDEN_WHITE_COUNTY_METRIC_ID =
  'hud-chas-cost-burden-white-county';

/** Chicago pilot — Cook County, Illinois (5-digit FIPS). */
export const PHASE1_HUD_CHAS_DEFAULT_COUNTY_FIPS = '17031';

export const PHASE1_HUD_CHAS_COOK_JURISDICTION_ID = 'county:17031';

export const PHASE1_HUD_CHAS_BOUNDARY_VERSION = 'county-2020';

export const PHASE1_HUD_CHAS_DATASET_VINTAGE =
  'HUD CHAS 2016–2020 ACS 5-year Table 20; Cook County Con Plan curated suburban Cook fixture mapped to county 17031';

export const PHASE1_HUD_CHAS_REFERENCE_PERIOD = '2016-2020';

export const HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME =
  'chas-cook-county-17031-cost-burden-2016-2020.csv';

/**
 * Universe and methodology stored on observations — CHAS Table 20 cost burden >30%
 * for householder race alone (not Hispanic); owners and renters combined; excludes
 * households where cost burden is not computed. Geography is Suburban Cook County
 * (excludes Chicago city) per Con Plan tabulation, stored under county:17031 pending
 * full HUD county 050 extract.
 */
export const HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE =
  'Share of occupied households with HUD CHAS cost burden greater than 30% of household ' +
  'income (owners and renters combined), among householders who are Black alone or White ' +
  'alone and not Hispanic or Latino. Source table: CHAS Table 20 (Cook County Consolidated ' +
  'Plan 2025–2029, Greater Need: Housing Cost Burdens), 2016–2020 ACS 5-year tabulation for ' +
  'Suburban Cook County jurisdiction (excludes Chicago city). Excludes rows where CHAS marks ' +
  'cost burden as not computed. Mapped to county:17031 for Phase 1 theme-impact Q3/Q4.';

/** HUD CHAS Table 20 source table for statistical_series.source_table. */
export const HUD_CHAS_TABLE20_SOURCE_TABLE = 'Table20';

/** @deprecated Use HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE */
export const HUD_CHAS_TABLE9_COST_BURDEN_METHOD_NOTE = HUD_CHAS_TABLE20_COST_BURDEN_METHOD_NOTE;

/** @deprecated Use HUD_CHAS_TABLE20_SOURCE_TABLE */
export const HUD_CHAS_TABLE9_SOURCE_TABLE = HUD_CHAS_TABLE20_SOURCE_TABLE;
