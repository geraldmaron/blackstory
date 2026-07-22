/**
 * EPA Toxics Release Inventory (TRI) Phase 1 county facility-count constants — distinct
 * reporting facilities aggregated by county FIPS. Dignity-safe Q9 context; counts reflect
 * regulatory reporting presence, not ambient risk or crime-style heat.
 */

/** Registry homepage — cite on every published observation. */
export const EPA_TRI_HOMEPAGE_URL =
  'https://www.epa.gov/toxics-release-inventory-tri-program';

export const EPA_TRI_BASIC_DATA_URL =
  'https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present';

/** Envirofacts TRI facility slice for Illinois (live optional). */
export const EPA_TRI_IL_FACILITY_API_URL =
  'https://data.epa.gov/efservice/tri_facility/state_abbr/IL/rows/0:99999/JSON';

export const PHASE1_TRI_FACILITY_COUNT_COUNTY_METRIC_ID = 'epa-tri-facility-count-county';

export const PHASE1_TRI_DATASET_VINTAGE = 'EPA TRI basic data — distinct facility count by county';

export const PHASE1_TRI_DEFAULT_REPORTING_YEAR = 2023;

/** Chicago pilot — Cook County plus DuPage and Lake, Illinois. */
export const PHASE1_TRI_DEFAULT_COUNTY_FIPS = ['17031', '17043', '17097'] as const;

export const PHASE1_TRI_DEFAULT_REPORTING_YEARS = [2022, 2023] as const;

/**
 * Aggregate strategy note — facility counts only; never chemical release quantities as heat.
 */
export const EPA_TRI_AGGREGATE_STRATEGY_NOTE =
  'County facility count is the number of distinct TRI-reporting facilities with a ' +
  'state+county FIPS assignment in the reporting year. Counts describe regulatory ' +
  'reporting presence, not ambient toxicity, individual risk, or crime-style burden heat.';

export const EPA_TRI_FIXTURE_FILENAME = 'tri-il-counties-sample.csv';
