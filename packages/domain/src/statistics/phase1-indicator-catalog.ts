/**
 * Phase 1 curated indicator catalog — metric definitions for county/state context
 * panels and operator MCP. Registration in EXTERNAL_DATA_SOURCES remains disabled
 * until ingestion beads acquire artifacts; this catalog is the product vocabulary.
 */
import type { StatisticalSeries } from './types.js';
import { asMetricId } from './types.js';

export const PHASE1_INDICATOR_THEMES = [
  'demography',
  'wealth',
  'housing',
  'justice',
  'education',
  'labor',
] as const;

export type Phase1IndicatorTheme = (typeof PHASE1_INDICATOR_THEMES)[number];

export type Phase1IndicatorDefinition = StatisticalSeries & {
  readonly theme: Phase1IndicatorTheme;
  /** Registry id when one exists; ACS may use census adapter family. */
  readonly externalDataSourceId: string;
  readonly raceEthnicitySlice?: string;
};

function series(
  partial: Omit<Phase1IndicatorDefinition, 'metricId'> & { readonly metricId: string },
): Phase1IndicatorDefinition {
  return {
    ...partial,
    metricId: asMetricId(partial.metricId),
  };
}

/** Curated Phase 1 MVP metrics (~15). Expand only with registry + loader beads. */
export const PHASE1_INDICATOR_CATALOG: readonly Phase1IndicatorDefinition[] = [
  series({
    metricId: 'acs-black-population-share-county',
    metricDefinition: 'Share of county residents who are Black or African American alone',
    universe: 'total population',
    unit: 'percent',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'B02001',
    sourceVariable: 'B02001_003E / B02001_001E',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'demography',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'black_alone',
  }),
  series({
    metricId: 'acs-median-hh-income-black-county',
    metricDefinition: 'Median household income for Black or African American alone householders',
    universe: 'households',
    unit: 'USD',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'B19013B',
    sourceVariable: 'B19013B_001E',
    geographyType: 'county',
    estimateType: 'median',
    periodType: '5-year-estimate',
    theme: 'wealth',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'black_alone',
  }),
  series({
    metricId: 'acs-median-hh-income-white-county',
    metricDefinition: 'Median household income for White alone householders',
    universe: 'households',
    unit: 'USD',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'B19013A',
    sourceVariable: 'B19013A_001E',
    geographyType: 'county',
    estimateType: 'median',
    periodType: '5-year-estimate',
    theme: 'wealth',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'white_alone',
  }),
  series({
    metricId: 'acs-poverty-rate-black-county',
    metricDefinition: 'Poverty rate for Black or African American alone population',
    universe: 'population for whom poverty status is determined',
    unit: 'percent',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'B17001B',
    sourceVariable: 'derived',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'wealth',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'black_alone',
  }),
  series({
    metricId: 'acs-homeownership-rate-black-county',
    metricDefinition: 'Homeownership rate for Black or African American alone householders',
    universe: 'occupied housing units',
    unit: 'percent',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'B25003B',
    sourceVariable: 'derived',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'housing',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'black_alone',
  }),
  series({
    metricId: 'acs-ba-attainment-black-county',
    metricDefinition:
      'Share of Black or African American alone adults 25+ with bachelor’s degree or higher',
    universe: 'population 25 years and over',
    unit: 'percent',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'C15002B',
    sourceVariable: 'derived',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'education',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'black_alone',
  }),
  series({
    metricId: 'imprisonment-rate-black-state',
    metricDefinition: 'Imprisonment rate of Black adults under state or federal jurisdiction',
    universe: 'Black adult residents (rate per 100,000)',
    unit: 'per_100k',
    sourceDataset: 'BJS National Prisoner Statistics',
    sourceTable: 'NPS',
    sourceVariable: 'imprisonment_rate_black',
    geographyType: 'state',
    estimateType: 'rate',
    periodType: 'annual',
    theme: 'justice',
    externalDataSourceId: 'bjs-national-prisoner-statistics',
    raceEthnicitySlice: 'black',
  }),
  series({
    metricId: 'imprisonment-rate-white-state',
    metricDefinition: 'Imprisonment rate of White adults under state or federal jurisdiction',
    universe: 'White adult residents (rate per 100,000)',
    unit: 'per_100k',
    sourceDataset: 'BJS National Prisoner Statistics',
    sourceTable: 'NPS',
    sourceVariable: 'imprisonment_rate_white',
    geographyType: 'state',
    estimateType: 'rate',
    periodType: 'annual',
    theme: 'justice',
    externalDataSourceId: 'bjs-national-prisoner-statistics',
    raceEthnicitySlice: 'white',
  }),
  series({
    metricId: 'vera-jail-population-rate-county',
    metricDefinition: 'County jail incarceration rate (Vera Incarceration Trends compiled)',
    universe: 'county residents (rate per 100,000)',
    unit: 'per_100k',
    sourceDataset: 'Vera Incarceration Trends',
    sourceTable: 'county',
    sourceVariable: 'jail_rate',
    geographyType: 'county',
    estimateType: 'rate',
    periodType: 'annual',
    theme: 'justice',
    externalDataSourceId: 'vera-incarceration-trends',
  }),
  series({
    metricId: 'eviction-filing-rate-county',
    metricDefinition: 'Eviction filing rate (Eviction Lab)',
    universe: 'renter households',
    unit: 'percent',
    sourceDataset: 'Eviction Lab',
    sourceTable: 'county',
    sourceVariable: 'filing_rate',
    geographyType: 'county',
    estimateType: 'rate',
    periodType: 'annual',
    theme: 'housing',
    externalDataSourceId: 'eviction-lab',
  }),
  series({
    metricId: 'hmda-denial-rate-black-county',
    metricDefinition:
      'Mortgage application denial rate for Black or African American applicants (HMDA county aggregate)',
    universe: 'home mortgage applications (actions taken 1–3)',
    unit: 'percent',
    sourceDataset: 'FFIEC HMDA Data Browser',
    sourceTable: 'aggregations',
    sourceVariable: 'derived_race denial rate',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'annual',
    theme: 'wealth',
    externalDataSourceId: 'hmda-loan-level',
    raceEthnicitySlice: 'black',
  }),
  series({
    metricId: 'hmda-denial-rate-white-county',
    metricDefinition:
      'Mortgage application denial rate for White applicants (HMDA county aggregate)',
    universe: 'home mortgage applications (actions taken 1–3)',
    unit: 'percent',
    sourceDataset: 'FFIEC HMDA Data Browser',
    sourceTable: 'aggregations',
    sourceVariable: 'derived_race denial rate',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'annual',
    theme: 'wealth',
    externalDataSourceId: 'hmda-loan-level',
    raceEthnicitySlice: 'white',
  }),
  series({
    metricId: 'hmda-denial-rate-gap-black-white-county',
    metricDefinition:
      'Black minus White mortgage application denial rate gap (percentage points, HMDA county aggregate)',
    universe: 'home mortgage applications (actions taken 1–3)',
    unit: 'percentage_points',
    sourceDataset: 'FFIEC HMDA Data Browser',
    sourceTable: 'aggregations',
    sourceVariable: 'derived denial rate gap',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'annual',
    theme: 'wealth',
    externalDataSourceId: 'hmda-loan-level',
  }),
  series({
    metricId: 'scf-median-wealth-black-nation',
    metricDefinition: 'Median family net worth for Black families (SCF)',
    universe: 'families',
    unit: 'USD',
    sourceDataset: 'Survey of Consumer Finances',
    sourceTable: 'SCF bulletin',
    sourceVariable: 'median_net_worth_black',
    geographyType: 'nation',
    estimateType: 'median',
    periodType: 'point-in-time',
    theme: 'wealth',
    externalDataSourceId: 'fed-survey-consumer-finances',
    raceEthnicitySlice: 'black',
  }),
  series({
    metricId: 'scf-median-wealth-white-nation',
    metricDefinition: 'Median family net worth for White non-Hispanic families (SCF)',
    universe: 'families',
    unit: 'USD',
    sourceDataset: 'Survey of Consumer Finances',
    sourceTable: 'SCF bulletin',
    sourceVariable: 'median_net_worth_white_nonhispanic',
    geographyType: 'nation',
    estimateType: 'median',
    periodType: 'point-in-time',
    theme: 'wealth',
    externalDataSourceId: 'fed-survey-consumer-finances',
    raceEthnicitySlice: 'white_nonhispanic',
  }),
  series({
    metricId: 'oa-incarceration-outcome-black-tract',
    metricDefinition:
      'Opportunity Atlas: share of Black children incarcerated on a given day (cohort outcome)',
    universe: 'children in birth cohort (modeled)',
    unit: 'fraction',
    sourceDataset: 'Opportunity Atlas tract outcomes',
    sourceTable: 'tract_outcomes_early',
    sourceVariable: 'jail_black_pooled',
    geographyType: 'tract',
    estimateType: 'percentage',
    periodType: 'custom-range',
    theme: 'justice',
    externalDataSourceId: 'opportunity-atlas-tract-outcomes',
    raceEthnicitySlice: 'black',
  }),
  series({
    metricId: 'acs-unemployment-black-state',
    metricDefinition: 'Unemployment rate for Black or African American alone civilians',
    universe: 'civilian labor force',
    unit: 'percent',
    sourceDataset: 'ACS 5-Year Detailed Tables',
    sourceTable: 'C23002B',
    sourceVariable: 'derived',
    geographyType: 'state',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'labor',
    externalDataSourceId: 'acs-census-api',
    raceEthnicitySlice: 'black_alone',
  }),
  series({
    metricId: 'sipp-median-wealth-black-nation',
    metricDefinition: 'Median household wealth for Black householders (SIPP)',
    universe: 'households',
    unit: 'USD',
    sourceDataset: 'Survey of Income and Program Participation',
    sourceTable: 'SIPP wealth brief',
    sourceVariable: 'median_wealth_black',
    geographyType: 'nation',
    estimateType: 'median',
    periodType: 'point-in-time',
    theme: 'wealth',
    externalDataSourceId: 'census-sipp-wealth',
    raceEthnicitySlice: 'black',
  }),
];

