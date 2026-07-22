/**
 * Eviction Lab Phase 1 ingest constants — analysis CSV URLs, attribution, bounded defaults.
 * Source: Eviction Lab data-for-analysis county proprietary valid file (court-observed filings).
 */

/** Registry homepage — cite on every published observation. */
export const EVICTION_LAB_HOMEPAGE_URL = 'https://evictionlab.org/';

/** Documented analysis download index (provenance sourceUrl). */
export const EVICTION_LAB_DATA_FOR_ANALYSIS_URL =
  'https://data-downloads.evictionlab.org/#data-for-analysis/';

/** Direct S3 object for county proprietary valid 2000–2018 (preferred analysis CSV). */
export const EVICTION_LAB_COUNTY_PROPRIETARY_VALID_CSV_URL =
  'https://eviction-lab-data-downloads.s3.amazonaws.com/data-for-analysis/county_proprietary_valid_2000_2018.csv';

export const PHASE1_EVICTION_FILING_RATE_METRIC_ID = 'eviction-filing-rate-county';

export const PHASE1_EVICTION_DATASET_VINTAGE =
  'Eviction Lab county proprietary valid 2000–2018';

/** ODC-BY 1.0 — required attribution text for stored observations. */
export const EVICTION_LAB_ATTRIBUTION_NOTE =
  'Eviction Lab (Princeton University). Data shared under Open Data Commons Attribution License (ODC-BY 1.0).';

/**
 * Default bounded county pull: Georgia + Maryland (matches Phase 1 fixture jurisdictions).
 * Only court-observed rows are ingested — partial coverage by design (BB-051).
 */
export const PHASE1_EVICTION_DEFAULT_COUNTY_STATE_FIPS = ['13', '24'] as const;
