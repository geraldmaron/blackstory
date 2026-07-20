/**
 * Pure vector arithmetic for the embedding pipeline. No I/O, no Firestore every
 * function here is a deterministic, synchronously testable building block for truncation,
 * unit-normalization, and DOT_PRODUCT similarity.
 */
import { EMBEDDING_DIMS, FIRESTORE_VECTOR_DIM_CAP } from './constants.js';

export type EmbeddingVector = readonly number[];

const UNIT_NORM_EPSILON = 1e-3;

export class InvalidEmbeddingVectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmbeddingVectorError';
  }
}

function assertFiniteVector(vector: EmbeddingVector, context: string): void {
  if (vector.length === 0) {
    throw new InvalidEmbeddingVectorError(`${context}: vector must not be empty`);
  }
  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new InvalidEmbeddingVectorError(`${context}: vector contains a non-finite value`);
    }
  }
}

/** Euclidean (L2) magnitude of a vector. */
export function magnitude(vector: EmbeddingVector): number {
  let sumSquares = 0;
  for (const value of vector) {
    sumSquares += value * value;
  }
  return Math.sqrt(sumSquares);
}

/** Scales a vector to unit L2 norm. Throws on the zero vector it has no direction. */
export function normalizeVector(vector: EmbeddingVector): EmbeddingVector {
  assertFiniteVector(vector, 'normalizeVector');
  const norm = magnitude(vector);
  if (norm === 0) {
    throw new InvalidEmbeddingVectorError('normalizeVector: cannot normalize the zero vector');
  }
  return vector.map((value) => value / norm);
}

/**
 * Matryoshka-safe truncation: gemini-embedding-001's representation is trained so that any
 * prefix of the native output is itself a valid (lower-fidelity) embedding. Truncating is
 * therefore just a slice but the slice is no longer unit-norm, so callers must renormalize.
 */
export function truncateVector(
  vector: EmbeddingVector,
  dims: number = EMBEDDING_DIMS,
): EmbeddingVector {
  assertFiniteVector(vector, 'truncateVector');
  if (!Number.isInteger(dims) || dims <= 0) {
    throw new InvalidEmbeddingVectorError('truncateVector: dims must be a positive integer');
  }
  if (dims > FIRESTORE_VECTOR_DIM_CAP) {
    throw new InvalidEmbeddingVectorError(
      `truncateVector: dims ${dims} exceeds the Firestore vector field cap of ${FIRESTORE_VECTOR_DIM_CAP}`,
    );
  }
  if (vector.length < dims) {
    throw new InvalidEmbeddingVectorError(
      `truncateVector: source vector has ${vector.length} dims, fewer than requested ${dims}`,
    );
  }
  return vector.slice(0, dims);
}

/** Truncate to `dims` and renormalize in one step the pipeline's standard prep for storage. */
export function truncateAndNormalize(
  vector: EmbeddingVector,
  dims: number = EMBEDDING_DIMS,
): EmbeddingVector {
  return normalizeVector(truncateVector(vector, dims));
}

/** Raw dot product of two equal-length vectors. */
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

/**
 * DOT_PRODUCT "distance" as Firestore reports it: for unit-normalized vectors this equals
 * cosine similarity, and unlike COSINE/EUCLIDEAN *higher* values mean *more* similar.
 */
export function dotProductDistance(a: EmbeddingVector, b: EmbeddingVector): number {
  return dotProduct(a, b);
}

/** True when a vector's L2 norm is within epsilon of 1 (allows float roundoff). */
export function isUnitVector(
  vector: EmbeddingVector,
  epsilon: number = UNIT_NORM_EPSILON,
): boolean {
  return Math.abs(magnitude(vector) - 1) <= epsilon;
}

/**
 * Asserts the invariant every stored/query vector must satisfy: finite values, the expected
 * dimensionality, and unit norm. Fail-closed callers should never silently store or query
 * with a malformed vector.
 */
export function assertValidEmbeddingVector(
  vector: EmbeddingVector,
  expectedDims: number = EMBEDDING_DIMS,
): void {
  assertFiniteVector(vector, 'assertValidEmbeddingVector');
  if (vector.length !== expectedDims) {
    throw new InvalidEmbeddingVectorError(
      `assertValidEmbeddingVector: expected ${expectedDims} dims, got ${vector.length}`,
    );
  }
  if (!isUnitVector(vector)) {
    throw new InvalidEmbeddingVectorError(
      `assertValidEmbeddingVector: vector is not unit-normalized (magnitude ${magnitude(vector).toFixed(6)})`,
    );
  }
}
