/**
 * Vera Incarceration Trends Phase 1 county jail rate constants — GitHub CSV URL,
 * attribution, and bounded defaults.
 */

/** Registry homepage — cite on every published observation. */
export const VERA_INCARCERATION_TRENDS_HOMEPAGE_URL =
  'https://www.vera.org/projects/incarceration-trends';

/** County time-series CSV (GitHub raw). */
export const VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL =
  'https://raw.githubusercontent.com/vera-institute/incarceration-trends/main/incarceration_trends_county.csv';

export const PHASE1_VERA_JAIL_POPULATION_RATE_COUNTY_METRIC_ID =
  'vera-jail-population-rate-county';

export const PHASE1_VERA_DATASET_VINTAGE = 'Vera Incarceration Trends county CSV';

/** Required attribution per Vera license. */
export const VERA_INCARCERATION_ATTRIBUTION_NOTE =
  'Vera Institute of Justice — Incarceration Trends. Use subject to Vera data license; attribution required.';

/**
 * Default bounded county pull: Georgia + Maryland (matches Phase 1 fixture jurisdictions).
 */
export const PHASE1_VERA_DEFAULT_COUNTY_STATE_FIPS = ['13', '24'] as const;

/** CSV column mapped to phase1-indicator-catalog sourceVariable `jail_rate`. */
export const VERA_COUNTY_JAIL_RATE_COLUMN = 'total_jail_pop_rate';
