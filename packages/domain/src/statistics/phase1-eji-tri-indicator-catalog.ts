/**
 * Phase 1 CDC EJI + EPA TRI county environmental metrics — merge into
 * phase1-indicator-catalog.ts when integrating. Theme: environment (Q9).
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

/** EJI/TRI county metrics pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_EJI_TRI_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] = [
  series({
    metricId: 'cdc-eji-environmental-burden-score-county',
    metricDefinition:
      'Mean tract-level Environmental Burden Module percentile rank (CDC EJI) rolled up to county',
    universe: 'census tracts within county',
    unit: 'index',
    sourceDataset: 'CDC Environmental Justice Index',
    sourceTable: 'EJI tract download',
    sourceVariable: 'RPL_EBM',
    geographyType: 'county',
    estimateType: 'index',
    periodType: 'annual',
    theme: 'environment',
    externalDataSourceId: 'cdc-eji',
  }),
  series({
    metricId: 'epa-tri-facility-count-county',
    metricDefinition:
      'Count of distinct TRI-reporting facilities in county (EPA Toxics Release Inventory)',
    universe: 'TRI-reporting facilities',
    unit: 'count',
    sourceDataset: 'EPA Toxics Release Inventory',
    sourceTable: 'TRI basic data / facility',
    sourceVariable: 'facility count',
    geographyType: 'county',
    estimateType: 'count',
    periodType: 'annual',
    theme: 'environment',
    externalDataSourceId: 'epa-tri',
  }),
];

export function listPhase1EjiTriIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_EJI_TRI_INDICATOR_DEFINITIONS;
}
