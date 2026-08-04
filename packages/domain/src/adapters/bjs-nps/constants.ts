/**
 * BJS National Prisoner Statistics Phase 1 ingest constants — published table zip URLs,
 * metric ids, and default reference vintage.
 */

/** Registry homepage — cite on every published observation. */
export const BJS_NPS_HOMEPAGE_URL =
  'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps';

/** Prisoners in 2023 statistical tables zip (Appendix table 1 = p23stat01.csv). */
export const BJS_NPS_P23_TABLES_ZIP_URL = 'https://bjs.ojp.gov/document/p23st.zip';

/** Prisoners in 2022 statistical tables zip (Appendix table 1 = p22stat01.csv). */
export const BJS_NPS_P22_TABLES_ZIP_URL = 'https://bjs.ojp.gov/document/p22st_rev.zip';

/**
 * Prisoners in 2020 statistical tables zip.
 * State race counts live in Appendix table 2 (`p20stat02.csv`), not `p20stat01.csv`
 * (national rate history). Stable sheets mirror: `/content/pub/sheets/p20st.zip`.
 */
export const BJS_NPS_P20_TABLES_ZIP_URL = 'https://bjs.ojp.gov/content/pub/sheets/p20st.zip';

export const PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID = 'imprisonment-rate-black-state';
export const PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID = 'imprisonment-rate-white-state';

export const PHASE1_BJS_NPS_DEFAULT_REFERENCE_YEAR = 2023;

export const PHASE1_BJS_NPS_DATASET_VINTAGE = 'BJS Prisoners in 2023 — NPS Appendix table 1';

/** Appendix table 1 filename inside p23st.zip / p22st_rev.zip. */
export const BJS_NPS_STAT01_FILENAME = 'p23stat01.csv';

/** Appendix table 2 filename inside p20st.zip (state race counts for year-end 2020). */
export const BJS_NPS_P20_STAT02_FILENAME = 'p20stat02.csv';

/** Known local/fixture zip → state race-count CSV pairs for multi-year warehouse rates. */
export const BJS_NPS_STATE_RACE_COUNT_TABLES = [
  {
    referenceYear: 2020,
    zipUrl: BJS_NPS_P20_TABLES_ZIP_URL,
    csvFilename: BJS_NPS_P20_STAT02_FILENAME,
    datasetVintage: 'BJS Prisoners in 2020 — NPS Appendix table 2',
  },
  {
    referenceYear: 2022,
    zipUrl: BJS_NPS_P22_TABLES_ZIP_URL,
    csvFilename: 'p22stat01.csv',
    datasetVintage: 'BJS Prisoners in 2022 — NPS Appendix table 1',
  },
  {
    referenceYear: 2023,
    zipUrl: BJS_NPS_P23_TABLES_ZIP_URL,
    csvFilename: BJS_NPS_STAT01_FILENAME,
    datasetVintage: 'BJS Prisoners in 2023 — NPS Appendix table 1',
  },
] as const;

/** Manual fallback when CSAT/ICPSR export is used instead of zip-derived counts. */
export const BJS_NPS_MANUAL_RATES_DOC =
  'State race-specific imprisonment rates are not exported in BJS CSV table 5/6 (national only). ' +
  'This loader derives per-100k rates from Appendix table 1/2 prisoner counts and Census PEP ' +
  'non-Hispanic race population (BJS methodology). Warehouse rates that reuse a fixed ACS ' +
  'denominator vintage across years must be labeled separately from BJS-published national Table 6 rates. ' +
  'For BJS-published rates, export from https://csat.bjs.ojp.gov/ or ICPSR study 39657 and pass --bjs-stat-csv.';
