/**
 * HMDA Phase 1 county aggregate ingest constants — FFIEC Data Browser aggregations API
 * only (never loan-level rows). Cook County IL pilot defaults to FIPS 17031.
 *
 * API docs: https://ffiec.cfpb.gov/documentation/api/data-browser/
 */

/** Registry homepage — cite on every published observation. */
export const HMDA_DATA_BROWSER_HOMEPAGE_URL = 'https://ffiec.cfpb.gov/data-browser/';

/** Aggregations endpoint base (subset geography or LEI required). */
export const HMDA_DATA_BROWSER_AGGREGATIONS_API_URL =
  'https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations';

/**
 * URL template for county-level race × action_taken aggregates.
 * Substitute {years} (comma-separated) and {countyFips} (5-digit).
 */
export const HMDA_COUNTY_AGGREGATIONS_URL_TEMPLATE =
  `${HMDA_DATA_BROWSER_AGGREGATIONS_API_URL}?years={years}&counties={countyFips}` +
  '&actions_taken=1,2,3&races=White,Black%20or%20African%20American';

/** HMDA action_taken codes included in application-funnel denial-rate denominator. */
export const HMDA_DENIAL_RATE_ACTIONS_TAKEN = ['1', '2', '3'] as const;

export const HMDA_DERIVED_RACE_WHITE = 'White';
export const HMDA_DERIVED_RACE_BLACK = 'Black or African American';

export const PHASE1_HMDA_DENIAL_RATE_BLACK_COUNTY_METRIC_ID = 'hmda-denial-rate-black-county';
export const PHASE1_HMDA_DENIAL_RATE_WHITE_COUNTY_METRIC_ID = 'hmda-denial-rate-white-county';
export const PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_COUNTY_METRIC_ID =
  'hmda-denial-rate-gap-black-white-county';

export const PHASE1_HMDA_DENIAL_RATE_BLACK_NATION_METRIC_ID = 'hmda-denial-rate-black-nation';
export const PHASE1_HMDA_DENIAL_RATE_WHITE_NH_NATION_METRIC_ID = 'hmda-denial-rate-white-nh-nation';
export const PHASE1_HMDA_DENIAL_RATE_GAP_BLACK_WHITE_NH_NATION_METRIC_ID =
  'hmda-denial-rate-gap-black-white-nh-nation';

export const PHASE1_HMDA_DATASET_VINTAGE =
  'FFIEC HMDA Data Browser county aggregations (derived_race; actions 1–3)';

export const PHASE1_HMDA_NATION_DATASET_VINTAGE =
  'FFIEC HMDA Data Browser national aggregations (derived_race; actions 1–3; conventional purchase)';

/** Chicago pilot — Cook County, Illinois. */
export const PHASE1_HMDA_DEFAULT_COUNTY_FIPS = '17031';

/** Recent annual vintages supported by post-2018 derived_race roll-ups. */
export const PHASE1_HMDA_DEFAULT_YEARS = [2018, 2019, 2020, 2021, 2022, 2023] as const;

/** National HMDA years (2018–2024 available; see bead for 2007–2017 status). */
export const PHASE1_HMDA_NATION_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024] as const;

/** Aggregate strategy note stored on observations — no loan-level persistence. */
export const HMDA_AGGREGATE_STRATEGY_NOTE =
  'County denial rates computed from FFIEC Data Browser /view/aggregations counts only; ' +
  'loan-level HMDA rows are never stored in bb_reference.';

export const HMDA_NATION_AGGREGATE_STRATEGY_NOTE =
  'National denial rates computed from FFIEC Data Browser /view/aggregations counts (conventional purchase, ' +
  'first-lien, owner-occupied, 1–4 unit); loan-level HMDA rows are never stored in bb_reference.';
