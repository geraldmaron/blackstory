/**
 * Phase 1 NHGIS county race population-share metric definitions — merge into
 * phase1-indicator-catalog.ts when integrating (fixture-backed decennial Cook spine).
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

/** NHGIS county population-share metrics pending merge into PHASE1_INDICATOR_CATALOG. */
export const PHASE1_NHGIS_INDICATOR_DEFINITIONS: readonly Phase1IndicatorDefinition[] = [
  series({
    metricId: 'nhgis-black-population-share-county',
    metricDefinition:
      'Share of county residents who are Black (decennial NHGIS / Census county race counts)',
    universe: 'total population',
    unit: 'percent',
    sourceDataset: 'IPUMS NHGIS decennial county race',
    sourceTable: 'nominal time series / STF1–SF1',
    sourceVariable: 'black_count / total_population',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'decennial',
    theme: 'demography',
    externalDataSourceId: 'nhgis-county-race',
    raceEthnicitySlice: 'black',
  }),
  series({
    metricId: 'nhgis-white-population-share-county',
    metricDefinition:
      'Share of county residents who are White (decennial NHGIS / Census county race counts)',
    universe: 'total population',
    unit: 'percent',
    sourceDataset: 'IPUMS NHGIS decennial county race',
    sourceTable: 'nominal time series / STF1–SF1',
    sourceVariable: 'white_count / total_population',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'decennial',
    theme: 'demography',
    externalDataSourceId: 'nhgis-county-race',
    raceEthnicitySlice: 'white',
  }),
  series({
    metricId: 'nhgis-homeownership-rate-black-county',
    metricDefinition:
      'Homeownership rate for Black householder occupied housing units (decennial NHGIS / Census county tenure by race of householder)',
    universe: 'occupied housing units with Black householder',
    unit: 'percent',
    sourceDataset: 'IPUMS NHGIS decennial county tenure by race',
    sourceTable: 'STF1 H9 / SF1 H015B / SF1 HCT1',
    sourceVariable: 'owner_occupied_black / occupied_black',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'decennial',
    theme: 'housing',
    externalDataSourceId: 'nhgis-county-race',
    raceEthnicitySlice: 'black',
  }),
  series({
    metricId: 'nhgis-homeownership-rate-white-county',
    metricDefinition:
      'Homeownership rate for White householder occupied housing units (decennial NHGIS / Census county tenure by race of householder)',
    universe: 'occupied housing units with White householder',
    unit: 'percent',
    sourceDataset: 'IPUMS NHGIS decennial county tenure by race',
    sourceTable: 'STF1 H9 / SF1 H015A / SF1 HCT1',
    sourceVariable: 'owner_occupied_white / occupied_white',
    geographyType: 'county',
    estimateType: 'percentage',
    periodType: 'decennial',
    theme: 'housing',
    externalDataSourceId: 'nhgis-county-race',
    raceEthnicitySlice: 'white',
  }),
];
