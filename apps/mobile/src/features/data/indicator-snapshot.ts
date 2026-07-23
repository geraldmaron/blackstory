/**
 * Verified Phase 1 indicator snapshot for mobile `/data` — values match
 * `DATA_PAGE_INDICATOR_FIXTURE_BUNDLE` in `@repo/domain` statistics (2026-07-22).
 * Bundled because mobile cannot import domain and api-public has no `/v1/data` yet.
 */
import type { DataIndicatorBundle, DataPageModel, Phase1CoverageSummary } from './types';

const FEDERAL_RESERVE_SCF = {
  label: 'Board of Governors of the Federal Reserve System, Survey of Consumer Finances',
  url: 'https://www.federalreserve.gov/econres/scfindex.htm',
} as const;

const BJS_NPS = {
  label: 'Bureau of Justice Statistics, National Prisoner Statistics',
  url: 'https://bjs.ojp.gov/data-collection/nps',
} as const;

const NHGIS = {
  label: 'IPUMS NHGIS / U.S. Census decennial county tables',
  url: 'https://www.nhgis.org/citing-nhgis',
} as const;

const HMDA = {
  label: 'FFIEC Home Mortgage Disclosure Act Data Browser',
  url: 'https://ffiec.cfpb.gov/data-browser/',
} as const;

const HUD_CHAS = {
  label: 'HUD CHAS via Cook County Consolidated Plan Table 20',
  url: 'https://www.cookcountyil.gov/sites/g/files/ywwepo161/files/documents/2025-09/Cook%20County%20Consolidated%20Plan%202025-2029%20September%202025.pdf',
} as const;

const USSC = {
  label: 'United States Sentencing Commission Quick Facts',
  url: 'https://www.ussc.gov/research/quick-facts',
} as const;

/** Same figures web `/data` shows when serving fixtures. */
export const DATA_INDICATOR_FIXTURE_BUNDLE: DataIndicatorBundle = {
  generatedAt: '2026-07-22T00:00:00.000Z',
  servedFrom: 'fixture',
  wealthComparison: {
    id: 'wealth-scf-median-nation',
    title: 'Median family net worth, Black vs White',
    caption:
      'National median family net worth from the Survey of Consumer Finances. Wealth is measured at a point in time, not income, and reflects decades of policy and market context.',
    geographyLabel: 'United States',
    referencePeriod: '2022',
    primary: { label: 'Black families', value: 44_900, unit: 'usd' },
    comparison: { label: 'White non-Hispanic families', value: 285_000, unit: 'usd' },
    ratioLabel: 'White-to-Black wealth ratio',
    ratioValue: 6.3,
    sources: [FEDERAL_RESERVE_SCF],
  },
  imprisonmentComparison: {
    id: 'justice-bjs-imprisonment-md',
    title: 'State imprisonment rate, Black vs White adults',
    caption:
      'Maryland imprisonment rates under state or federal jurisdiction per 100,000 adult residents. Rates are context for policy eras, not proof that any single law caused the gap.',
    geographyLabel: 'Maryland',
    referencePeriod: '2022',
    primary: { label: 'Black adults', value: 912, unit: 'per_100k' },
    comparison: { label: 'White adults', value: 178, unit: 'per_100k' },
    ratioLabel: 'Black-to-White rate ratio',
    ratioValue: 5.1,
    sources: [BJS_NPS],
  },
  cookHomeownership: {
    id: 'housing-nhgis-homeownership-cook',
    title: 'Homeownership by householder race, Cook County',
    caption:
      'Decennial Census county tenure tables: owner-occupied units divided by occupied units for Black alone and White alone householders. Labels changed across decades; values show published counts, not interpolated gaps.',
    geographyLabel: 'Cook County, Illinois',
    unit: 'percent',
    series: [
      { id: 'black', label: 'Black householder' },
      { id: 'white', label: 'White householder' },
    ],
    points: [
      { period: '1990', values: { black: 37.1, white: 63.8 } },
      { period: '2000', values: { black: 42, white: 66.7 } },
      { period: '2010', values: { black: 41.2, white: 67.2 } },
    ],
    sources: [NHGIS],
  },
  hmdaDenialRates: {
    id: 'credit-hmda-denial-cook',
    title: 'Mortgage denial rate by applicant race, Cook County',
    caption:
      'Share of home mortgage applications denied (HMDA actions taken 1–3) for derived-race Black and White applicants. County aggregates, not individual lending decisions.',
    geographyLabel: 'Cook County, Illinois',
    unit: 'percent',
    series: [
      { id: 'black', label: 'Black applicants' },
      { id: 'white', label: 'White applicants' },
    ],
    points: [
      { period: '2022', values: { black: 10.9, white: 6.5 } },
      { period: '2023', values: { black: 11.1, white: 7.2 } },
    ],
    sources: [HMDA],
  },
  federalDrugSentences: {
    id: 'justice-ussc-crack-powder-nation',
    title: 'Federal cocaine trafficking sentences, crack vs powder',
    caption:
      'Average sentence length in months for federal crack and powder cocaine trafficking offenses (USSC Quick Facts). The 100-to-1 powder–crack weight ratio era is history; gaps narrowed but did not vanish overnight.',
    geographyLabel: 'United States (federal)',
    unit: 'months',
    series: [
      { id: 'crack', label: 'Crack cocaine' },
      { id: 'powder', label: 'Powder cocaine' },
    ],
    points: [
      { period: 'FY2016', values: { crack: 79, powder: 70 } },
      { period: 'FY2020', values: { crack: 74, powder: 66 } },
      { period: 'FY2023', values: { crack: 60, powder: 68 } },
    ],
    sources: [USSC],
  },
  costBurdenComparison: {
    id: 'housing-chas-cost-burden-cook',
    title: 'Cost-burdened households, Black vs White',
    caption:
      'Share of occupied households paying more than 30% of income on housing (HUD CHAS Table 20, suburban Cook jurisdiction in the Consolidated Plan). Place-specific affordability context, not a national average.',
    geographyLabel: 'Suburban Cook County, Illinois',
    referencePeriod: '2016–2020 ACS',
    primary: { label: 'Black non-Hispanic householders', value: 44.6, unit: 'percent' },
    comparison: { label: 'White non-Hispanic householders', value: 31.3, unit: 'percent' },
    ratioLabel: 'Black minus White burden gap',
    ratioValue: 13.3,
    sources: [HUD_CHAS],
  },
};

/** Matches `summarizePhase1IndicatorCatalog()` in domain (32 curated metrics). */
export const PHASE1_COVERAGE_SUMMARY: Phase1CoverageSummary = {
  metricCount: 32,
  sampleObservationCount: 0,
  themes: [
    'demography',
    'wealth',
    'housing',
    'education',
    'justice',
    'labor',
    'environment',
  ],
};

export function getDataPageModel(): DataPageModel {
  return {
    indicators: DATA_INDICATOR_FIXTURE_BUNDLE,
    phase1: PHASE1_COVERAGE_SUMMARY,
    censusTimelineAvailable: false,
  };
}
