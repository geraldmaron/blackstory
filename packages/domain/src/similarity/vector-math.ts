/**
 * Pure embedding-vector math shared by candidate recall and near-duplicate detection (BB-071).
 *
 * Deliberately duplicated (in miniature) from @black-book/firebase's embeddings/vector-math.ts
 * rather than imported: @black-book/firebase depends on @black-book/domain (not the reverse),
 * and this package's discovery/research logic must stay Firestore-free so it can run inside
 * research workers without pulling in Admin SDK credentials. Both copies assert the same
 * invariant (finite, unit-normalized, equal length) and will be trivial to reconcile if a
 * future bead extracts a shared math-only package.
 */

export type EmbeddingVector = readonly number[];

export class InvalidEmbeddingVectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmbeddingVectorError';
  }
}

/** Raw dot product — for unit-normalized vectors this equals cosine similarity. */
export function dotProduct(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new InvalidEmbeddingVectorError(
      `dotProduct: vector length mismatch (${a.length} vs ${b.length})`,
    );
  }
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    sum += a[index]! * b[index]!;
  }
  return sum;
}

function magnitude(vector: EmbeddingVector): number {
  let sumSquares = 0;
  for (const value of vector) {
    sumSquares += value * value;
  }
  return Math.sqrt(sumSquares);
}

/** General cosine similarity — normalizes internally, so callers need not pre-normalize. */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) {
    throw new InvalidEmbeddingVectorError('cosineSimilarity: cannot compare against a zero vector');
  }
  return dotProduct(a, b) / (magA * magB);
}

export function isUnitVector(vector: EmbeddingVector, epsilon = 1e-3): boolean {
  return Math.abs(magnitude(vector) - 1) <= epsilon;
}
