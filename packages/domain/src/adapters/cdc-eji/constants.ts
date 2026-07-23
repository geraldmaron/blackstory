/**
 * CDC Environmental Justice Index (EJI) Phase 1 county rollup constants — tract→county
 * mean of Environmental Burden Module percentile ranks (RPL_EBM). Dignity-safe context
 * metric for theme-impact Q9; not a hazard heat map.
 */

/** Registry homepage — cite on every published observation. */
export const CDC_EJI_HOMEPAGE_URL =
  'https://www.atsdr.cdc.gov/placeandhealth/eji/index.html';

export const CDC_EJI_DATA_DOWNLOAD_URL =
  'https://www.atsdr.cdc.gov/placeandhealth/eji/eji-data-download.html';

/** Illinois state CSV template (substitute {year} when live fetch is enabled). */
export const CDC_EJI_STATE_CSV_URL_TEMPLATE =
  'https://eji.cdc.gov/PHTools/EJI_Data_Download/EJI_{year}_IL.csv';

/**
 * Zenodo mirror of CDC EJI 2024 national tract CSV (~80 MB). Used when the CDC
 * state CSV endpoint is unavailable; filtered to Illinois tracts before rollup.
 */
export const CDC_EJI_ZENODO_NATIONAL_CSV_URL =
  'https://zenodo.org/records/14675861/files/EJI_2024_United_States.csv?download=1';

export const CDC_EJI_NATIONAL_CACHE_FILENAME = 'eji-2024-united-states.csv';
export const CDC_EJI_IL_TRACT_CACHE_FILENAME = 'eji-2024-il-tracts.csv';

export const PHASE1_EJI_ENVIRONMENTAL_BURDEN_SCORE_COUNTY_METRIC_ID =
  'cdc-eji-environmental-burden-score-county';

export const PHASE1_EJI_DATASET_VINTAGE = 'CDC EJI 2024 tract download (RPL_EBM county mean)';

export const PHASE1_EJI_DEFAULT_REFERENCE_YEAR = 2024;

/** Chicago pilot — Cook County plus DuPage and Lake, Illinois. */
export const PHASE1_EJI_DEFAULT_COUNTY_FIPS = ['17031', '17043', '17097'] as const;

/** EJI tract CSV column for Environmental Burden Module percentile rank (0–1). */
export const CDC_EJI_ENVIRONMENTAL_BURDEN_RANK_COLUMNS = ['RPL_EBM', 'EPL_EBM'] as const;

/** EJI tract CSV column for 11-digit census tract GEOID. */
export const CDC_EJI_TRACT_GEOID_COLUMNS = ['GEOID', 'GEOID_20', 'GEOID20'] as const;

/**
 * County rollup method stored on observations — unweighted tract mean, no alarm framing.
 * Tract GEOID prefix (first 5 digits) maps to county FIPS.
 */
export const CDC_EJI_COUNTY_ROLLUP_METHOD_NOTE =
  'County environmental burden score is the unweighted arithmetic mean of tract-level ' +
  'Environmental Burden Module percentile ranks (RPL_EBM or EPL_EBM, nationally ' +
  'comparable 0–1 scale) for all tracts whose 11-digit GEOID maps to the county FIPS ' +
  '(state FIPS + county FIPS = first five GEOID digits). Presented as distributional ' +
  'context beside demographic share — not a hazard heat map or individual exposure estimate.';

export const CDC_EJI_FIXTURE_FILENAME = 'eji-il-counties-sample.csv';

/** Full Illinois tract fixture (all 102 counties) — generated from live/Zenodo rollup. */
export const CDC_EJI_IL_FULL_FIXTURE_FILENAME = 'eji-il-counties-full.csv';
