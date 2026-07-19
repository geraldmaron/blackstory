/**
 * National decennial population series (twps0056 historical lane, 1790–1990) and the shared
 * national-timeline projection contract used by the snapshot builder and the public UI.
 *
 * Mirrors `census-county-decade.ts` for the county lane, but at national geography and with the
 * historical free/enslaved Black sub-series (1790–1860) the county modern lane does not have.
 * Like the county module, this holds series definitions and transcription/derivation logic —
 * never a population NUMBER (counts come from parsed twps0056 Table 1; see
 * @repo/firebase demographics national loader).
 */
import {
  changeCrossesDefinitionBoundary,
  getPopulationDecadeMeta,
  type PopulationDecade,
} from '../demographics/population-decades.js';
import { computeGrowthRecord, type GrowthRecord } from './combination-rules.js';
import { asMetricId, type StatisticalObservation, type StatisticalSeries } from './types.js';

const NATIONAL_JURISDICTION_ID = 'us';

export const CENSUS_NATIONAL_TOTAL_POPULATION_SERIES: StatisticalSeries = {
  metricId: asMetricId('census-national-total-population-historical'),
  metricDefinition: 'Total resident population of the United States',
  universe: 'total population',
  unit: 'persons',
  sourceDataset: 'U.S. Census Bureau Working Paper 56 (twps0056), Table 1',
  sourceTable: 'Table 1 — United States: Race and Hispanic Origin',
  sourceVariable: 'Total population',
  geographyType: 'nation',
  estimateType: 'count',
  periodType: 'decennial',
};

export const CENSUS_NATIONAL_BLACK_POPULATION_SERIES: StatisticalSeries = {
  metricId: asMetricId('census-national-black-population-historical'),
  // twps0056 harmonizes the historical "Negro"/"colored" enumerations under the label "Black";
  // the period terminology and the pre-2000 measurement regime are documented in the
  // comparability bands, never rewritten here.
  metricDefinition: 'Black population (twps0056-harmonized historical race category)',
  universe: 'total population',
  unit: 'persons',
  sourceDataset: 'U.S. Census Bureau Working Paper 56 (twps0056), Table 1',
  sourceTable: 'Table 1 — United States: Race and Hispanic Origin',
  sourceVariable: 'Black',
  geographyType: 'nation',
  estimateType: 'count',
  periodType: 'decennial',
};

export const CENSUS_NATIONAL_FREE_BLACK_POPULATION_SERIES: StatisticalSeries = {
  metricId: asMetricId('census-national-free-black-population-historical'),
  metricDefinition: 'Free Black population (free colored persons; 1790–1860 only)',
  universe: 'Black population',
  unit: 'persons',
  sourceDataset: 'U.S. Census Bureau Working Paper 56 (twps0056), Table 1',
  sourceTable: 'Table 1 — United States: Race and Hispanic Origin',
  sourceVariable: 'Black — Free',
  geographyType: 'nation',
  estimateType: 'count',
  periodType: 'decennial',
};

export const CENSUS_NATIONAL_ENSLAVED_BLACK_POPULATION_SERIES: StatisticalSeries = {
  metricId: asMetricId('census-national-enslaved-black-population-historical'),
  metricDefinition: 'Enslaved Black population (1790–1860 only)',
  universe: 'Black population',
  unit: 'persons',
  sourceDataset: 'U.S. Census Bureau Working Paper 56 (twps0056), Table 1',
  sourceTable: 'Table 1 — United States: Race and Hispanic Origin',
  sourceVariable: 'Black — Slave',
  geographyType: 'nation',
  estimateType: 'count',
  periodType: 'decennial',
};

/**
 * One decade of the twps0056 national table, as parsed. `freeBlackPopulation` and
 * `enslavedBlackPopulation` are present only for 1790–1860 (undefined otherwise — emancipation
 * ended the sub-series). Counts originate from the parsed source; this type never carries one.
 */
export type CensusNationalDecadeObservationInput = {
  readonly decade: PopulationDecade;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  readonly freeBlackPopulation?: number;
  readonly enslavedBlackPopulation?: number;
  readonly source: string;
  readonly contentHash: string;
  readonly retrievedAt: string;
};

const TWPS0056_DATASET_VINTAGE = 'Census Working Paper 56, Table 1 (1790–1990)';

/** Transcribes one national-decade record into observed statistical readings (one per measure). */
export function censusNationalDecadeToObservations(
  doc: CensusNationalDecadeObservationInput,
): StatisticalObservation[] {
  const shared = {
    jurisdictionId: NATIONAL_JURISDICTION_ID,
    // National extent is decade-specific (territorial expansion) — record the vintage explicitly
    // rather than implying one fixed "United States" polygon across 200 years.
    boundaryVersion: `nation-${doc.decade}`,
    referencePeriod: doc.decade,
    datasetVintage: TWPS0056_DATASET_VINTAGE,
    retrievedAt: doc.retrievedAt,
    status: 'observed' as const,
    sourceItemId: doc.contentHash || doc.source,
  };

  const observations: StatisticalObservation[] = [
    {
      ...shared,
      seriesId: CENSUS_NATIONAL_TOTAL_POPULATION_SERIES.metricId,
      estimate: doc.totalPopulation,
    },
    {
      ...shared,
      seriesId: CENSUS_NATIONAL_BLACK_POPULATION_SERIES.metricId,
      estimate: doc.blackPopulation,
    },
  ];
  if (doc.freeBlackPopulation !== undefined) {
    observations.push({
      ...shared,
      seriesId: CENSUS_NATIONAL_FREE_BLACK_POPULATION_SERIES.metricId,
      estimate: doc.freeBlackPopulation,
    });
  }
  if (doc.enslavedBlackPopulation !== undefined) {
    observations.push({
      ...shared,
      seriesId: CENSUS_NATIONAL_ENSLAVED_BLACK_POPULATION_SERIES.metricId,
      estimate: doc.enslavedBlackPopulation,
    });
  }
  return observations;
}

