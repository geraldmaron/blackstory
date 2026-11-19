import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queryRenderedLayers } from './query-rendered';

const mapWith = (layers: string[], query: (...args: unknown[]) => unknown[]) => ({
  getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
  queryRenderedFeatures: query as never,
});

test('queries only the layers that exist, and nothing when none do', () => {
  const calls: unknown[][] = [];
  const map = mapWith(['a'], (...args) => (calls.push(args), [{ id: 1 }]));
  assert.deepEqual(queryRenderedLayers(map, undefined, ['a', 'b']), [{ id: 1 }]);
  assert.deepEqual(calls[0], [{ layers: ['a'] }]);
  assert.deepEqual(queryRenderedLayers(map, [1, 2], ['a']), [{ id: 1 }]);
  assert.deepEqual(calls[1], [[1, 2], { layers: ['a'] }]);
  assert.deepEqual(queryRenderedLayers(map, undefined, ['b']), []);
  assert.equal(calls.length, 2);
});

test("MapLibre's mid-setData index race reads as an empty frame; other errors still throw", () => {
  const racing = mapWith(['a'], () => {
    throw new Error("Out of bounds. Index requested n=0 can't be >= this._numberToString.length 0");
  });
  assert.deepEqual(queryRenderedLayers(racing, undefined, ['a']), []);
  const broken = mapWith(['a'], () => {
    throw new Error('Style is not done loading');
  });
  assert.throws(() => queryRenderedLayers(broken, undefined, ['a']), /Style is not done/);
});
