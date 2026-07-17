/**
 * Hybrid lane fusion configuration and RRF merge (BB-072).
 *
 * Fusion weights are versioned config — any change requires re-running the BB-047 hybrid
 * retrieval eval (see packages/testing/src/gold-corpus/hybrid-retrieval-eval.ts).
 */
import { reciprocalRankFusion, type RrfLaneContribution } from './rrf.js';
import type { RankedRecord } from './ranking.js';
import type { VectorLaneMatch } from './lanes.js';

export type FusionWeights = {
  readonly structured: number;
  readonly vector: number;
};

/** Default equal weighting; bump the version when weights change so eval gates catch drift. */
export const DEFAULT_FUSION_WEIGHTS: FusionWeights = {
  structured: 1,
  vector: 1,
};

export const FUSION_WEIGHTS_VERSION = 'hybrid-fusion-weights.v1' as const;

export type FusionInput = {
  readonly structuredRanked: readonly RankedRecord[];
  readonly vectorMatches: readonly VectorLaneMatch[];
  readonly weights?: FusionWeights;
};

export type FusionOutput = {
  readonly fusedIds: readonly string[];
  readonly weightsVersion: typeof FUSION_WEIGHTS_VERSION;
  readonly weights: FusionWeights;
};

/**
 * Merges structured and vector lane rankings via weighted RRF. Vector matches contribute by
 * entity id only — distances stay internal to the lane and are not passed into fusion.
 */
export function fuseHybridLanes(input: FusionInput): FusionOutput {
  const weights = input.weights ?? DEFAULT_FUSION_WEIGHTS;

  const lanes: RrfLaneContribution[] = [];
  if (weights.structured > 0 && input.structuredRanked.length > 0) {
    lanes.push({
      laneId: 'structured',
      weight: weights.structured,
      items: input.structuredRanked.map((entry) => ({ id: entry.record.id })),
    });
  }
  if (weights.vector > 0 && input.vectorMatches.length > 0) {
    lanes.push({
      laneId: 'vector',
      weight: weights.vector,
      items: input.vectorMatches.map((match) => ({ id: match.entityId })),
    });
  }

  const fused = reciprocalRankFusion(lanes);
  return {
    fusedIds: fused.map((entry) => entry.id),
    weightsVersion: FUSION_WEIGHTS_VERSION,
    weights,
  };
}
