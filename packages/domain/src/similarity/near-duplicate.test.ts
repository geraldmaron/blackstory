/**
 * Tests for semantic near-duplicate detection (BB-071) — a recall safety net alongside the
 * exact content-hash dedup in ../discovery/deduplication.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clusterNearDuplicates, findNearDuplicatesOf } from './near-duplicate.js';

test('findNearDuplicatesOf flags items at or above the threshold, most-similar first', () => {
  const candidate = { id: 'new', vector: [1, 0, 0] };
  const existing = [
    { id: 'near-identical', vector: [0.999, 0.001, 0] },
    { id: 'somewhat-similar', vector: [0.5, 0.5, 0] },
    { id: 'unrelated', vector: [0, 0, 1] },
  ];

  const flags = findNearDuplicatesOf(candidate, existing, 0.9);
  assert.deepEqual(
    flags.map((flag) => flag.id),
    ['near-identical'],
  );
});

test('findNearDuplicatesOf never flags the candidate against itself', () => {
  const candidate = { id: 'x', vector: [1, 0, 0] };
  const flags = findNearDuplicatesOf(candidate, [candidate], 0.5);
  assert.deepEqual(flags, []);
});

test('findNearDuplicatesOf rejects an out-of-range threshold', () => {
  assert.throws(() => findNearDuplicatesOf({ id: 'a', vector: [1, 0] }, [], 1.5));
});

test('clusterNearDuplicates groups mutually-similar items and drops singletons', () => {
  const items = [
    { id: 'a1', vector: [1, 0, 0] },
    { id: 'a2', vector: [0.995, 0.001, 0] },
    { id: 'b1', vector: [0, 1, 0] },
    { id: 'lonely', vector: [0, 0, 1] },
  ];

  const clusters = clusterNearDuplicates(items, 0.9);
  assert.equal(clusters.length, 1);
  assert.deepEqual(new Set(clusters[0]!.memberIds), new Set(['a1', 'a2']));
});
