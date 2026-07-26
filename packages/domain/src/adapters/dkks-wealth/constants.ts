/**
 * Derenoncourt–Kim–Kuhn–Schularick "Wealth of Two Nations: The U.S. Racial
 * Wealth Gap, 1860-2020" (QJE 2024) national wealth-gap ingest constants.
 */

/** Author-hosted "final dataset" — the headline benchmark-year series. */
export const DKKS_WEALTH_GAP_SOURCE_URL = 'https://www.elloraderenoncourt.com/us-inequality-data';

export const DKKS_PERCAPITA_WEALTH_BLACK_NATION_METRIC_ID = 'dkks-percapita-wealth-black-nation';
export const DKKS_PERCAPITA_WEALTH_WHITE_NATION_METRIC_ID = 'dkks-percapita-wealth-white-nation';
export const DKKS_WEALTH_RATIO_WHITE_BLACK_NATION_METRIC_ID = 'dkks-wealth-ratio-white-black-nation';

export const DKKS_WEALTH_NATION_JURISDICTION_ID = 'nation:US';
export const DKKS_WEALTH_BOUNDARY_VERSION = 'nation-2020';

export const DKKS_WEALTH_SOURCE_DATASET = 'derenoncourt-wealth-of-two-nations';

export const DKKS_WEALTH_DATASET_VINTAGE =
  'DKKS QJE 2024 replication "final dataset" — benchmark-year per-capita wealth by race, 2019 USD; ' +
  'authors\' own nonblack-proxy-for-white convention pre-1950 (see paper appendix).';

export const DKKS_WEALTH_FIXTURE_FILENAME = 'dkks-wealth-gap-1860-2020.csv';
