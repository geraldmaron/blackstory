/**
 * Verified national dollar figures for Lives money models (derived income, affordance).
 * Sourced from double-entry transcription fixtures under packages/ops-data/fixtures/lives/
 * transcriptions/. Used so the /lives room can caption CPI restatement before snapshots reload.
 */
import type { LivesObservationInput } from '@repo/domain/statistics/lives';

const TABLE_83_URL =
  'https://www2.census.gov/library/publications/decennial/1970/population-volume-1/1970a_us1-10.pdf';
const TABLE_83_SOURCE = 'U.S. Bureau of the Census, 1970 PC(1)-C1 Table 83, Families median income';
const CENSUS_1930_FAMILIES_URL =
  'https://www.census.gov/library/publications/1933/dec/1930a-vol-06-families.html';
const CENSUS_1930_FAMILIES_SOURCE =
  'U.S. Bureau of the Census, 1930 Census Volume VI Families, median value and monthly rent of nonfarm homes, via IPUMS NHGIS';
const HC1_A_1970_URL =
  'https://www2.census.gov/library/publications/decennial/1970/housing-volume-1/13276827v1p1ch01.pdf';
const HC1_A_1970_SOURCE =
  'U.S. Bureau of the Census, 1970 HC(1)-A United States Summary, Tables 1 and 6, median value and contract rent';

/** 1970 PC(1)-C1 Table 83 and 1960 panel medians; 1970 HC(1)-A rent/value; 1930 families. */
export const LIVES_NATIONAL_DOLLAR_FIXTURES: readonly LivesObservationInput[] = [
  {
    metricId: 'lives-income-median',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'all',
    estimate: 9590,
    source: TABLE_83_SOURCE,
    sourceUrl: TABLE_83_URL,
  },
  {
    metricId: 'lives-income-median',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'white',
    estimate: 9961,
    source: TABLE_83_SOURCE,
    sourceUrl: TABLE_83_URL,
  },
  {
    metricId: 'lives-income-median',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'black',
    estimate: 6067,
    source: TABLE_83_SOURCE,
    sourceUrl: TABLE_83_URL,
  },
  {
    metricId: 'lives-income-median',
    jurisdictionId: 'nation:US',
    referencePeriod: '1960',
    raceEthnicitySlice: 'all',
    estimate: 5660,
    source: TABLE_83_SOURCE,
    sourceUrl: TABLE_83_URL,
  },
  {
    metricId: 'lives-income-median',
    jurisdictionId: 'nation:US',
    referencePeriod: '1960',
    raceEthnicitySlice: 'white',
    estimate: 5893,
    source: TABLE_83_SOURCE,
    sourceUrl: TABLE_83_URL,
  },
  {
    metricId: 'lives-income-median',
    jurisdictionId: 'nation:US',
    referencePeriod: '1960',
    raceEthnicitySlice: 'nonwhite',
    estimate: 3161,
    source: TABLE_83_SOURCE,
    sourceUrl: TABLE_83_URL,
  },
  {
    metricId: 'lives-median-rent',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'all',
    estimate: 89,
    source: HC1_A_1970_SOURCE,
    sourceUrl: HC1_A_1970_URL,
  },
  {
    metricId: 'lives-median-rent',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'black',
    estimate: 71,
    source: HC1_A_1970_SOURCE,
    sourceUrl: HC1_A_1970_URL,
  },
  {
    metricId: 'lives-median-home-value',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'all',
    estimate: 17000,
    source: HC1_A_1970_SOURCE,
    sourceUrl: HC1_A_1970_URL,
  },
  {
    metricId: 'lives-median-home-value',
    jurisdictionId: 'nation:US',
    referencePeriod: '1970',
    raceEthnicitySlice: 'black',
    estimate: 10600,
    source: HC1_A_1970_SOURCE,
    sourceUrl: HC1_A_1970_URL,
  },
  {
    metricId: 'lives-median-rent',
    jurisdictionId: 'nation:US',
    referencePeriod: '1930',
    raceEthnicitySlice: 'black',
    estimate: 13.04,
    source: CENSUS_1930_FAMILIES_SOURCE,
    sourceUrl: CENSUS_1930_FAMILIES_URL,
  },
  {
    metricId: 'lives-median-rent',
    jurisdictionId: 'nation:US',
    referencePeriod: '1930',
    raceEthnicitySlice: 'all',
    estimate: 27.15,
    source: CENSUS_1930_FAMILIES_SOURCE,
    sourceUrl: CENSUS_1930_FAMILIES_URL,
  },
  {
    metricId: 'lives-median-home-value',
    jurisdictionId: 'nation:US',
    referencePeriod: '1930',
    raceEthnicitySlice: 'black',
    estimate: 1341,
    source: CENSUS_1930_FAMILIES_SOURCE,
    sourceUrl: CENSUS_1930_FAMILIES_URL,
  },
  {
    metricId: 'lives-median-home-value',
    jurisdictionId: 'nation:US',
    referencePeriod: '1930',
    raceEthnicitySlice: 'all',
    estimate: 4778,
    source: CENSUS_1930_FAMILIES_SOURCE,
    sourceUrl: CENSUS_1930_FAMILIES_URL,
  },
];
