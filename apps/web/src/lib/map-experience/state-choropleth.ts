/**
 * Builds per-state choropleth tiers for Explore population layer modes by joining the
 * compact state population index to 2-digit FIPS keys on state GeoJSON properties.
 */
import {
  blackPopulationChange,
  blackSharePercent,
  bucketBlackChangeTier,
  bucketBlackShareTier,
  type BlackChangeTier,
  type BlackShareTier,
} from '@repo/domain/map/county-population';
import { US_STATES } from '@repo/domain/map/geography';
import {
  readStatePopulation,
  type StatePopulationIndex,
} from '@repo/domain/map/state-population';
import type { ExploreLayerMode } from './url-state';

export type StateChoroplethLevel = {
  readonly stateFips: string;
  readonly shareTier: BlackShareTier | 'unknown';
  readonly changeTier: BlackChangeTier | 'unknown';
  readonly sharePercent?: number;
  readonly shareDeltaPp?: number;
};

export type BuildStateChoroplethLevelsInput = {
  readonly index: StatePopulationIndex | undefined;
  readonly mode: Extract<ExploreLayerMode, 'blackShare' | 'blackChange'>;
  readonly decade?: string;
  readonly fromDecade?: string;
  readonly toDecade?: string;
  /** When set, only these FIPS are computed (tests/dev fixtures). */
  readonly stateFipsList?: readonly string[];
};

function allStateFipsKeys(
  index: StatePopulationIndex | undefined,
  stateFipsList?: readonly string[],
): readonly string[] {
  if (stateFipsList && stateFipsList.length > 0) return stateFipsList;
  if (index) return Object.keys(index.states);
  return US_STATES.map((state) => state.fips);
}

export function buildStateChoroplethLevels(
  input: BuildStateChoroplethLevelsInput,
): readonly StateChoroplethLevel[] {
  const keys = allStateFipsKeys(input.index, input.stateFipsList);
  if (keys.length === 0) return [];

  if (input.mode === 'blackShare') {
    const decade = input.decade ?? '2020';
    return keys.map((stateFips) => {
      const record = readStatePopulation(input.index, stateFips, decade);
      const sharePercent = blackSharePercent(record);
      return {
        stateFips: stateFips.padStart(2, '0'),
        shareTier: bucketBlackShareTier(sharePercent),
        changeTier: 'unknown' as const,
        ...(sharePercent !== undefined ? { sharePercent } : {}),
      };
    });
  }

  const fromDecade = input.fromDecade ?? '2010';
  const toDecade = input.toDecade ?? '2020';
  return keys.map((stateFips) => {
    const padded = stateFips.padStart(2, '0');
    const fromRecord = readStatePopulation(input.index, padded, fromDecade);
    const toRecord = readStatePopulation(input.index, padded, toDecade);
    const { shareDeltaPp } = blackPopulationChange(fromRecord, toRecord);
    return {
      stateFips: padded,
      shareTier: 'unknown' as const,
      changeTier: bucketBlackChangeTier(shareDeltaPp),
      ...(shareDeltaPp !== undefined ? { shareDeltaPp } : {}),
    };
  });
}
