/**
 * BJS National Prisoner Statistics Phase 1 ingest constants — published table zip URLs,
 * metric ids, and default reference vintage.
 */

/** Registry homepage — cite on every published observation. */
export const BJS_NPS_HOMEPAGE_URL = 'https://bjs.ojp.gov/data-collection/national-prisoner-statistics-nps';

/** Prisoners in 2023 statistical tables zip (Appendix table 1 = p23stat01.csv). */
export const BJS_NPS_P23_TABLES_ZIP_URL = 'https://bjs.ojp.gov/document/p23st.zip';

/** Prisoners in 2022 statistical tables zip (Appendix table 1 = p22stat01.csv). */
export const BJS_NPS_P22_TABLES_ZIP_URL = 'https://bjs.ojp.gov/document/p22st_rev.zip';

export const PHASE1_IMPRISONMENT_RATE_BLACK_STATE_METRIC_ID = 'imprisonment-rate-black-state';
export const PHASE1_IMPRISONMENT_RATE_WHITE_STATE_METRIC_ID = 'imprisonment-rate-white-state';

export const PHASE1_BJS_NPS_DEFAULT_REFERENCE_YEAR = 2023;

export const PHASE1_BJS_NPS_DATASET_VINTAGE = 'BJS Prisoners in 2023 — NPS Appendix table 1';

/** Appendix table 1 filename inside p23st.zip / p22st_rev.zip. */
export const BJS_NPS_STAT01_FILENAME = 'p23stat01.csv';

/** Manual fallback when CSAT/ICPSR export is used instead of zip-derived counts. */
export const BJS_NPS_MANUAL_RATES_DOC =
  'State race-specific imprisonment rates are not exported in BJS CSV table 5/6 (national only). ' +
  'This loader derives per-100k rates from Appendix table 1 prisoner counts and Census PEP ' +
  'non-Hispanic race population (BJS methodology). For BJS-published rates, export from ' +
  'https://csat.bjs.ojp.gov/ or ICPSR study 39657 and pass --bjs-stat-csv.';
