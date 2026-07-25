/**
 * Phase 1 national homeownership rate by race metric definitions — decennial 1900-2000
 * and ACS 1-Year 2005-2024. Merge into phase1-indicator-catalog.ts when integrating
 * (fixture-backed historical spine for national 30-point Black-White homeownership gap).
 */
import type { Phase1IndicatorDefinition } from './phase1-indicator-catalog.js';
import { asMetricId } from './types.js';

function series(
  partial: Omit<Phase1IndicatorDefinition, 'metricId'> & { readonly metricId: string },
): Phase1IndicatorDefinition {
  return {
    ...partial,
    metricId: asMetricId(partial.metricId),
  };
}

/** Phase 1 national homeownership rate indicators pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_NATIONAL_HOMEOWNERSHIP_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] =
  [
    series({
      metricId: 'census-decennial-homeownership-black-nation',
      metricDefinition: 'Homeownership rate for Black householders (decennial Census historical tables)',
      universe: 'occupied housing units with Black householder',
      unit: 'percent',
      sourceDataset: 'Census Bureau Historical Census of Housing Tables',
      sourceTable: 'Homeownership by Race and Hispanic Origin',
      sourceVariable: 'homeowner_occupied_black / occupied_black',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'decennial',
      theme: 'housing',
      externalDataSourceId: 'census-historical-housing-tables',
      raceEthnicitySlice: 'black',
    }),
    series({
      metricId: 'census-decennial-homeownership-white-nh-nation',
      metricDefinition: 'Homeownership rate for White Non-Hispanic householders (decennial Census historical tables)',
      universe: 'occupied housing units with White Non-Hispanic householder',
      unit: 'percent',
      sourceDataset: 'Census Bureau Historical Census of Housing Tables',
      sourceTable: 'Homeownership by Race and Hispanic Origin',
      sourceVariable: 'homeowner_occupied_white / occupied_white',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'decennial',
      theme: 'housing',
      externalDataSourceId: 'census-historical-housing-tables',
      raceEthnicitySlice: 'white_nh',
    }),
    series({
      metricId: 'acs-homeownership-rate-black-nation',
      metricDefinition: 'Homeownership rate for Black or African American alone householders (ACS 1-Year)',
      universe: 'occupied housing units',
      unit: 'percent',
      sourceDataset: 'ACS 1-Year Detailed Tables',
      sourceTable: 'B25003B',
      sourceVariable: 'derived',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'annual',
      theme: 'housing',
      externalDataSourceId: 'acs-census-api',
      raceEthnicitySlice: 'black',
    }),
    series({
      metricId: 'acs-homeownership-rate-white-nh-nation',
      metricDefinition: 'Homeownership rate for White alone Non-Hispanic householders (ACS 1-Year)',
      universe: 'occupied housing units',
      unit: 'percent',
      sourceDataset: 'ACS 1-Year Detailed Tables',
      sourceTable: 'B25003H',
      sourceVariable: 'derived',
      geographyType: 'nation',
      estimateType: 'percentage',
      periodType: 'annual',
      theme: 'housing',
      externalDataSourceId: 'acs-census-api',
      raceEthnicitySlice: 'white_nh',
    }),
  ];
