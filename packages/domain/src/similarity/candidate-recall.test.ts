/**
 * Tests for semantic candidate recall (BB-071): "find sources similar to this accepted one."
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSimilarCandidates } from './candidate-recall.js';

const corpus = [
  { id: 'a', vector: [1, 0, 0], payload: { title: 'A' } },
  { id: 'b', vector: [0.9, 0.1, 0], payload: { title: 'B' } },
  { id: 'c', vector: [0, 1, 0], payload: { title: 'C' } },
  { id: 'd', vector: [-1, 0, 0], payload: { title: 'D' } },
];

test('findSimilarCandidates ranks by cosine similarity descending', () => {
  const matches = findSimilarCandidates([1, 0, 0], corpus);
  assert.deepEqual(
    matches.map((match) => match.id),
    ['a', 'b', 'c', 'd'],
  );
  assert.ok(matches[0]!.similarity > matches[1]!.similarity);
  assert.equal(matches[0]!.payload?.title, 'A');
});

test('findSimilarCandidates respects limit', () => {
  const matches = findSimilarCandidates([1, 0, 0], corpus, { limit: 2 });
  assert.equal(matches.length, 2);
  assert.deepEqual(
    matches.map((match) => match.id),
    ['a', 'b'],
  );
});

test('findSimilarCandidates applies a similarity floor', () => {
  const matches = findSimilarCandidates([1, 0, 0], corpus, { minSimilarity: 0.5 });
  assert.deepEqual(
    matches.map((match) => match.id),
    ['a', 'b'],
  );
});

test('findSimilarCandidates excludes the target id when asked', () => {
  const matches = findSimilarCandidates([1, 0, 0], corpus, { excludeId: 'a' });
  assert.deepEqual(
    matches.map((match) => match.id),
    ['b', 'c', 'd'],
  );
});

test('findSimilarCandidates rejects a non-positive limit', () => {
  assert.throws(() => findSimilarCandidates([1, 0, 0], corpus, { limit: 0 }));
});
