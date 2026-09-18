/** In-memory vector retrieval checks for filters, ranking and bounds. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInMemoryVectorIndexStore } from './vector-store.js';

function doc(
  entityId: string,
  kind: 'person' | 'event' | 'place',
  vector: readonly number[],
  extra: { state?: string; eraBucket?: string } = {},
) {
  return {
    entityId,
    kind,
    vector,
    dims: vector.length,
    model: 'test-model',
    sourceTextHash: 'hash',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

test('in-memory store: findNearest sorts by DOT_PRODUCT distance descending and respects limit', async () => {
  const store = createInMemoryVectorIndexStore();
  await store.writeEmbedding(doc('a', 'event', [1, 0, 0]));
  await store.writeEmbedding(doc('b', 'event', [0.9, 0.1, 0]));
  await store.writeEmbedding(doc('c', 'event', [0, 1, 0]));

  const matches = await store.findNearest({ queryVector: [1, 0, 0], limit: 2 });
  assert.deepEqual(
    matches.map((match) => match.entityId),
    ['a', 'b'],
  );
  assert.ok(matches[0]!.distance > matches[1]!.distance);
});

test('in-memory store: pre-filters by kind/state/eraBucket before ranking', async () => {
  const store = createInMemoryVectorIndexStore();
  await store.writeEmbedding(
    doc('person-nc', 'person', [1, 0], { state: 'NC', eraBucket: '1960s' }),
  );
  await store.writeEmbedding(
    doc('person-ny', 'person', [1, 0], { state: 'NY', eraBucket: '1960s' }),
  );
  await store.writeEmbedding(doc('event-nc', 'event', [1, 0], { state: 'NC', eraBucket: '1960s' }));

  const matches = await store.findNearest({
    queryVector: [1, 0],
    kind: 'person',
    state: 'NC',
    limit: 10,
  });
  assert.deepEqual(
    matches.map((match) => match.entityId),
    ['person-nc'],
  );
});

test('in-memory store: DOT_PRODUCT threshold keeps matches with distance >= threshold (inverted vs COSINE/EUCLIDEAN)', async () => {
  const store = createInMemoryVectorIndexStore();
  await store.writeEmbedding(doc('close', 'event', [1, 0]));
  await store.writeEmbedding(doc('far', 'event', [0, 1]));

  const matches = await store.findNearest({
    queryVector: [1, 0],
    limit: 10,
    distanceThreshold: 0.5,
  });
  assert.deepEqual(
    matches.map((match) => match.entityId),
    ['close'],
  );
});

test('in-memory store: clamps limit to the platform ceiling and rejects non-positive limits', async () => {
  const store = createInMemoryVectorIndexStore();
  await store.writeEmbedding(doc('a', 'event', [1, 0]));
  const matches = await store.findNearest({ queryVector: [1, 0], limit: 5000 });
  assert.equal(matches.length, 1);
  await assert.rejects(store.findNearest({ queryVector: [1, 0], limit: 0 }));
});

test('in-memory store: deleteEmbedding removes a document from future queries', async () => {
  const store = createInMemoryVectorIndexStore();
  await store.writeEmbedding(doc('a', 'event', [1, 0]));
  await store.deleteEmbedding('a');
  const matches = await store.findNearest({ queryVector: [1, 0], limit: 10 });
  assert.deepEqual(matches, []);
});
