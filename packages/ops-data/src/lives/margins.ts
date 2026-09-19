/**
 * Standard errors and 90% margins for tabulated Lives cells.
 *
 * ACS files carry 80 replicate weights, and the Census Bureau's successive difference
 * replication formula applies: SE = sqrt(4/80 × Σ(replicate − full)²). Older samples have no
 * replicate weights, so their variance comes from a household-cluster bootstrap with a fixed
 * seed, which makes every rerun reproduce the same margins.
 */

export const Z_90 = 1.645;
export const ACS_REPLICATE_COUNT = 80;

export function moe90(standardError: number): number {
  return Z_90 * standardError;
}

export function acsReplicateStandardError(
  fullSampleEstimate: number,
  replicateEstimates: readonly number[],
): number {
  if (replicateEstimates.length !== ACS_REPLICATE_COUNT) {
    throw new Error(
      `ACS replicate variance needs ${ACS_REPLICATE_COUNT} replicates, got ${replicateEstimates.length}`,
    );
  }
  const sumSquares = replicateEstimates.reduce(
    (sum, replicate) => sum + (replicate - fullSampleEstimate) ** 2,
    0,
  );
  return Math.sqrt((4 / ACS_REPLICATE_COUNT) * sumSquares);
}

/** Sample standard deviation of bootstrap replicate estimates. */
export function bootstrapStandardError(replicateEstimates: readonly number[]): number {
  const finite = replicateEstimates.filter(Number.isFinite);
  if (finite.length < 2) {
    throw new Error('bootstrap standard error needs at least two finite replicates');
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance =
    finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finite.length - 1);
  return Math.sqrt(variance);
}

/** Deterministic uniform [0, 1) generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Resamples whole households (clusters) with replacement and computes the statistic on each
 * replicate. People in one household share a sampling fate, so resampling persons
 * independently would understate the variance.
 */
export function clusterBootstrapReplicates<Cluster>(
  clusters: readonly Cluster[],
  statistic: (sample: readonly Cluster[]) => number,
  options: { readonly replicates: number; readonly seed: number },
): number[] {
  if (clusters.length === 0) throw new Error('cluster bootstrap needs at least one cluster');
  const random = seededRandom(options.seed);
  const estimates: number[] = [];
  for (let r = 0; r < options.replicates; r++) {
    const sample: Cluster[] = new Array(clusters.length);
    for (let i = 0; i < clusters.length; i++) {
      sample[i] = clusters[Math.floor(random() * clusters.length)]!;
    }
    estimates.push(statistic(sample));
  }
  return estimates;
}
