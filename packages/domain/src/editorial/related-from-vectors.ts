/**
 * Editorial related-entity suggestions from in-memory embedding vectors via semantic recall.
 */
import { findSimilarCandidates, type EmbeddingVector } from '../similarity/index.js';

export type VectorCorpusEntry = {
  readonly id: string;
  readonly vector: EmbeddingVector;
  readonly displayName?: string;
};

export type SuggestRelatedEntitiesInput = {
  readonly targetVector: EmbeddingVector;
  readonly corpus: readonly VectorCorpusEntry[];
  readonly limit?: number;
  readonly minSimilarity?: number;
  readonly excludeId?: string;
};

export type RelatedEntitySuggestion = {
  readonly entityId: string;
  readonly similarity: number;
  readonly displayName?: string;
};

/** Wraps cosine-similarity recall for editorial “related entity” pickers. */
export function suggestRelatedEntitiesFromVectors(
  input: SuggestRelatedEntitiesInput,
): readonly RelatedEntitySuggestion[] {
  const recallOptions = {
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.minSimilarity !== undefined ? { minSimilarity: input.minSimilarity } : {}),
    ...(input.excludeId !== undefined ? { excludeId: input.excludeId } : {}),
  };

  const matches = findSimilarCandidates(
    input.targetVector,
    input.corpus.map((entry) => ({
      id: entry.id,
      vector: entry.vector,
      ...(entry.displayName !== undefined ? { payload: { displayName: entry.displayName } } : {}),
    })),
    recallOptions,
  );

  return matches.map((match) => ({
    entityId: match.id,
    similarity: match.similarity,
    ...(match.payload?.displayName !== undefined ? { displayName: match.payload.displayName } : {}),
  }));
}
