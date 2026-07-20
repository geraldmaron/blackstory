/**
 * Tests for embedding pipeline orchestration, using the deterministic mock provider
 * no network access or API key required. See ADR-014 for what a real recall number needs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeterministicMockEmbeddingProvider } from './provider.js';
import {
  embedEntitiesBatch,
  embedEntity,
  estimateEmbeddingCostUsd,
  sha256Hex,
} from './pipeline.js';
import { isUnitVector } from './vector-math.js';

test('embedEntity produces a unit-normalized, correctly-dimensioned vector with derived filters', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  const result = await embedEntity(provider, {
    entityId: 'entity-1',
    entity: {
      kind: 'event',
      displayName: 'Greensboro sit-ins',
      summary: 'A series of nonviolent protests against segregated lunch counters.',
      event: { startAt: '1960-02-01' },
    },
    location: { state: 'nc', placeLabel: 'Greensboro, NC' },
  });

  assert.equal(result.entityId, 'entity-1');
  assert.equal(result.dims, 768);
  assert.equal(result.vector.length, 768);
  assert.ok(isUnitVector(result.vector));
  assert.equal(result.unitNorm, true);
  assert.deepEqual(result.filters, { kind: 'event', state: 'NC', eraBucket: '1960s' });
  assert.equal(result.sourceTextHash, sha256Hex(result.sourceText));
});

test('embedEntity is deterministic for identical entity input via the mock provider', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  const input = {
    entityId: 'entity-2',
    entity: { kind: 'place' as const, displayName: 'Woolworth Building' },
  };
  const first = await embedEntity(provider, input);
  const second = await embedEntity(provider, input);
  assert.deepEqual(first.vector, second.vector);
});

test('embedEntity rejects an entity with no embeddable text', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  await assert.rejects(
    embedEntity(provider, { entityId: 'blank', entity: { kind: 'other', displayName: '   ' } }),
  );
});

test('embedEntitiesBatch stops at maxItems', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  const inputs = Array.from({ length: 5 }, (_, index) => ({
    entityId: `e${index}`,
    entity: { kind: 'other' as const, displayName: `Entity ${index}` },
  }));
  const result = await embedEntitiesBatch(provider, inputs, { maxItems: 2 });
  assert.equal(result.results.length, 2);
  assert.equal(result.skipped.length, 0);
});

test('embedEntitiesBatch stops for budget once the projected cost would be exceeded', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  const inputs = Array.from({ length: 20 }, (_, index) => ({
    entityId: `e${index}`,
    entity: {
      kind: 'other' as const,
      displayName: `Entity ${index} with a somewhat longer description to accumulate cost`,
    },
  }));
  const result = await embedEntitiesBatch(provider, inputs, { maxEstimatedCostUsd: 1e-9 });
  assert.equal(result.stoppedForBudget, true);
  assert.equal(result.results.length, 0);
});

test('embedEntitiesBatch records per-item failures without aborting the batch', async () => {
  const provider = createDeterministicMockEmbeddingProvider();
  const inputs = [
    { entityId: 'ok', entity: { kind: 'other' as const, displayName: 'Fine' } },
    { entityId: 'blank', entity: { kind: 'other' as const, displayName: '' } },
  ];
  const result = await embedEntitiesBatch(provider, inputs);
  assert.equal(result.results.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0]!.entityId, 'blank');
});

test('estimateEmbeddingCostUsd matches the documented cost anchor: ~$7.50 for 100k docs of ~500 tokens', () => {
  const perDocCharCount = 500 / 0.25; // inverse of APPROX_TOKENS_PER_CHAR
  const perDocCost = estimateEmbeddingCostUsd(perDocCharCount);
  assert.ok(Math.abs(perDocCost * 100_000 - 7.5) < 1e-6);
});
