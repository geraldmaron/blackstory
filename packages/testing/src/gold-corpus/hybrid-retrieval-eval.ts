/**
 * Hybrid retrieval evaluation harness.
 *
 * Runs labeled name/misspelling/descriptive/place queries against the domain hybrid pipeline
 * and reports precision/recall/MRR with configurable gates. Fusion weight changes require
 * re-running this eval (see FUSION_WEIGHTS_VERSION in @repo/domain).
 */

export type FusionWeights = {
  readonly structured: number;
  readonly vector: number;
};

export const HYBRID_RETRIEVAL_QUERY_SCHEMA_VERSION = 'hybrid-retrieval-queries.v1' as const;

export type HybridQueryCategory =
  | 'name_lookup'
  | 'alias'
  | 'ocr'
  | 'misspelling'
  | 'descriptive'
  | 'missed_entity'
  | 'place_query'
  | 'relationship'
  | 'path';

export type HybridRetrievalLabeledQuery = {
  readonly id: string;
  readonly text: string;
  readonly category: HybridQueryCategory;
  readonly relevantEntityIds: readonly string[];
  /** Adjudicated confusable result IDs that must not appear in top-k for this query. */
  readonly forbiddenResultIds?: readonly string[];
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
  readonly forbiddenResultCount: number;
  readonly topIds: readonly string[];
};

export type HybridRetrievalCategoryMetrics = {
  readonly queryCount: number;
  readonly meanPrecisionAt5: number;
  readonly meanRecallAt5: number;
  readonly meanReciprocalRank: number;
  readonly forbiddenResultRateAt5: number;
};

export type HybridRetrievalEvalResult = {
  readonly querySetVersion: string;
  readonly fusionWeightsVersion: string;
  readonly fusionWeights: FusionWeights;
  readonly queryCount: number;
  readonly meanPrecisionAt5: number;
  readonly meanRecallAt5: number;
  readonly meanReciprocalRank: number;
  /** Share of queries whose top-k contained an adjudicated confusable/forbidden result. */
  readonly forbiddenResultRateAt5: number;
  readonly byCategory: Readonly<
    Partial<Record<HybridQueryCategory, HybridRetrievalCategoryMetrics>>
  >;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly perQuery: readonly HybridRetrievalQueryResult[];
};

export type HybridRetrievalTopKComparison = {
  readonly meanSourceDocumentTopKOverlapAgainstExactFusion: number | null;
  readonly nonemptyBaselineQueryCount: number;
  readonly emptyBaselineQueryCount: number;
  readonly identicalSourceDocumentTopKRateAfterFusion: number;
};

/** Compares fused source-document results without treating an empty exact baseline as zero recall. */
export function compareHybridRetrievalTopK(
  exact: HybridRetrievalEvalResult,
  approximate: HybridRetrievalEvalResult,
): HybridRetrievalTopKComparison {
  const approximateById = new Map(
    approximate.perQuery.map((result) => [result.queryId, result.topIds]),
  );
  let overlap = 0;
  let nonemptyBaselineQueryCount = 0;
  let emptyBaselineQueryCount = 0;
  let identical = 0;
  for (const result of exact.perQuery) {
    const otherTopIds = approximateById.get(result.queryId) ?? [];
    if (result.topIds.length === 0) {
      emptyBaselineQueryCount += 1;
    } else {
      nonemptyBaselineQueryCount += 1;
      const expected = new Set(result.topIds);
      const hits = otherTopIds.filter((id) => expected.has(id)).length;
      overlap += hits / expected.size;
    }
    if (JSON.stringify(result.topIds) === JSON.stringify(otherTopIds)) identical += 1;
  }
  return {
    meanSourceDocumentTopKOverlapAgainstExactFusion:
      nonemptyBaselineQueryCount === 0 ? null : overlap / nonemptyBaselineQueryCount,
    nonemptyBaselineQueryCount,
    emptyBaselineQueryCount,
    identicalSourceDocumentTopKRateAfterFusion: identical / exact.queryCount,
  };
}

export type HybridRetrievalRunner = (input: {
  readonly normalizedQuery: string;
  readonly filters: readonly { readonly field: 'state' | 'era'; readonly value: string }[];
  readonly limit: number;
}) => Promise<readonly string[]> | readonly string[];

