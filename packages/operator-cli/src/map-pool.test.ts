/**
 * Unit tests for mapPool ordering, concurrency bound, and empty input.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPool } from './map-pool.ts';

test('mapPool preserves order with concurrency > 1', async () => {
  const started: number[] = [];
  const results = await mapPool(
    [1, 2, 3, 4, 5],
    async (n) => {
      started.push(n);
      await new Promise((r) => setTimeout(r, 20 - n * 2));
      return n * 10;
    },
    { concurrency: 3 },
  );
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(started.length, 5);
});

test('mapPool with concurrency 1 is sequential', async () => {
  const order: number[] = [];
  await mapPool(
    [1, 2, 3],
    async (n) => {
      order.push(n);
      return n;
    },
    { concurrency: 1 },
  );
  assert.deepEqual(order, [1, 2, 3]);
});

test('mapPool returns empty for empty input', async () => {
  const results = await mapPool([], async () => 1, { concurrency: 4 });
  assert.deepEqual(results, []);
});
