/**
 * Tests for vector-based related-entity suggestions in editorial workflows.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestRelatedEntitiesFromVectors } from './related-from-vectors.js';

const corpus = [
  { id: 'entity-a', vector: [1, 0, 0] as const, displayName: 'Alpha Place' },
  { id: 'entity-b', vector: [0.9, 0.1, 0] as const, displayName: 'Beta Site' },
  { id: 'entity-c', vector: [0, 1, 0] as const },
];

test('suggestRelatedEntitiesFromVectors ranks by similarity with optional display names', () => {
  const suggestions = suggestRelatedEntitiesFromVectors({
    targetVector: [1, 0, 0],
    corpus,
    limit: 2,
  });

  assert.equal(suggestions.length, 2);
  assert.deepEqual(
    suggestions.map((entry) => entry.entityId),
    ['entity-a', 'entity-b'],
  );
  assert.equal(suggestions[0]?.displayName, 'Alpha Place');
  assert.ok((suggestions[0]?.similarity ?? 0) >= (suggestions[1]?.similarity ?? 0));
});

test('suggestRelatedEntitiesFromVectors applies a similarity floor', () => {
  const suggestions = suggestRelatedEntitiesFromVectors({
    targetVector: [1, 0, 0],
    corpus,
    minSimilarity: 0.5,
  });

  assert.deepEqual(
    suggestions.map((entry) => entry.entityId),
    ['entity-a', 'entity-b'],
  );
  assert.equal(
    suggestions.find((entry) => entry.entityId === 'entity-c'),
    undefined,
  );
});
