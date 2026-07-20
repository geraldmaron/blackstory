/**
 * Client-safe county decennial population types and pure helpers for Explore choropleth
 * layers (Black share and decade-over-decade change). Counts come from published Census
 * decennial tables ingested into `censusCountyDecades`; this module never fetches — callers
 * supply a compact index (static JSON or server aggregate).
 */
export const CENSUS_POPULATION_DECADES = ['2000', '2010', '2020'] as const;

export type CensusPopulationDecade = (typeof CENSUS_POPULATION_DECADES)[number];

export type CountyPopulationRecord = {
  readonly totalPopulation: number;
  readonly blackPopulation: number;
};

/** Compact map index: fips5 → decade → counts. Omitted decades mean no published row. */
export type CountyPopulationIndex = {
  readonly vintages: readonly CensusPopulationDecade[];
  readonly counties: Readonly<
    Record<string, Readonly<Partial<Record<CensusPopulationDecade, CountyPopulationRecord>>>>
  >;
};

export function isCensusPopulationDecade(raw: string): raw is CensusPopulationDecade {
  return (CENSUS_POPULATION_DECADES as readonly string[]).includes(raw);
}

/** 5-digit county GEOID from Census state + county FIPS parts. */
export function countyFips5(stateFips: string, countyFips: string): string {
  return `${stateFips.padStart(2, '0')}${countyFips.padStart(3, '0')}`;
}

export function readCountyPopulation(
  index: CountyPopulationIndex | undefined,
  fips5: string,
  decade: CensusPopulationDecade,
): CountyPopulationRecord | undefined {
  if (!index) return undefined;
  return index.counties[fips5]?.[decade];
}

/** Black alone share of total population for one county-decade, in percent points (0–100). */
export function blackSharePercent(record: CountyPopulationRecord | undefined): number | undefined {
  if (!record || record.totalPopulation <= 0) return undefined;
  return (record.blackPopulation / record.totalPopulation) * 100;
}

export type BlackPopulationChange = {
  /** Change in Black share of total population, percentage points (can be negative). */
  readonly shareDeltaPp: number | undefined;
  /** Change in Black population count (can be negative). */
  readonly countDelta: number | undefined;
};

export function blackPopulationChange(
  from: CountyPopulationRecord | undefined,
  to: CountyPopulationRecord | undefined,
): BlackPopulationChange {
  const fromShare = blackSharePercent(from);
  const toShare = blackSharePercent(to);
  const shareDeltaPp =
    fromShare !== undefined && toShare !== undefined ? toShare - fromShare : undefined;
  const countDelta = from && to ? to.blackPopulation - from.blackPopulation : undefined;
  return { shareDeltaPp, countDelta };
}

/** Copper/sand share tiers — presence framing, never deficit or alarm hues. */
export type BlackShareTier = 'trace' | 'low' | 'mid' | 'high' | 'majority';

export function bucketBlackShareTier(sharePercent: number | undefined): BlackShareTier | 'unknown' {
  if (sharePercent === undefined || !Number.isFinite(sharePercent)) return 'unknown';
  if (sharePercent >= 50) return 'majority';
  if (sharePercent >= 25) return 'high';
  if (sharePercent >= 10) return 'mid';
  if (sharePercent >= 2) return 'low';
  return 'trace';
}

/** Bidirectional change tiers: copper family for gain, stone for loss — never red heat. */
export type BlackChangeTier =
  'gainStrong' | 'gainModerate' | 'neutral' | 'lossModerate' | 'lossStrong';

export function bucketBlackChangeTier(
  shareDeltaPp: number | undefined,
): BlackChangeTier | 'unknown' {
  if (shareDeltaPp === undefined || !Number.isFinite(shareDeltaPp)) return 'unknown';
  if (shareDeltaPp >= 5) return 'gainStrong';
  if (shareDeltaPp >= 1) return 'gainModerate';
  if (shareDeltaPp <= -5) return 'lossStrong';
  if (shareDeltaPp <= -1) return 'lossModerate';
  return 'neutral';
}

export const DEFAULT_POPULATION_DECADE: CensusPopulationDecade = '2020';

export const DEFAULT_POPULATION_CHANGE_FROM: CensusPopulationDecade = '2010';

export const DEFAULT_POPULATION_CHANGE_TO: CensusPopulationDecade = '2020';
