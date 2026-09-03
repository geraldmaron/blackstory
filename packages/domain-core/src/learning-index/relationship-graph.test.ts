/**
 * Relationship graph tests: the path, the loops, the caps, and the refusal to invent a date.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRelationshipGraph,
  resolveRelationshipYear,
  type RelationshipGraphLookup,
} from './relationship-graph.js';

type EdgeSpec = readonly [string, string?];

function entity(
  id: string,
  edges: readonly EdgeSpec[] = [],
  eraBuckets?: readonly string[],
): RelationshipGraphLookup {
  return {
    id,
    displayName: id.toUpperCase(),
    kind: 'place',
    summary: `Summary for ${id}`,
    related: edges.map(([target, type]) => ({
      id: target,
      type: type ?? 'related_to',
      direction: 'outgoing' as const,
    })),
    ...(eraBuckets !== undefined ? { eraBuckets } : {}),
  };
}

function lookupOf(...items: readonly RelationshipGraphLookup[]) {
  return new Map(items.map((item) => [item.id, item]));
}

test('walks three hops and records the node each one was reached through', () => {
  const graph = buildRelationshipGraph(
    'a',
    lookupOf(entity('a', [['b']]), entity('b', [['c']]), entity('c', [['d']]), entity('d')),
  );

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.deepEqual(
    graph.nodes.map((node) => [node.id, node.hop]),
    [
      ['b', 1],
      ['c', 2],
      ['d', 3],
    ],
  );
  // Hop 1 is reached from the center, so it carries no `viaId` at all.
  assert.equal(byId.get('b')?.viaId, undefined);
  assert.equal(byId.get('c')?.viaId, 'b');
  assert.equal(byId.get('d')?.viaId, 'c');
});

test('stops at the requested depth', () => {
  const graph = buildRelationshipGraph(
    'a',
    lookupOf(entity('a', [['b']]), entity('b', [['c']]), entity('c', [['d']]), entity('d')),
    { maxHops: 2 },
  );
  assert.deepEqual(
    graph.nodes.map((node) => node.id),
    ['b', 'c'],
  );
});

test('a record shared by two branches is one node, and the loop is drawn as a cross-link', () => {
  // a → b, a → c, and b → c. `c` must not appear twice; the b–c edge must survive as a
  // non-spine link, since that loop is exactly what a tree layout would have to throw away.
  const graph = buildRelationshipGraph(
    'a',
    lookupOf(entity('a', [['b'], ['c']]), entity('b', [['c']]), entity('c')),
  );

  assert.equal(graph.nodes.filter((node) => node.id === 'c').length, 1);
  assert.equal(graph.nodes.find((node) => node.id === 'c')?.hop, 1);
  const cross = graph.links.filter((link) => !link.spine);
  assert.equal(cross.length, 1);
  assert.deepEqual([cross[0]?.source, cross[0]?.target], ['b', 'c']);
});

test('drops edges pointing at records the caller did not fetch', () => {
  const graph = buildRelationshipGraph('a', lookupOf(entity('a', [['b'], ['ghost']]), entity('b')));
  assert.deepEqual(
    graph.nodes.map((node) => node.id),
    ['b'],
  );
  assert.ok(graph.links.every((link) => link.target !== 'ghost'));
});

test('never emits a link to a node the hop cap cut', () => {
  const graph = buildRelationshipGraph(
    'a',
    lookupOf(entity('a', [['b'], ['c'], ['d']]), entity('b'), entity('c'), entity('d')),
    { hopCaps: [2] },
  );
  const ids = new Set(['a', ...graph.nodes.map((node) => node.id)]);
  assert.equal(graph.nodes.length, 2);
  for (const link of graph.links) {
    assert.ok(ids.has(link.source), `dangling source ${link.source}`);
    assert.ok(ids.has(link.target), `dangling target ${link.target}`);
  }
});

test('orders each hop by year, then name, and is stable across runs', () => {
  const lookup = lookupOf(
    entity('a', [['late'], ['early'], ['mid']], ['1800s']),
    entity('early', [], ['1870s']),
    entity('mid', [], ['1910s']),
    entity('late', [], ['1970s']),
  );
  const first = buildRelationshipGraph('a', lookup);
  const second = buildRelationshipGraph('a', lookup);
  assert.deepEqual(
    first.nodes.map((node) => node.id),
    ['early', 'mid', 'late'],
  );
  assert.deepEqual(first.nodes, second.nodes);
  assert.equal(first.centerYear, 1800);
});

test('undated stays undated — no year is invented from a neighbor', () => {
  const graph = buildRelationshipGraph('a', lookupOf(entity('a', [['b']], ['1890s']), entity('b')));
  assert.equal(graph.nodes[0]?.year, undefined);
});

test('an edge timespan dates the connection ahead of the record era', () => {
  assert.equal(resolveRelationshipYear({ validFrom: '1892-04-01' }, ['1970s']), 1892);
  assert.equal(resolveRelationshipYear({ label: 'served 1901 to 1912' }, ['1970s']), 1901);
  assert.equal(resolveRelationshipYear(undefined, ['1910s', '1870s']), 1870);
  assert.equal(resolveRelationshipYear(undefined, []), undefined);
  assert.equal(resolveRelationshipYear(undefined, ['contemporary']), undefined);
});

test('a cycle cannot make the walk revisit a node', () => {
  const graph = buildRelationshipGraph(
    'a',
    lookupOf(entity('a', [['b']]), entity('b', [['c'], ['a']]), entity('c', [['a'], ['b']])),
  );
  assert.deepEqual(
    graph.nodes.map((node) => node.id),
    ['b', 'c'],
  );
});
