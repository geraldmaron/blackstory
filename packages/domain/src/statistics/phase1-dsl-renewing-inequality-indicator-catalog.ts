/**
 * Phase 1 DSL Renewing Inequality project-level metric definitions — merge into
 * phase1-indicator-catalog.ts when integrating (rights-gated; Chicago pilot first).
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

/** Urban renewal project metrics pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_DSL_RENEWING_INEQUALITY_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] =
  [
    series({
      metricId: 'ur-nonwhite-families-project',
      metricDefinition:
        'Non-white families counted in urban renewal project area (federal characteristics report)',
      universe: 'families in project area',
      unit: 'families',
      sourceDataset: 'Renewing Inequality non_spatial_data.csv',
      sourceTable: 'non_spatial_data',
      sourceVariable: 'category_id=72',
      geographyType: 'city',
      estimateType: 'count',
      periodType: 'annual',
      theme: 'housing',
      externalDataSourceId: 'dsl-renewing-inequality',
      raceEthnicitySlice: 'nonwhite',
    }),
    series({
      metricId: 'ur-total-families-project',
      metricDefinition: 'Total families counted in urban renewal project area',
      universe: 'families in project area',
      unit: 'families',
      sourceDataset: 'Renewing Inequality non_spatial_data.csv',
      sourceTable: 'non_spatial_data',
      sourceVariable: 'category_id=80',
      geographyType: 'city',
      estimateType: 'count',
      periodType: 'annual',
      theme: 'housing',
      externalDataSourceId: 'dsl-renewing-inequality',
    }),
    series({
      metricId: 'ur-dwelling-units-substandard-project',
      metricDefinition: 'Sub-standard dwelling units in urban renewal project area',
      universe: 'dwelling units in project area',
      unit: 'dwelling_units',
      sourceDataset: 'Renewing Inequality non_spatial_data.csv',
      sourceTable: 'non_spatial_data',
      sourceVariable: 'category_id=69',
      geographyType: 'city',
      estimateType: 'count',
      periodType: 'annual',
      theme: 'housing',
      externalDataSourceId: 'dsl-renewing-inequality',
    }),
  ];
