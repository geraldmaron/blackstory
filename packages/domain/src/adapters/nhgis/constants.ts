/**
 * IPUMS NHGIS Phase 1 Cook County race population-share ingest constants —
 * decennial county race counts for theme-impact fair-housing / CRA era juxtaposition.
 */

/** Registry homepage — cite on every published observation. */
export const NHGIS_HOMEPAGE_URL = 'https://www.nhgis.org/';

/** NHGIS time-series tables documentation (nominal county race integration). */
export const NHGIS_TIME_SERIES_TABLES_URL = 'https://www.nhgis.org/time-series-tables';

/** Citing NHGIS — required attribution language. */
export const NHGIS_CITATION_URL = 'https://www.nhgis.org/citing-nhgis';

export const PHASE1_NHGIS_BLACK_POPULATION_SHARE_COUNTY_METRIC_ID =
  'nhgis-black-population-share-county';
export const PHASE1_NHGIS_WHITE_POPULATION_SHARE_COUNTY_METRIC_ID =
  'nhgis-white-population-share-county';

/** Chicago pilot — Cook County, Illinois (5-digit FIPS). */
export const PHASE1_NHGIS_DEFAULT_COUNTY_FIPS = '17031';

export const PHASE1_NHGIS_COOK_JURISDICTION_ID = 'county:17031';

/** Harmonized modern county boundary anchor for decennial FIPS-stable Cook rows. */
export const PHASE1_NHGIS_BOUNDARY_VERSION = 'county-2010';

export const PHASE1_NHGIS_DATASET_VINTAGE =
  'IPUMS NHGIS decennial county race counts (curated fixture; Cook County IL 1970–2010)';

/** Minimum decennial vintages for theme-impact Q3/Q7 fair-housing / CRA era spine. */
export const PHASE1_NHGIS_THEME_IMPACT_DECADES = [
  1970, 1980, 1990, 2000, 2010,
] as const;

export const NHGIS_COOK_RACE_POPULATION_SHARE_FIXTURE_FILENAME =
  'nhgis-cook-county-17031-race-population-share-1970-2010.csv';

/**
 * Homeownership / tenure by race for Cook County is deferred — NHGIS tenure tables need
 * separate variable registration and cross-decade comparability review (~1990+ practical).
 */
export const PHASE1_NHGIS_TENURE_DEFERRED_NOTE =
  'NHGIS county tenure-by-race metrics deferred; population-share time series only in repo-534k.';