function precisionAtK(
  retrieved: readonly string[],
  relevant: ReadonlySet<string>,
  k: number,
): number {
  const top = retrieved.slice(0, k);
  if (top.length === 0) return 0;
  const hits = top.filter((id) => relevant.has(id)).length;
  return hits / k;
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

type MutableCategoryAccumulator = {
  queryCount: number;
  precision: number;
  recall: number;
  reciprocalRank: number;
  forbiddenResultQueries: number;
};

function buildFilters(
  query: HybridRetrievalLabeledQuery,
): readonly { field: 'state' | 'era'; value: string }[] {
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
  if (!Number.isSafeInteger(k) || k < 1 || k > 1000)
    throw new Error('Retrieval k must be an integer between 1 and 1000');
  if (
    !querySet.queries.length ||
    new Set(querySet.queries.map((q) => q.id)).size !== querySet.queries.length
  )
    throw new Error('Evaluation requires distinct, nonempty labeled queries');
  if (
    querySet.queries.some(
      (q) =>
        !q.text.trim() ||
        !q.relevantEntityIds.length ||
        new Set(q.relevantEntityIds).size !== q.relevantEntityIds.length ||
        new Set(q.forbiddenResultIds ?? []).size !== (q.forbiddenResultIds ?? []).length ||
        (q.forbiddenResultIds ?? []).some((id) => q.relevantEntityIds.includes(id)),
    )
  )
    throw new Error('Every query requires text and distinct relevance labels');
  if (Object.values(thresholds).some((value) => !Number.isFinite(value) || value < 0 || value > 1))
    throw new Error('Evaluation thresholds must be finite values between zero and one');

  const perQuery: HybridRetrievalQueryResult[] = [];
  let precisionSum = 0;
  let recallSum = 0;
  let mrrSum = 0;
  let forbiddenResultQueries = 0;
  const categorySums = new Map<HybridQueryCategory, MutableCategoryAccumulator>();

  for (const query of querySet.queries) {
    const relevant = new Set(query.relevantEntityIds);
    const forbidden = new Set(query.forbiddenResultIds ?? []);
    const normalizedQuery = query.text.trim().toLowerCase();
    const retrieved = await runner({
      normalizedQuery,
      filters: buildFilters(query),
      limit: k,
    });
    const topIds = [...new Set(retrieved)].slice(0, k);

    const pAtK = precisionAtK(topIds, relevant, k);
    const rAtK = recallAtK(topIds, relevant, k);
    const rr = reciprocalRank(topIds, relevant);
    const forbiddenResultCount = topIds.filter((id) => forbidden.has(id)).length;

    precisionSum += pAtK;
    recallSum += rAtK;
    mrrSum += rr;
    if (forbiddenResultCount > 0) forbiddenResultQueries += 1;

    const category = categorySums.get(query.category) ?? {
      queryCount: 0,
      precision: 0,
      recall: 0,
      reciprocalRank: 0,
      forbiddenResultQueries: 0,
    };
    category.queryCount += 1;
    category.precision += pAtK;
    category.recall += rAtK;
    category.reciprocalRank += rr;
    if (forbiddenResultCount > 0) category.forbiddenResultQueries += 1;
    categorySums.set(query.category, category);

    perQuery.push({
      queryId: query.id,
      category: query.category,
      precisionAt5: pAtK,
      recallAt5: rAtK,
      reciprocalRank: rr,
      forbiddenResultCount,
      topIds,
    });
  }

  const queryCount = querySet.queries.length;
  const meanPrecisionAt5 = precisionSum / queryCount;
  const meanRecallAt5 = recallSum / queryCount;
  const meanReciprocalRank = mrrSum / queryCount;
  const forbiddenResultRateAt5 = forbiddenResultQueries / queryCount;
  const byCategory = Object.fromEntries(
    [...categorySums.entries()].map(([category, sums]) => [
      category,
      {
        queryCount: sums.queryCount,
        meanPrecisionAt5: sums.precision / sums.queryCount,
        meanRecallAt5: sums.recall / sums.queryCount,
        meanReciprocalRank: sums.reciprocalRank / sums.queryCount,
        forbiddenResultRateAt5: sums.forbiddenResultQueries / sums.queryCount,
      },
    ]),
  ) as Partial<Record<HybridQueryCategory, HybridRetrievalCategoryMetrics>>;

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
    forbiddenResultRateAt5,
    byCategory,
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
