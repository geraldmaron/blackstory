/**
 * Tests for the budget-aware backfill runner, fully in-memory no Firestore, no
 * network access. Exercises: pagination, skip-unchanged-hash, --force, item cap, cost budget.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  runBackfill,
  type CanonicalEntitySource,
  type EntityEmbeddingInput,
} from './backfill-cli.js';
import { createDeterministicMockEmbeddingProvider } from './provider.js';
import { createInMemoryVectorIndexStore } from './vector-store.js';
import { buildEntityEmbeddingText } from './text.js';
import { sha256Hex } from './pipeline.js';

function makeSource(inputs: readonly EntityEmbeddingInput[], pageSize = 10): CanonicalEntitySource {
  return {
    async listPage(cursor) {
      const startIndex = cursor ? inputs.findIndex((item) => item.entityId === cursor) + 1 : 0;
      const page = inputs.slice(startIndex, startIndex + pageSize);
      const last = page.at(-1);
      return {
        items: page,
        ...(last && startIndex + pageSize < inputs.length ? { nextCursor: last.entityId } : {}),
      };
    },
  };
}

function entityInput(id: string, name: string): EntityEmbeddingInput {
  return { entityId: id, entity: { kind: 'other', displayName: name } };
}

test('runBackfill embeds every entity and writes to the store', async () => {
  const inputs = [entityInput('a', 'Alpha'), entityInput('b', 'Beta'), entityInput('c', 'Gamma')];
  const store = createInMemoryVectorIndexStore();
  const summary = await runBackfill({
    source: makeSource(inputs, 2),
    provider: createDeterministicMockEmbeddingProvider(),
    store,
  });

  assert.equal(summary.processed, 3);
  assert.equal(summary.embedded, 3);
  assert.equal(summary.skippedUnchanged, 0);
  assert.deepEqual(summary.skippedErrors, []);

  // Presence check only ranking correctness against real KNN semantics is covered in
  // vector-store.test.ts. A zero query vector still respects length-matching, just not order.
  const zeroQuery = new Array(768).fill(0);
  const matches = await store.findNearest({ queryVector: zeroQuery, limit: 10 });
  assert.deepEqual(new Set(matches.map((match) => match.entityId)), new Set(['a', 'b', 'c']));
});

test('runBackfill skips entities whose source text hash is unchanged unless --force', async () => {
  const inputs = [entityInput('a', 'Alpha')];
  const text = buildEntityEmbeddingText(inputs[0]!.entity);
  const hash = sha256Hex(text);

  const summaryUnchanged = await runBackfill({
    source: makeSource(inputs),
    provider: createDeterministicMockEmbeddingProvider(),
    store: createInMemoryVectorIndexStore(),
    existingHashes: { get: async () => hash },
  });
  assert.equal(summaryUnchanged.embedded, 0);
  assert.equal(summaryUnchanged.skippedUnchanged, 1);

  const summaryForced = await runBackfill({
    source: makeSource(inputs),
    provider: createDeterministicMockEmbeddingProvider(),
    store: createInMemoryVectorIndexStore(),
    existingHashes: { get: async () => hash },
    force: true,
  });
  assert.equal(summaryForced.embedded, 1);
  assert.equal(summaryForced.skippedUnchanged, 0);
});

test('runBackfill stops once maxItems is reached, across page boundaries', async () => {
  const inputs = Array.from({ length: 5 }, (_, index) =>
    entityInput(`e${index}`, `Entity ${index}`),
  );
  const summary = await runBackfill({
    source: makeSource(inputs, 2),
    provider: createDeterministicMockEmbeddingProvider(),
    store: createInMemoryVectorIndexStore(),
    maxItems: 3,
  });
  assert.equal(summary.processed, 3);
  assert.equal(summary.stoppedForMaxItems, true);
});

test('runBackfill stops for budget before exceeding maxEstimatedCostUsd', async () => {
  const inputs = Array.from({ length: 10 }, (_, index) =>
    entityInput(`e${index}`, `Entity number ${index} with extra text`),
  );
  const summary = await runBackfill({
    source: makeSource(inputs),
    provider: createDeterministicMockEmbeddingProvider(),
    store: createInMemoryVectorIndexStore(),
    maxEstimatedCostUsd: 1e-9,
  });
  assert.equal(summary.embedded, 0);
  assert.equal(summary.stoppedForBudget, true);
});

test('runBackfill records per-entity embedding errors without aborting the run', async () => {
  const inputs = [entityInput('ok', 'Fine'), entityInput('blank', '')];
  const summary = await runBackfill({
    source: makeSource(inputs),
    provider: createDeterministicMockEmbeddingProvider(),
    store: createInMemoryVectorIndexStore(),
  });
  assert.equal(summary.embedded, 1);
  assert.equal(summary.skippedErrors.length, 1);
  assert.equal(summary.skippedErrors[0]!.entityId, 'blank');
});
