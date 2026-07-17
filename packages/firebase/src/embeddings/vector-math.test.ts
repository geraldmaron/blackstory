
/**
 * Tests for pure embedding-vector math.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  InvalidEmbeddingVectorError,
  assertValidEmbeddingVector,
  dotProduct,
  isUnitVector,
  magnitude,
  normalizeVector,
  truncateAndNormalize,
  truncateVector,
} from './vector-math.js';

test('magnitude computes the L2 norm', () => {
  assert.equal(magnitude([3, 4]), 5);
  assert.equal(magnitude([0, 0, 0]), 0);
});

test('normalizeVector scales to unit norm', () => {
  const normalized = normalizeVector([3, 4]);
  assert.ok(Math.abs(magnitude(normalized) - 1) < 1e-9);
  assert.ok(Math.abs(normalized[0]! - 0.6) < 1e-9);
  assert.ok(Math.abs(normalized[1]! - 0.8) < 1e-9);
});

test('normalizeVector throws on the zero vector', () => {
  assert.throws(() => normalizeVector([0, 0, 0]), InvalidEmbeddingVectorError);
});

test('truncateVector slices without renormalizing', () => {
  const truncated = truncateVector([1, 2, 3, 4], 2);
  assert.deepEqual(truncated, [1, 2]);
});

test('truncateVector rejects dims above the Firestore vector cap', () => {
  assert.throws(() => truncateVector(new Array(10).fill(1), 4096), InvalidEmbeddingVectorError);
});

test('truncateVector rejects a source vector shorter than the requested dims', () => {
  assert.throws(() => truncateVector([1, 2], 5), InvalidEmbeddingVectorError);
});

test('truncateAndNormalize produces a unit vector at the requested width', () => {
  const source = Array.from({ length: 3072 }, (_, index) => Math.sin(index + 1));
  const result = truncateAndNormalize(source, 768);
  assert.equal(result.length, 768);
  assert.ok(isUnitVector(result));
});

test('dotProduct matches hand-computed values and throws on length mismatch', () => {
  assert.equal(dotProduct([1, 2, 3], [4, 5, 6]), 32);
  assert.throws(() => dotProduct([1], [1, 2]), InvalidEmbeddingVectorError);
});

test('assertValidEmbeddingVector accepts a well-formed vector and rejects malformed ones', () => {
  const unit = normalizeVector([1, 1, 1]);
  assert.doesNotThrow(() => assertValidEmbeddingVector(unit, 3));
  assert.throws(() => assertValidEmbeddingVector([1, 0], 3), InvalidEmbeddingVectorError);
  assert.throws(() => assertValidEmbeddingVector([1, 1, 1], 3), InvalidEmbeddingVectorError);
  assert.throws(
    () => assertValidEmbeddingVector([Number.NaN, 0, 0], 3),
    InvalidEmbeddingVectorError,
  );
});
