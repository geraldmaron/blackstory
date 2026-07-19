/**
 * Semantic candidate recall over pre-computed embeddings: "find sources similar to
 * this accepted one." Pure ranking math callers are responsible for supplying the vectors
 * (computed by @repo/firebase's embedding pipeline) and for whatever they do with the
 * ranked result (e.g. surface as corroboration suggestions; this module never mutates state).
 */
import { cosineSimilarity, type EmbeddingVector } from './vector-math.js';

export type RecallCandidate<TPayload = unknown> = {
  readonly id: string;
  readonly vector: EmbeddingVector;
  readonly payload?: TPayload;
};

export type RecallMatch<TPayload = unknown> = {
  readonly id: string;
  readonly similarity: number;
  readonly payload?: TPayload;
};

export type FindSimilarCandidatesOptions = {
  /** Caps how many matches come back mirrors the app-level KNN limit, kept small on purpose. */
  readonly limit?: number;
  /** Cosine-similarity floor; candidates below this are dropped even if they'd fit in `limit`. */
  readonly minSimilarity?: number;
  /** Excludes an id from its own results (e.g. the accepted item's own id). */
  readonly excludeId?: string;
};

const DEFAULT_LIMIT = 10;

/**
 * Ranks `corpus` by cosine similarity to `target`, descending, applying an optional similarity
 * floor and an id exclusion. This is the same ranking shape as the Firestore KNN query path in
 * @repo/firebase, but works entirely in memory over whatever embeddings the caller already
 * has loaded appropriate for research-worker-side recall, not for querying the full index.
 */
export function findSimilarCandidates<TPayload = unknown>(
  target: EmbeddingVector,
  corpus: readonly RecallCandidate<TPayload>[],
  options: FindSimilarCandidatesOptions = {},
): readonly RecallMatch<TPayload>[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('findSimilarCandidates: limit must be a positive integer');
  }

  const scored: RecallMatch<TPayload>[] = [];
  for (const candidate of corpus) {
    if (options.excludeId !== undefined && candidate.id === options.excludeId) continue;
    const similarity = cosineSimilarity(target, candidate.vector);
    if (options.minSimilarity !== undefined && similarity < options.minSimilarity) continue;
    scored.push({
      id: candidate.id,
      similarity,
      ...(candidate.payload !== undefined ? { payload: candidate.payload } : {}),
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}
