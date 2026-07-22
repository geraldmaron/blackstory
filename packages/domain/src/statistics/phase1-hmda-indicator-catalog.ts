/**
 * Phase 1 HMDA county denial-rate metric definitions — merge into
 * phase1-indicator-catalog.ts when integrating (aggregate strategy only).
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

/** HMDA county metrics pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_HMDA_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] = [
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
];
