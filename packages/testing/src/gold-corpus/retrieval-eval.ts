
/**
 * Retrieval-quality eval over gold corpus, for semantic search (recall@k).
 *
 * Reuses the existing gold corpus (gold-corpus.v1.json, loaded via load.ts) rather than
 * inventing a new fixture. IMPORTANT CAVEAT, stated up front: this corpus was built for
 * classification-style adjudication (relevance/publication/confidence/citation/entity-resolution
 * labels see gate.ts/metrics.ts), not for distinct per-item retrieval. Its 120 examples are
 * 10 near-duplicate "scenario N" variants within each of 12 categories, differing mostly by an
 * incrementing number rather than distinguishing content. A literal per-item recall@k (query
 * text = document text, target = that exact example) would be tautologically 1.0 for any
 * consistent embedding function and would test nothing.
 *
 * To get a meaningful, non-tautological number instead, queries here are synthesized from a
 * *different, coarser* view of each example (subject type + category labels) than the stored
 * document text (the title), and "relevant" is the full set of same-category examples rather
 * than one exact id. recall@k is then the standard IR definition: |topK ∩ relevant| |relevant|,
 * averaged over all queries. This measures whether the embedding pipeline's ranking correctly
 * groups semantically-related records together under a generic query a fair, if modest, proxy
 * for "find what the user means" while being honest that it cannot measure fine-grained
 * scenario-level discrimination given this corpus's shape.
 */
import type { GoldCorpus, GoldCorpusExample } from './types.js';
import { cosineSimilarity, type EvalEmbeddingProvider } from './retrieval-embedding.js';

export type RetrievalEvalDocument = {
  readonly id: string;
  readonly text: string;
  readonly categories: readonly string[];
};

export type RetrievalEvalQuery = {
  readonly id: string;
  readonly text: string;
  readonly relevantIds: ReadonlySet<string>;
};

export function buildRetrievalDocuments(corpus: GoldCorpus): readonly RetrievalEvalDocument[] {
  return corpus.examples.map((example: GoldCorpusExample) => ({
    id: example.id,
    text: example.title,
    categories: example.categories,
  }));
}


/**
 * One query per example, built from subjectType + categories deliberately not the example's
 * title, so the query is a different string than any single stored document (see module doc).
 */
export function buildRetrievalQueries(corpus: GoldCorpus): readonly RetrievalEvalQuery[] {
  const byCategory = new Map<string, string[]>();
  for (const example of corpus.examples) {
    for (const category of example.categories) {
      const ids = byCategory.get(category) ?? [];
      ids.push(example.id);
      byCategory.set(category, ids);
    }
  }

  return corpus.examples.map((example) => {
    const relevantIds = new Set<string>();
    for (const category of example.categories) {
      for (const id of byCategory.get(category) ?? []) relevantIds.add(id);
    }
    return {
      id: example.id,
      text: `${example.subjectType} record about: ${example.categories.join(', ')}`,
      relevantIds,
    };
  });
}

export type RetrievalEvalOptions = {
  readonly kValues?: readonly number[];
};

export type RetrievalEvalResult = {
  readonly corpusVersion: string;
  readonly modelUsed: string;
  readonly documentCount: number;
  readonly queryCount: number;
  readonly kValues: readonly number[];
  /** Mean recall@k across every query, keyed by k (stringified plain objects can't key on number). */
  readonly recallAtK: Readonly<Record<string, number>>;
  readonly meanReciprocalRank: number;
};

const DEFAULT_K_VALUES = [5, 10] as const;


/**
 * Runs the retrieval eval end to end: embeds every document and query with the injected
 * provider, ranks documents per query by cosine similarity, and reports recall@k + MRR.
 * Pass `createDeterministicMockEvalProvider` (retrieval-embedding.ts) for a CI-safe run with
 * no network access, or a real provider (e.g. `@blap/firebase`'s
 * `createGeminiEmbeddingProvider`, wired in by a caller outside this package) for a real number.
 */
export async function runRetrievalEval(
  corpus: GoldCorpus,
  provider: EvalEmbeddingProvider,
  options: RetrievalEvalOptions = {},
): Promise<RetrievalEvalResult> {
  const kValues = options.kValues ?? DEFAULT_K_VALUES;
  const documents = buildRetrievalDocuments(corpus);
  const queries = buildRetrievalQueries(corpus);

  const documentVectors = await provider.embed(documents.map((doc) => doc.text));
  const queryVectors = await provider.embed(queries.map((query) => query.text));

  const recallSums = new Map<number, number>(kValues.map((k) => [k, 0]));
  let reciprocalRankSum = 0;

  queries.forEach((query, queryIndex) => {
    const queryVector = queryVectors[queryIndex]!;
    const ranked = documents
      .map((doc, docIndex) => ({
        id: doc.id,
        similarity: cosineSimilarity(queryVector, documentVectors[docIndex]!),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const firstRelevantRank = ranked.findIndex((entry) => query.relevantIds.has(entry.id));
    if (firstRelevantRank >= 0) {
      reciprocalRankSum += 1 / (firstRelevantRank + 1);
    }

    for (const k of kValues) {
      const topK = ranked.slice(0, k);
      const hits = topK.filter((entry) => query.relevantIds.has(entry.id)).length;
      // Standard recall@k: fraction of ALL relevant documents retrieved within top k. The
      // denominator is fixed at |relevant| (not min(k, |relevant|)) so recall@k is guaranteed
      // monotonically non-decreasing in k, as recall@k should be.
      const denominator = query.relevantIds.size || 1;
      recallSums.set(k, (recallSums.get(k) ?? 0) + hits / denominator);
    }
  });

  const recallAtK: Record<string, number> = {};
  for (const k of kValues) {
    recallAtK[String(k)] = (recallSums.get(k) ?? 0) / queries.length;
  }

  return {
    corpusVersion: corpus.corpusVersion,
    modelUsed: provider.model,
    documentCount: documents.length,
    queryCount: queries.length,
    kValues,
    recallAtK,
    meanReciprocalRank: reciprocalRankSum / queries.length,
  };
}
