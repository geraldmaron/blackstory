/**
 * Maps decennial county census population docs into the statistics storage model
 * (`StatisticalObservation`, `GrowthRecord`) and defines the series constants for
 * county-level Black-alone and total population counts.
 */
import { CENSUS_DECENNIAL_VINTAGES } from '../adapters/census-demographics/types.js';
import { computeGrowthRecord, type GrowthRecord } from './combination-rules.js';
import { asMetricId, type StatisticalObservation, type StatisticalSeries } from './types.js';

export const CENSUS_COUNTY_BLACK_POPULATION_SERIES: StatisticalSeries = {
  metricId: asMetricId('census-county-black-population-decennial'),
  metricDefinition: 'Black or African American alone population',
  universe: 'total population',
  unit: 'persons',
  sourceDataset: 'U.S. Decennial Census',
  sourceTable: 'Race',
  sourceVariable: 'Black or African American alone',
  geographyType: 'county',
  estimateType: 'count',
  periodType: 'decennial',
};

export const CENSUS_COUNTY_TOTAL_POPULATION_SERIES: StatisticalSeries = {
  metricId: asMetricId('census-county-total-population-decennial'),
  metricDefinition: 'Total population',
  universe: 'total population',
  unit: 'persons',
  sourceDataset: 'U.S. Decennial Census',
  sourceTable: 'Population',
  sourceVariable: 'Total population',
  geographyType: 'county',
  estimateType: 'count',
  periodType: 'decennial',
};

export const CENSUS_COUNTY_BLACK_POPULATION_SERIES_ID = CENSUS_COUNTY_BLACK_POPULATION_SERIES.metricId;
export const CENSUS_COUNTY_TOTAL_POPULATION_SERIES_ID = CENSUS_COUNTY_TOTAL_POPULATION_SERIES.metricId;

export type CensusCountyDecadeObservationInput = {
  readonly fips5: string;
  readonly decade: '2000' | '2010' | '2020';
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  readonly source: string;
  readonly contentHash: string;
  readonly retrievedAt: string;
};

export type NationalBlackPopulationDecadeRow = {
  readonly decade: '2000' | '2010' | '2020';
  readonly blackPopulation: number;
};

function decennialDatasetVintage(decade: CensusCountyDecadeObservationInput['decade']): string {
  const vintage = CENSUS_DECENNIAL_VINTAGES.find((entry) => entry.decade === decade);
  if (!vintage) {
    throw new Error(`Unknown decennial decade: ${decade}`);
  }
  if (decade === '2020') {
    return '2020 Decennial PL';
  }
  return `${decade} Decennial SF1`;
}

/** Transcribes one county-decade doc into observed Black-alone and total population readings. */
export function censusCountyDecadeToObservations(
  doc: CensusCountyDecadeObservationInput,
): StatisticalObservation[] {
  const boundaryVersion = `county-${doc.decade}`;
  const datasetVintage = decennialDatasetVintage(doc.decade);
  const shared = {
    jurisdictionId: doc.fips5,
    boundaryVersion,
    referencePeriod: doc.decade,
    datasetVintage,
    retrievedAt: doc.retrievedAt,
    status: 'observed' as const,
    sourceItemId: doc.contentHash || doc.source,
  };

  return [
    {
      ...shared,
      seriesId: CENSUS_COUNTY_BLACK_POPULATION_SERIES_ID,
      estimate: doc.blackPopulation,
    },
    {
      ...shared,
      seriesId: CENSUS_COUNTY_TOTAL_POPULATION_SERIES_ID,
      estimate: doc.totalPopulation,
    },
  ];
}

/** Computes adjacent-decade national Black population growth from decennial rollups. */
export function nationalBlackGrowthFromDecades(
  rows: readonly NationalBlackPopulationDecadeRow[],
): GrowthRecord[] {
  const sorted = [...rows].sort((a, b) => Number(a.decade) - Number(b.decade));
  const records: GrowthRecord[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]!;
    const to = sorted[index]!;
    records.push(
      computeGrowthRecord(
        { observationId: `us_${from.decade}_black`, estimate: from.blackPopulation },
        { observationId: `us_${to.decade}_black`, estimate: to.blackPopulation },
      ),
    );
  }
  return records;
}
