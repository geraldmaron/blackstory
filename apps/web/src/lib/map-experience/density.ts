/**
 * Presence/coverage classification for the national density layer ("presence, not just
 * incidents" the Native Land model). Pure display-tier bucketing over state aggregate
 * counts; never a crime/incident heatmap (see `dignity-style.ts` for the color-only half of the
 * dignity rule this layer must hold to).
 */
import type { MapStateAggregate } from '@repo/domain/map/map-source';

export type DensityTier = 'documented' | 'emerging' | 'concentrated';

export type StateDensityLevel = {
  readonly stateFips: string;
  readonly statePostalCode: string;
  readonly stateName: string;
  readonly count: number;
  readonly tier: DensityTier;
};

/**
 * Nearest-rank tercile index into an ascending array of length `size`.
 */
function quantileIndex(fraction: number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.ceil(fraction * size) - 1));
}

/**
 * Three-tier bucketing by a state's RANK among the observed counts, not by where its count falls
 * in the observed range. Catalog coverage is long-tailed — one state can hold two orders of
 * magnitude more records than another — and cutting that range into equal thirds puts almost
 * every state under the bottom cut, so the layer renders as a ranking of the few largest rather
 * than as national presence. Terciles keep the tiers populated at every scale, so a state with
 * thinner (but real) coverage still reads as present.
 *
 * Every state with ANY presence gets at least `documented` — the point of this layer is
 * "everywhere," not a competitive ranking, so a low (but nonzero) count is never demoted to a
 * "sparse/none" bucket that would read as an absence claim this app cannot actually verify.
 *
 * Equal counts always share a tier: the cuts are compared with `>=` against the count at the
 * tercile rank, so ties never split across a boundary. A single state stays `documented`,
 * because one observation has no rank relative to anything.
 */
export function buildStateDensityLevels(
  stateAggregates: readonly MapStateAggregate[],
): readonly StateDensityLevel[] {
  if (stateAggregates.length === 0) return [];

  const ascending = stateAggregates.map((state) => state.count).sort((a, b) => a - b);
  const single = ascending.length === 1;
  const emergingAt = ascending[quantileIndex(1 / 3, ascending.length)]!;
  const concentratedAt = ascending[quantileIndex(2 / 3, ascending.length)]!;

  return stateAggregates.map((state) => {
    let tier: DensityTier = 'documented';
    if (!single) {
      if (state.count >= concentratedAt) tier = 'concentrated';
      else if (state.count >= emergingAt) tier = 'emerging';
    }
    return {
      stateFips: state.stateFips,
      statePostalCode: state.statePostalCode,
      stateName: state.stateName,
      count: state.count,
      tier,
    };
  });
}
