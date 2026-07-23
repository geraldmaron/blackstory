/**
 * Survey of Consumer Finances (SCF) Phase 1 national wealth ingest constants —
 * published bulletin / FEDS-note table references and metric ids.
 */

/** Registry homepage — cite on every published observation. */
export const SCF_HOMEPAGE_URL = 'https://www.federalreserve.gov/econres/scfindex.htm';

/** FEDS Note accessible table — median net worth by race, 1989–2022 in 2022 dollars. */
export const SCF_FEDS_NOTE_MEDIAN_WEALTH_BY_RACE_URL =
  'https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-accessible-20231018.htm';

export const PHASE1_SCF_MEDIAN_WEALTH_BLACK_NATION_METRIC_ID = 'scf-median-wealth-black-nation';
export const PHASE1_SCF_MEDIAN_WEALTH_WHITE_NATION_METRIC_ID = 'scf-median-wealth-white-nation';

export const PHASE1_SCF_WEALTH_NATION_JURISDICTION_ID = 'nation:US';
export const PHASE1_SCF_WEALTH_BOUNDARY_VERSION = 'nation-2022';

export const PHASE1_SCF_WEALTH_DATASET_VINTAGE =
  'SCF triennial bulletin — median family net worth by race (2022 dollars, public summary tables)';

/** Triennial SCF survey years with published race-stratified median net worth tables. */
export const PHASE1_SCF_WEALTH_TRIENNIAL_YEARS = [
  1989, 1992, 1995, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022,
] as const;

export const SCF_MEDIAN_WEALTH_FIXTURE_FILENAME = 'scf-median-net-worth-by-race-1989-2022.csv';
