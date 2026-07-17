/**
 * Tests for pure embedding-vector math.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InvalidEmbeddingVectorError, cosineSimilarity, dotProduct, isUnitVector } from './vector-math.js';

test('dotProduct computes the sum of pairwise products', () => {
  assert.equal(dotProduct([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(dotProduct([1, 0, 0], [0, 1, 0]), 0);
  assert.equal(dotProduct([1, 2, 3], [4, 5, 6]), 32);
});

test('dotProduct throws on length mismatch', () => {
  assert.throws(() => dotProduct([1, 2], [1, 2, 3]), InvalidEmbeddingVectorError);
});

test('cosineSimilarity is 1 for identical direction, 0 for orthogonal, -1 for opposite', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [2, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [-1, 0]) - -1) < 1e-9);
});

test('cosineSimilarity throws on a zero vector', () => {
  assert.throws(() => cosineSimilarity([0, 0], [1, 1]), InvalidEmbeddingVectorError);
});

test('isUnitVector accepts unit vectors within epsilon and rejects others', () => {
  assert.equal(isUnitVector([1, 0, 0]), true);
  assert.equal(isUnitVector([0.6, 0.8]), true);
  assert.equal(isUnitVector([1, 1]), false);
});
