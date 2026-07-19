/**
 * Unit tests for Firestore editorial catalog merge helpers (no live network).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractEmbeddingVector,
  mergeEditorialCatalogFromDocs,
  mergeJsonCatalogOverFirestore,
} from './editorial-catalog-firestore.js';

test('extractEmbeddingVector accepts arrays and toArray()-shaped values', () => {
  assert.deepEqual(extractEmbeddingVector([0.1, 0.2]), [0.1, 0.2]);
  assert.deepEqual(extractEmbeddingVector({ toArray: () => [1, 2, 3] }), [1, 2, 3]);
  assert.equal(extractEmbeddingVector('nope'), undefined);
});

test('mergeEditorialCatalogFromDocs joins vectors with search-index names', () => {
  const vector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));
  const catalog = mergeEditorialCatalogFromDocs({
    embeddings: [
      { id: 'ent_a', embedding: vector, dims: 768 },
      { id: 'ent_bad', embedding: [1, 2], dims: 2 },
      { id: 'ent_b', embedding: vector, dims: 768 },
    ],
    searchIndexById: new Map([['ent_a', { displayName: 'Alpha Place', aliases: ['Alpha'] }]]),
  });
  assert.equal(catalog.length, 2);
  assert.equal(catalog[0]?.id, 'ent_a');
  assert.equal(catalog[0]?.displayName, 'Alpha Place');
  assert.deepEqual(catalog[0]?.aliases, ['Alpha']);
  assert.equal(catalog[0]?.vector?.length, 768);
  assert.equal(catalog[1]?.id, 'ent_b');
  assert.equal(catalog[1]?.displayName, 'ent_b');
});

test('mergeJsonCatalogOverFirestore prefers JSON displayName and keeps Firestore vector', () => {
  const vector = Array.from({ length: 3 }, () => 1);
  const merged = mergeJsonCatalogOverFirestore(
    [{ id: 'ent_a', displayName: 'From Firestore', vector }],
    [
      { id: 'ent_a', displayName: 'From JSON', aliases: ['A'] },
      { id: 'ent_b', displayName: 'Only JSON' },
    ],
  );
  assert.equal(merged.length, 2);
  const a = merged.find((entry) => entry.id === 'ent_a');
  assert.equal(a?.displayName, 'From JSON');
  assert.deepEqual(a?.vector, vector);
  assert.deepEqual(a?.aliases, ['A']);
});
