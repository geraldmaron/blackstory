/**
 * Snapshot-mode vector lane for hybrid search.
 *
 * Provides an in-memory deterministic vector recall port over the bundled seed index so hybrid
 * fusion can run locally without Firestore `findNearest`. Production wiring swaps this for a
 * server-side vector store call.
 */
import { findSimilarCandidates, type EmbeddingVector } from '@black-book/domain';
import type { PublicSearchIndexDoc, SearchFilter } from '@black-book/domain';

export type VectorLaneInput = {
  readonly normalizedQuery: string;
  readonly filters: readonly SearchFilter[];
  readonly eraBucket?: string;
  readonly limit: number;
};

export type VectorLaneResult = {
  readonly status: 'ok' | 'disabled' | 'unavailable' | 'failed';
  readonly matches: readonly { readonly entityId: string; readonly distance: number }[];
};

/** Deterministic pseudo-embedding from text stable across runs, no network.  */
export function deterministicTextEmbedding(text: string, dims = 16): EmbeddingVector {
  const vector = new Array<number>(dims).fill(0);
  const normalized = text.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    vector[i % dims] = (vector[i % dims] ?? 0) + code / 255;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

export type SnapshotVectorIndexEntry = {
  readonly entityId: string;
  readonly vector: EmbeddingVector;
};

/** Builds deterministic vectors from index display names + summaries.  */
export function buildSnapshotVectorIndex(
  docs: readonly PublicSearchIndexDoc[],
): readonly SnapshotVectorIndexEntry[] {
  return docs.map((doc) => ({
    entityId: doc.id,
    vector: deterministicTextEmbedding(`${doc.displayName}\n${doc.summary ?? ''}\n${doc.topicTags.join(' ')}`),
  }));
}

export type SnapshotVectorLaneOptions = {
  readonly minSimilarity?: number;
  readonly unavailable?: boolean;
};

/**
 * Creates a VectorLaneQueryPort backed by in-memory cosine similarity over snapshot embeddings.
 */
export function createSnapshotVectorLane(
  docs: readonly PublicSearchIndexDoc[],
  options: SnapshotVectorLaneOptions = {},
) {
  const entries = buildSnapshotVectorIndex(docs);
  const corpus = entries.map((entry) => ({ id: entry.entityId, vector: entry.vector }));

  return {
    findNearest(input: VectorLaneInput): VectorLaneResult {
      if (options.unavailable) {
        return { status: 'unavailable', matches: [] };
      }

      const queryVector = deterministicTextEmbedding(input.normalizedQuery);
      const matches = findSimilarCandidates(queryVector, corpus, {
        limit: input.limit,
        minSimilarity: options.minSimilarity ?? 0.05,
      });

      const filtered = matches.filter((match) => {
        const doc = docs.find((d) => d.id === match.id);
        if (!doc) return false;
        if (input.eraBucket && !doc.eraBuckets.includes(input.eraBucket)) return false;
        const stateFilter = input.filters.find((f: SearchFilter) => f.field === 'state')?.value;
        if (stateFilter && doc.jurisdictionState !== stateFilter) return false;
        const kindFilter = input.filters.find((f: SearchFilter) => f.field === 'kind')?.value;
        if (kindFilter && doc.kind !== kindFilter) return false;
        return true;
      });

      return {
        status: 'ok',
        matches: filtered.map((match) => ({
          entityId: match.id,
          distance: match.similarity,
        })),
      };
    },
  };
}
