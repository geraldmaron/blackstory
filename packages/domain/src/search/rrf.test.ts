/**
 * Tests for reciprocal rank fusion determinism.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_RRF_K, reciprocalRankFusion } from './rrf.js';

test('RRF is deterministic for identical inputs', () => {
  const lanes = [
    {
      laneId: 'structured',
      weight: 1,
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    },
    {
      laneId: 'vector',
      weight: 1,
      items: [{ id: 'b' }, { id: 'd' }, { id: 'a' }],
    },
  ];
  const first = reciprocalRankFusion(lanes, { k: DEFAULT_RRF_K });
  const second = reciprocalRankFusion(lanes, { k: DEFAULT_RRF_K });
  assert.deepEqual(
    first.map((e) => e.id),
    second.map((e) => e.id),
  );
});

test('RRF promotes ids appearing in both lanes', () => {
  const fused = reciprocalRankFusion([
    { laneId: 'structured', weight: 1, items: [{ id: 'shared' }, { id: 'only-structured' }] },
    { laneId: 'vector', weight: 1, items: [{ id: 'shared' }, { id: 'only-vector' }] },
  ]);
  assert.equal(fused[0]?.id, 'shared');
});

test('RRF tie-breaks by id ascending', () => {
  const fused = reciprocalRankFusion([
    { laneId: 'a', weight: 1, items: [{ id: 'z-id' }] },
    { laneId: 'b', weight: 1, items: [{ id: 'a-id' }] },
  ]);
  assert.deepEqual(
    fused.map((e) => e.id),
    ['a-id', 'z-id'],
  );
});

test('RRF fusion scores are internal and never zero-sum empty', () => {
  const fused = reciprocalRankFusion([
    { laneId: 'structured', weight: 1, items: [{ id: 'x' }] },
  ]);
  assert.ok(fused[0]!.fusionScore > 0);
});
