/**
 * Phase 1 USSC Quick Facts drug sentencing metric definitions — merge into
 * phase1-indicator-catalog.ts when integrating (national FY average sentences only).
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

/** USSC Quick Facts drug metrics pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_USSC_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] = [
  series({
    metricId: 'ussc-average-sentence-months-crack-nation',
    metricDefinition:
      'Average sentence length in months for federal crack cocaine trafficking offenders (USSC Quick Facts)',
    universe: 'individuals sentenced for crack cocaine trafficking',
    unit: 'months',
    sourceDataset: 'USSC Quick Facts',
    sourceTable: 'Crack Cocaine Trafficking Offenses',
    sourceVariable: 'average_sentence_months',
    geographyType: 'nation',
    estimateType: 'mean',
    periodType: 'annual',
    theme: 'justice',
    externalDataSourceId: 'ussc-quick-facts-drug',
  }),
  series({
    metricId: 'ussc-average-sentence-months-powder-nation',
    metricDefinition:
      'Average sentence length in months for federal powder cocaine trafficking offenders (USSC Quick Facts)',
    universe: 'individuals sentenced for powder cocaine trafficking',
    unit: 'months',
    sourceDataset: 'USSC Quick Facts',
    sourceTable: 'Powder Cocaine Trafficking Offenses',
    sourceVariable: 'average_sentence_months',
    geographyType: 'nation',
    estimateType: 'mean',
    periodType: 'annual',
    theme: 'justice',
    externalDataSourceId: 'ussc-quick-facts-drug',
  }),
  series({
    metricId: 'ussc-black-share-crack-offenders-nation',
    metricDefinition:
      'Share of federal crack cocaine trafficking offenders who are Black (USSC Quick Facts)',
    universe: 'individuals sentenced for crack cocaine trafficking',
    unit: 'percent',
    sourceDataset: 'USSC Quick Facts',
    sourceTable: 'Crack Cocaine Trafficking Offenses',
    sourceVariable: 'race_black_share',
    geographyType: 'nation',
    estimateType: 'percentage',
    periodType: 'annual',
    theme: 'justice',
    externalDataSourceId: 'ussc-quick-facts-drug',
    raceEthnicitySlice: 'black',
  }),
];
