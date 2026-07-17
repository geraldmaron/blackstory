/**
 * Hybrid retrieval evaluation harness (BB-072 / BB-047).
 *
 * Runs labeled name/misspelling/descriptive/place queries against the domain hybrid pipeline
 * and reports precision/recall/MRR with configurable gates. Fusion weight changes require
 * re-running this eval (see FUSION_WEIGHTS_VERSION in @black-book/domain).
 */

export type FusionWeights = {
  readonly structured: number;
  readonly vector: number;
};

export const HYBRID_RETRIEVAL_QUERY_SCHEMA_VERSION = 'hybrid-retrieval-queries.v1' as const;

export type HybridQueryCategory = 'name_lookup' | 'misspelling' | 'descriptive' | 'place_query';

export type HybridRetrievalLabeledQuery = {
  readonly id: string;
  readonly text: string;
  readonly category: HybridQueryCategory;
  readonly relevantEntityIds: readonly string[];
  readonly placeAnchored?: boolean;
  readonly stateFilter?: string;
  readonly eraFilter?: string;
};

export type HybridRetrievalQuerySet = {
  readonly schemaVersion: typeof HYBRID_RETRIEVAL_QUERY_SCHEMA_VERSION;
  readonly querySetVersion: string;
  readonly description: string;
  readonly queries: readonly HybridRetrievalLabeledQuery[];
};

export type HybridRetrievalEvalThresholds = {
  readonly minimumPrecisionAt5: number;
  readonly minimumRecallAt5: number;
  readonly minimumMeanReciprocalRank: number;
};

export const DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS: HybridRetrievalEvalThresholds = {
  minimumPrecisionAt5: 0.4,
  minimumRecallAt5: 0.5,
  minimumMeanReciprocalRank: 0.45,
};

export type HybridRetrievalQueryResult = {
  readonly queryId: string;
  readonly category: HybridQueryCategory;
  readonly precisionAt5: number;
  readonly recallAt5: number;
  readonly reciprocalRank: number;
  readonly topIds: readonly string[];
};

export type HybridRetrievalEvalResult = {
  readonly querySetVersion: string;
  readonly fusionWeightsVersion: string;
  readonly fusionWeights: FusionWeights;
  readonly queryCount: number;
  readonly meanPrecisionAt5: number;
  readonly meanRecallAt5: number;
  readonly meanReciprocalRank: number;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly perQuery: readonly HybridRetrievalQueryResult[];
};

export type HybridRetrievalRunner = (input: {
  readonly normalizedQuery: string;
  readonly filters: readonly { readonly field: 'state' | 'era'; readonly value: string }[];
  readonly limit: number;
}) => Promise<readonly string[]> | readonly string[];

function precisionAtK(retrieved: readonly string[], relevant: ReadonlySet<string>, k: number): number {
  const top = retrieved.slice(0, k);
  if (top.length === 0) return 0;
  const hits = top.filter((id) => relevant.has(id)).length;
  return hits / top.length;
}

function recallAtK(retrieved: readonly string[], relevant: ReadonlySet<string>, k: number): number {
  if (relevant.size === 0) return 0;
  const top = retrieved.slice(0, k);
  const hits = top.filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

function reciprocalRank(retrieved: readonly string[], relevant: ReadonlySet<string>): number {
  const index = retrieved.findIndex((id) => relevant.has(id));
  return index >= 0 ? 1 / (index + 1) : 0;
}

function buildFilters(query: HybridRetrievalLabeledQuery): readonly { field: 'state' | 'era'; value: string }[] {
  const filters: { field: 'state' | 'era'; value: string }[] = [];
  if (query.stateFilter) filters.push({ field: 'state', value: query.stateFilter });
  if (query.eraFilter) filters.push({ field: 'era', value: query.eraFilter });
  return filters;
}

/** Evaluates hybrid retrieval quality against a labeled query set. */
export async function runHybridRetrievalEval(
  querySet: HybridRetrievalQuerySet,
  runner: HybridRetrievalRunner,
  options: {
    readonly fusionWeights?: FusionWeights;
    readonly fusionWeightsVersion?: string;
    readonly thresholds?: HybridRetrievalEvalThresholds;
    readonly k?: number;
  } = {},
): Promise<HybridRetrievalEvalResult> {
  const k = options.k ?? 5;
  const thresholds = options.thresholds ?? DEFAULT_HYBRID_RETRIEVAL_THRESHOLDS;
  const fusionWeights = options.fusionWeights ?? { structured: 1, vector: 1 };
  const fusionWeightsVersion = options.fusionWeightsVersion ?? 'hybrid-fusion-weights.v1';

  const perQuery: HybridRetrievalQueryResult[] = [];
  let precisionSum = 0;
  let recallSum = 0;
  let mrrSum = 0;

  for (const query of querySet.queries) {
    const relevant = new Set(query.relevantEntityIds);
    const normalizedQuery = query.text.trim().toLowerCase();
    const topIds = await runner({
      normalizedQuery,
      filters: buildFilters(query),
      limit: k,
    });

    const pAtK = precisionAtK(topIds, relevant, k);
    const rAtK = recallAtK(topIds, relevant, k);
    const rr = reciprocalRank(topIds, relevant);

    precisionSum += pAtK;
    recallSum += rAtK;
    mrrSum += rr;

    perQuery.push({
      queryId: query.id,
      category: query.category,
      precisionAt5: pAtK,
      recallAt5: rAtK,
      reciprocalRank: rr,
      topIds,
    });
  }

  const queryCount = querySet.queries.length;
  const meanPrecisionAt5 = precisionSum / queryCount;
  const meanRecallAt5 = recallSum / queryCount;
  const meanReciprocalRank = mrrSum / queryCount;

  const failures: string[] = [];
  if (meanPrecisionAt5 < thresholds.minimumPrecisionAt5) {
    failures.push(
      `mean precision@${k} ${meanPrecisionAt5.toFixed(3)} below minimum ${thresholds.minimumPrecisionAt5}`,
    );
  }
  if (meanRecallAt5 < thresholds.minimumRecallAt5) {
    failures.push(
      `mean recall@${k} ${meanRecallAt5.toFixed(3)} below minimum ${thresholds.minimumRecallAt5}`,
    );
  }
  if (meanReciprocalRank < thresholds.minimumMeanReciprocalRank) {
    failures.push(
      `MRR ${meanReciprocalRank.toFixed(3)} below minimum ${thresholds.minimumMeanReciprocalRank}`,
    );
  }

  return {
    querySetVersion: querySet.querySetVersion,
    fusionWeightsVersion,
    fusionWeights,
    queryCount,
    meanPrecisionAt5,
    meanRecallAt5,
    meanReciprocalRank,
    passed: failures.length === 0,
    failures,
    perQuery,
  };
}

/** Loads the bundled hybrid retrieval query fixture. */
export async function loadHybridRetrievalQuerySet(): Promise<HybridRetrievalQuerySet> {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = await readFile(join(here, 'fixtures/hybrid-retrieval-queries.v1.json'), 'utf8');
  return JSON.parse(raw) as HybridRetrievalQuerySet;
}
