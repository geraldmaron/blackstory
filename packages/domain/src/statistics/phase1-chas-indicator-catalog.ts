/**
 * Phase 1 HUD CHAS county cost-burden-by-race metric definitions — merge into
 * phase1-indicator-catalog.ts (Table 9, Cook 17031 fixture spine).
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

/** HUD CHAS Table 9 county cost-burden metrics pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_CHAS_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] = [
  series({
    metricId: 'hud-chas-cost-burden-black-county',
    metricDefinition:
      'Share of occupied households with HUD CHAS cost burden greater than 30% of income (Black alone NH householder, county)',
    universe:
      'occupied households (owners and renters); householder Black alone, not Hispanic or Latino',
    unit: 'percent',
    sourceDataset: 'HUD Comprehensive Housing Affordability Strategy (CHAS)',
    sourceTable: 'Table9',
    sourceVariable: 'cost_burden_gt30_households / total_households',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'housing',
    externalDataSourceId: 'hud-chas',
    raceEthnicitySlice: 'black_nonhispanic',
  }),
  series({
    metricId: 'hud-chas-cost-burden-white-county',
    metricDefinition:
      'Share of occupied households with HUD CHAS cost burden greater than 30% of income (White alone NH householder, county)',
    universe:
      'occupied households (owners and renters); householder White alone, not Hispanic or Latino',
    unit: 'percent',
    sourceDataset: 'HUD Comprehensive Housing Affordability Strategy (CHAS)',
    sourceTable: 'Table9',
    sourceVariable: 'cost_burden_gt30_households / total_households',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: '5-year-estimate',
    theme: 'housing',
    externalDataSourceId: 'hud-chas',
    raceEthnicitySlice: 'white_nonhispanic',
  }),
];

export function listPhase1ChasIndicators(): readonly Phase1IndicatorDefinition[] {
  return PHASE1_CHAS_INDICATOR_DEFINITIONS;
}
