/**
 * Presence/coverage classification for the national density layer ("presence, not just
 * incidents" the Native Land model). Pure display-tier bucketing over state aggregate
 * counts; never a crime/incident heatmap (see `dignity-style.ts` for the color-only half of the
 * dignity rule this layer must hold to).
 */
import type { MapStateAggregate } from '@blap/domain/map/map-source';

export type DensityTier = 'documented' | 'emerging' | 'concentrated';

export type StateDensityLevel = {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
  readonly count: number;
  readonly tier: DensityTier;
};

/**
 * Three-tier bucketing over the observed count range (min/max of `stateAggregates`). Every state
 * with ANY presence gets at least `documented` — the point of this layer is "everywhere," not a
 * competitive ranking, so a low (but nonzero) count is never demoted to a "sparse/none" bucket
 * that would read as an absence claim this app cannot actually verify.
 */
export function buildStateDensityLevels(
  stateAggregates: readonly MapStateAggregate[],
): readonly StateDensityLevel[] {
  if (stateAggregates.length === 0) return [];

  const counts = stateAggregates.map((state) => state.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const span = Math.max(1, max - min);

  return stateAggregates.map((state) => {
    const normalized = (state.count - min) / span;
    const tier: DensityTier =
      normalized >= 0.66 ? 'concentrated' : normalized >= 0.33 ? 'emerging' : 'documented';
    return {
      stateFips: state.stateFips,
      statePostalCode: state.statePostalCode,
      stateName: state.stateName,
      count: state.count,
      tier,
    };
  });
}
