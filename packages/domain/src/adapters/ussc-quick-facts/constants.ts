/**
 * USSC Quick Facts Phase 1 national drug sentencing ingest constants —
 * published Quick Facts PDF references and metric ids.
 */

/** Registry homepage — cite on every published observation. */
export const USSC_QUICK_FACTS_HOMEPAGE_URL = 'https://www.ussc.gov/research/quick-facts';

export const PHASE1_USSC_AVERAGE_SENTENCE_CRACK_NATION_METRIC_ID =
  'ussc-average-sentence-months-crack-nation';
export const PHASE1_USSC_AVERAGE_SENTENCE_POWDER_NATION_METRIC_ID =
  'ussc-average-sentence-months-powder-nation';
export const PHASE1_USSC_BLACK_SHARE_CRACK_OFFENDERS_NATION_METRIC_ID =
  'ussc-black-share-crack-offenders-nation';

export const PHASE1_USSC_NATION_JURISDICTION_ID = 'nation:US';
export const PHASE1_USSC_BOUNDARY_VERSION = 'nation-2022';

export const PHASE1_USSC_DATASET_VINTAGE =
  'USSC Quick Facts — federal crack/powder cocaine trafficking (fiscal year, published average sentence cells)';

/** Fiscal years with curated Quick Facts PDF cells in the fixture. */
export const PHASE1_USSC_FISCAL_YEARS = [
  2013, 2014, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
] as const;

export const USSC_QUICK_FACTS_DRUG_FIXTURE_FILENAME =
  'ussc-quick-facts-drug-sentencing-fy2013-2023.csv';
