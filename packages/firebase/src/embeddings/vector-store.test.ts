
/**
 * Tests for the Firestore vector index store.
 *
 * `createInMemoryVectorIndexStore` is exercised directly against Firestore's documented KNN
 * semantics (equality pre-filters, DOT_PRODUCT `distance >= threshold`, sort descending, then
 * limit). `createAdminVectorIndexStore` is exercised via a fake Firestore-shaped collection
 * this repo's tests don't spin up the Firestore emulator for "unit"-tier files, matching the
 * existing firestore.unit.test.ts convention.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminVectorIndexStore, createInMemoryVectorIndexStore } from './vector-store.js';
import { DISTANCE_MEASURE, VECTOR_FIELD_NAME } from './constants.js';

function doc(entityId: string, kind: 'person' | 'event' | 'place', vector: readonly number[], extra: { state?: string; eraBucket?: string } = {}) {
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
  await store.writeEmbedding(doc('person-nc', 'person', [1, 0], { state: 'NC', eraBucket: '1960s' }));
  await store.writeEmbedding(doc('person-ny', 'person', [1, 0], { state: 'NY', eraBucket: '1960s' }));
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

  const matches = await store.findNearest({ queryVector: [1, 0], limit: 10, distanceThreshold: 0.5 });
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

// --- Admin store: verify it shapes the Firestore query correctly, via a fake collection. ---

type FakeQuery = {
  readonly wheres: Array<{ field: string; op: string; value: unknown }>;
  where(field: string, op: string, value: unknown): FakeQuery;
  findNearest(options: Record<string, unknown>): {
    get(): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> }> }>;
  };
};

function createFakeCollection(resultDocs: Array<{ id: string; data: Record<string, unknown> }>) {
  let capturedFindNearestOptions: Record<string, unknown> | undefined;
  const wheres: Array<{ field: string; op: string; value: unknown }> = [];

  const query: FakeQuery = {
    wheres,
    where(field, op, value) {
      wheres.push({ field, op, value });
      return query;
    },
    findNearest(options) {
      capturedFindNearestOptions = options;
      return {
        async get() {
          return { docs: resultDocs.map((entry) => ({ id: entry.id, data: () => entry.data })) };
        },
      };
    },
  };

  return {
    query,
    doc: () => ({
      async set() {},
      async delete() {},
    }),
    where: query.where,
    findNearest: query.findNearest,
    getCapturedFindNearestOptions: () => capturedFindNearestOptions,
  };
}

test('admin store: findNearest applies kind/state/eraBucket as equality where clauses', async () => {
  const fake = createFakeCollection([{ id: 'e1', data: { kind: 'person', state: 'NC', distance: 0.87 } }]);
  const firestore = { collection: () => fake } as unknown as Parameters<typeof createAdminVectorIndexStore>[0];
  const store = createAdminVectorIndexStore(firestore);

  const matches = await store.findNearest({
    queryVector: [1, 0, 0],
    kind: 'person',
    state: 'NC',
    eraBucket: '1960s',
    limit: 5,
    distanceThreshold: 0.5,
  });

  assert.deepEqual(fake.query.wheres, [
    { field: 'kind', op: '==', value: 'person' },
    { field: 'state', op: '==', value: 'NC' },
    { field: 'eraBucket', op: '==', value: '1960s' },
  ]);
  const options = fake.getCapturedFindNearestOptions();
  assert.equal(options?.vectorField, VECTOR_FIELD_NAME);
  assert.equal(options?.distanceMeasure, DISTANCE_MEASURE);
  assert.equal(options?.limit, 5);
  assert.equal(options?.distanceThreshold, 0.5);
  assert.deepEqual(matches, [{ entityId: 'e1', kind: 'person', state: 'NC', distance: 0.87 }]);
});

test('admin store: clamps an oversized limit to the platform ceiling of 1000', async () => {
  const fake = createFakeCollection([]);
  const firestore = { collection: () => fake } as unknown as Parameters<typeof createAdminVectorIndexStore>[0];
  const store = createAdminVectorIndexStore(firestore);

  await store.findNearest({ queryVector: [1, 0], limit: 5000 });
  const options = fake.getCapturedFindNearestOptions();
  assert.equal(options?.limit, 1000);
});
