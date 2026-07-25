/**
 * Offline unit tests for the pure connected-components/degree-stats graph math backing
 * `catalog-connectivity-report.ts`. No filesystem or catalog fixtures involved — a tiny synthetic
 * graph is enough to pin down the algorithm's behavior.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeConnectedComponents,
  computeDegreeStats,
  type UndirectedEdge,
} from './catalog-connectivity-report.ts';

test('A-B-C connected + D isolated yields 2 components, largest size 3, 1 isolated', () => {
  const entityIds = ['A', 'B', 'C', 'D'];
  const edges: UndirectedEdge[] = [
    { a: 'A', b: 'B' },
    { a: 'B', b: 'C' },
  ];

  const result = computeConnectedComponents(entityIds, edges);

  assert.equal(result.componentCount, 2);
  assert.equal(result.largestComponentSize, 3);
  assert.equal(result.largestComponentPct, 75);
  assert.deepEqual(result.isolatedEntityIds, ['D']);
  assert.deepEqual(result.components[0], ['A', 'B', 'C']);
  assert.deepEqual(result.components[1], ['D']);
});

test('empty edge list yields one isolated component per entity', () => {
  const entityIds = ['X', 'Y'];
  const result = computeConnectedComponents(entityIds, []);

  assert.equal(result.componentCount, 2);
  assert.equal(result.largestComponentSize, 1);
  assert.deepEqual(result.isolatedEntityIds, ['X', 'Y']);
});

test('a single edge connecting every entity yields one component and zero isolated entities', () => {
  const entityIds = ['A', 'B', 'C'];
  const edges: UndirectedEdge[] = [
    { a: 'A', b: 'B' },
    { a: 'B', b: 'C' },
    { a: 'A', b: 'C' },
  ];

  const result = computeConnectedComponents(entityIds, edges);

  assert.equal(result.componentCount, 1);
  assert.equal(result.largestComponentSize, 3);
  assert.equal(result.largestComponentPct, 100);
  assert.deepEqual(result.isolatedEntityIds, []);
});

test('self-loops and edges to unknown entities are ignored', () => {
  const entityIds = ['A', 'B'];
  const edges: UndirectedEdge[] = [
    { a: 'A', b: 'A' },
    { a: 'A', b: 'not-in-set' },
  ];

  const result = computeConnectedComponents(entityIds, edges);

  assert.equal(result.componentCount, 2);
  assert.deepEqual(result.isolatedEntityIds, ['A', 'B']);
});

test('degree stats: min/median/mean/max over a triangle plus an isolated node', () => {
  const entityIds = ['A', 'B', 'C', 'D'];
  const edges: UndirectedEdge[] = [
    { a: 'A', b: 'B' },
    { a: 'B', b: 'C' },
    { a: 'A', b: 'C' },
  ];

  const stats = computeDegreeStats(entityIds, edges);

  assert.equal(stats.min, 0);
  assert.equal(stats.max, 2);
  assert.equal(stats.mean, 1.5);
  assert.equal(stats.median, 2);
  assert.equal(stats.degreeById.get('A'), 2);
  assert.equal(stats.degreeById.get('D'), 0);
});
