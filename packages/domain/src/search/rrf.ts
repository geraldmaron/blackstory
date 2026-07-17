/**
 * Reciprocal rank fusion (RRF) for hybrid search (BB-072).
 *
 * Merges multiple deterministic ranked lanes into one id-ordered list without a learned ranker.
 * RRF scores are internal ordering keys only — they are never surfaced in public payloads.
 */
export type RrfRankedItem = {
  readonly id: string;
};

export type RrfLaneContribution = {
  readonly laneId: string;
  /** Per-lane weight; changes require re-running the BB-047 hybrid eval (see fusion.ts). */
  readonly weight: number;
  readonly items: readonly RrfRankedItem[];
};

export type RrfConfig = {
  /** Standard RRF smoothing constant (default 60). */
  readonly k: number;
};

export const DEFAULT_RRF_K = 60;

export type RrfFusedEntry = {
  readonly id: string;
  /** Internal fusion score — never exposed publicly. */
  readonly fusionScore: number;
};

/**
 * Computes RRF scores and returns ids sorted by descending fusion score, then id ascending for
 * deterministic ties. Equal inputs always yield equal outputs.
 */
export function reciprocalRankFusion(
  lanes: readonly RrfLaneContribution[],
  config: RrfConfig = { k: DEFAULT_RRF_K },
): readonly RrfFusedEntry[] {
  const k = config.k;
  if (!Number.isFinite(k) || k < 1) {
    throw new RangeError('reciprocalRankFusion: k must be a finite number >= 1');
  }

  const scores = new Map<string, number>();

  for (const lane of lanes) {
    if (lane.weight <= 0) continue;
    lane.items.forEach((item, index) => {
      const rank = index + 1;
      const increment = lane.weight / (k + rank);
      scores.set(item.id, (scores.get(item.id) ?? 0) + increment);
    });
  }

  const fused: RrfFusedEntry[] = [];
  for (const [id, fusionScore] of scores) {
    fused.push({ id, fusionScore });
  }

  fused.sort((a, b) => {
    if (a.fusionScore !== b.fusionScore) return b.fusionScore - a.fusionScore;
    return a.id.localeCompare(b.id);
  });

  return fused;
}