export function getPhase1Indicator(metricId: string): Phase1IndicatorDefinition | undefined {
  return PHASE1_INDICATOR_CATALOG.find((row) => row.metricId === metricId);
}

export function listPhase1IndicatorsByTheme(
  theme: Phase1IndicatorTheme,
): readonly Phase1IndicatorDefinition[] {
  return PHASE1_INDICATOR_CATALOG.filter((row) => row.theme === theme);
}

export type Phase1IndicatorCatalogSummary = {
  readonly metricCount: number;
  readonly themes: readonly Phase1IndicatorTheme[];
  readonly metrics: readonly {
    readonly metricId: string;
    readonly theme: Phase1IndicatorTheme;
    readonly geographyType: string;
    readonly externalDataSourceId: string;
  }[];
};

export function summarizePhase1IndicatorCatalog(): Phase1IndicatorCatalogSummary {
  const themes = [...new Set(PHASE1_INDICATOR_CATALOG.map((row) => row.theme))];
  return {
    metricCount: PHASE1_INDICATOR_CATALOG.length,
    themes,
    metrics: PHASE1_INDICATOR_CATALOG.map((row) => ({
      metricId: row.metricId,
      theme: row.theme,
      geographyType: row.geographyType,
      externalDataSourceId: row.externalDataSourceId,
    })),
  };
}
