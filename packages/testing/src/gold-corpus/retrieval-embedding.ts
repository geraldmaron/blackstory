
/**
 * Minimal, dependency-free embedding math + a deterministic mock provider for the retrieval
 * eval in retrieval-eval.ts.
 *
 * This is deliberately NOT imported from @black-book/firebase's real embedding pipeline:
 * docs/research/gold-corpus.md states the gold-corpus harness is local-only under ADR-011
 * ("evaluation does not read or write Firestore and neither CLI applies cloud changes"), and
 * @black-book/firebase pulls in firebase-admin + @google/genai infra this package's harness
 * is intentionally decoupled from. The interface below (`EvalEmbeddingProvider`) is shaped so a
 * caller *outside* this package can still plug in the real
 * `@black-book/firebase`'s `createGeminiEmbeddingProvider` (same `embed(texts)` signature) to
 * get a real recall number see ADR-014 for exactly what that requires (a live
 * `GEMINI_API_KEY`).
 */

export type EvalEmbeddingProvider = {
  readonly model: string;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
};

function stableStringHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function makeSeededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}


/**
 * Deterministic, hash-seeded pseudo-random embedding same algorithm shape as
 * @black-book/firebase's createDeterministicMockEmbeddingProvider, reimplemented locally per
 * this file's no-new-dependency rationale above. NOT semantically meaningful: it is a stable
 * stand-in that exercises the eval's ranking/metric plumbing without network access or an API
 * key. A real recall@k number requires swapping in a real provider see ADR-014.
 */
export function createDeterministicMockEvalProvider(dims = 128): EvalEmbeddingProvider {
  return {
    model: 'mock-deterministic-embedding',
    async embed(texts) {
      return texts.map((text) => {
        const random = makeSeededRandom(stableStringHash(text));
        const vector: number[] = new Array(dims);
        for (let index = 0; index < dims; index += 1) {
          vector[index] = random() * 2 - 1;
        }
        return vector;
      });
    },
  };
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: length mismatch (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    magA += a[index]! * a[index]!;
    magB += b[index]! * b[index]!;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
