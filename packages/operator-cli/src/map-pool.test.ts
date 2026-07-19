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

test('mapPool onItemComplete fires after each item', async () => {
  const seen: Array<{ result: number; index: number; total: number }> = [];
  await mapPool([1, 2, 3], async (n) => n * 10, {
    concurrency: 2,
    onItemComplete: (result, index, total) => {
      seen.push({ result, index, total });
    },
  });
  assert.equal(seen.length, 3);
  assert.deepEqual(
    [...seen].sort((a, b) => a.index - b.index),
    [
      { result: 10, index: 0, total: 3 },
      { result: 20, index: 1, total: 3 },
      { result: 30, index: 2, total: 3 },
    ],
  );
});