/**
 * When a decade carries a free/enslaved split, free + enslaved must reconstitute the Black
 * total. twps0056 rounds each column independently, so allow a small tolerance rather than
 * demanding exact equality. Returns `null` when there is nothing to check (no split), otherwise
 * the signed discrepancy `(free + enslaved) - total`.
 */
export function freeEnslavedTotalDiscrepancy(input: {
  readonly blackPopulation: number;
  readonly freeBlackPopulation?: number;
  readonly enslavedBlackPopulation?: number;
}): number | null {
  if (input.freeBlackPopulation === undefined || input.enslavedBlackPopulation === undefined) {
    return null;
  }
  return input.freeBlackPopulation + input.enslavedBlackPopulation - input.blackPopulation;
}

/** One row of the merged 1790–2020 national timeline — the public projection contract. */
export type NationalPopulationTimelineRow = {
  readonly decade: PopulationDecade;
  readonly year: number;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  /** Present only for 1790–1860. */
  readonly freeBlackPopulation: number | null;
  readonly enslavedBlackPopulation: number | null;
  /** Deterministic derived share: blackPopulation / totalPopulation * 100, or null if total is 0. */
  readonly blackShareOfTotalPct: number | null;
  /** Census race category label as documented for the decade's band — never a modern rewrite. */
  readonly raceCategoryLabel: string;
  /** 'twps0056' (1790–1990) or 'census-county-sum' (2000–2020). */
  readonly nationalSource: string;
  /** External-source registry id backing this row. */
  readonly sourceId: string;
  /** Human-facing citation URL (working-paper / dataset page), never a raw machine endpoint. */
  readonly sourceUrl: string;
  /** True when this decade opens a measurement-regime boundary (2000). */
  readonly opensDefinitionBoundary: boolean;
  /** True for 1870 (documented Southern undercount). */
  readonly southernUndercountCaveat: boolean;
  readonly hasFreeEnslavedSplit: boolean;
};

/** Deterministic Black share of total, guarding a zero denominator. */
export function blackShareOfTotalPct(
  blackPopulation: number,
  totalPopulation: number,
): number | null {
  if (totalPopulation === 0) return null;
  return (blackPopulation / totalPopulation) * 100;
}

/** An adjacent-decade change in the national Black total, annotated for comparability. */
export type NationalPopulationChange = {
  readonly fromDecade: PopulationDecade;
  readonly toDecade: PopulationDecade;
  readonly growth: GrowthRecord;
  /** Share-point change (percentage points), null when either share is unavailable. */
  readonly sharePointChange: number | null;
  /**
   * True when the change crosses a measurement-regime boundary (1990→2000) and must not be
   * presented as a clean comparable delta.
   */
  readonly crossesDefinitionBoundary: boolean;
};

/**
 * Adjacent-decade changes in the national Black total across a sorted timeline. Reuses
 * `computeGrowthRecord` (zero-denominator-safe) and flags the 1990→2000 regime boundary via the
 * decade registry. Rows must already be ascending by year; only truly adjacent decades
 * (exactly 10 years apart) produce a change record, so a gap in the timeline never yields a
 * spurious delta.
 */
export function computeNationalPopulationChanges(
  rows: readonly NationalPopulationTimelineRow[],
): NationalPopulationChange[] {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const changes: NationalPopulationChange[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]!;
    const to = sorted[index]!;
    if (to.year - from.year !== 10) continue;
    const growth = computeGrowthRecord(
      { observationId: `us_${from.decade}_black`, estimate: from.blackPopulation },
      { observationId: `us_${to.decade}_black`, estimate: to.blackPopulation },
    );
    const sharePointChange =
      from.blackShareOfTotalPct === null || to.blackShareOfTotalPct === null
        ? null
        : to.blackShareOfTotalPct - from.blackShareOfTotalPct;
    changes.push({
      fromDecade: from.decade,
      toDecade: to.decade,
      growth,
      sharePointChange,
      crossesDefinitionBoundary: changeCrossesDefinitionBoundary(from.decade, to.decade),
    });
  }
  return changes;
}

/** Guard: every decade referenced in a timeline row must be a registered PopulationDecade. */
export function assertKnownTimelineDecade(decade: string): asserts decade is PopulationDecade {
  if (!getPopulationDecadeMeta(decade)) {
    throw new Error(`Unknown population decade in timeline: ${decade}`);
  }
}
