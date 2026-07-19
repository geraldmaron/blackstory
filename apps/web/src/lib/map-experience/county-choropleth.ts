/**
 * Builds per-county choropleth tiers for Explore population layer modes by joining the
 * compact county population index to 5-digit FIPS keys on county GeoJSON properties.
 */
import {
  blackPopulationChange,
  blackSharePercent,
  bucketBlackChangeTier,
  bucketBlackShareTier,
  countyFips5,
  readCountyPopulation,
  type BlackChangeTier,
  type BlackShareTier,
  type CensusPopulationDecade,
  type CountyPopulationIndex,
} from '@repo/domain/map/county-population';
import type { ExploreLayerMode } from './url-state';

export type CountyChoroplethLevel = {
  readonly fips5: string;
  readonly shareTier: BlackShareTier | 'unknown';
  readonly changeTier: BlackChangeTier | 'unknown';
  readonly sharePercent?: number;
  readonly shareDeltaPp?: number;
};

export type BuildCountyChoroplethLevelsInput = {
  readonly index: CountyPopulationIndex | undefined;
  readonly mode: Extract<ExploreLayerMode, 'blackShare' | 'blackChange'>;
  readonly decade?: CensusPopulationDecade;
  readonly fromDecade?: CensusPopulationDecade;
  readonly toDecade?: CensusPopulationDecade;
  /** When set, only these counties are computed (tests/dev fixtures). */
  readonly fips5List?: readonly string[];
};

function allFips5Keys(
  index: CountyPopulationIndex | undefined,
  fips5List?: readonly string[],
): readonly string[] {
  if (fips5List && fips5List.length > 0) return fips5List;
  if (!index) return [];
  return Object.keys(index.counties);
}

export function buildCountyChoroplethLevels(
  input: BuildCountyChoroplethLevelsInput,
): readonly CountyChoroplethLevel[] {
  const keys = allFips5Keys(input.index, input.fips5List);
  if (keys.length === 0) return [];

  if (input.mode === 'blackShare') {
    const decade = input.decade ?? '2020';
    return keys.map((fips5) => {
      const record = readCountyPopulation(input.index, fips5, decade);
      const sharePercent = blackSharePercent(record);
      return {
        fips5,
        shareTier: bucketBlackShareTier(sharePercent),
        changeTier: 'unknown' as const,
        ...(sharePercent !== undefined ? { sharePercent } : {}),
      };
    });
  }

  const fromDecade = input.fromDecade ?? '2010';
  const toDecade = input.toDecade ?? '2020';
  return keys.map((fips5) => {
    const fromRecord = readCountyPopulation(input.index, fips5, fromDecade);
    const toRecord = readCountyPopulation(input.index, fips5, toDecade);
    const { shareDeltaPp } = blackPopulationChange(fromRecord, toRecord);
    return {
      fips5,
      shareTier: 'unknown' as const,
      changeTier: bucketBlackChangeTier(shareDeltaPp),
      ...(shareDeltaPp !== undefined ? { shareDeltaPp } : {}),
    };
  });
}

/** Join key helper for county GeoJSON features (stateFips + countyFips). */
export function fips5FromCountyProperties(properties: Record<string, unknown>): string {
  const stateFips = String(properties.stateFips ?? '');
  const countyFips = String(properties.countyFips ?? '');
  if (stateFips.length === 0 || countyFips.length === 0) {
    return String(properties.GEOID ?? properties.fips5 ?? '');
  }
  return countyFips5(stateFips, countyFips);
}
