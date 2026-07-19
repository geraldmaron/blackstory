/**
 * Unit tests for deterministic history graph layout — truncation, edge filtering, and stable coordinates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryEdgeView, HistoryNodeView } from './build-history-graph';
import { layoutHistoryGraph } from './layout-history-graph';

function makeNode(
  entityId: string,
  displayName: string,
  kind: string,
  connectionCount: number,
): HistoryNodeView {
  return {
    entityId,
    displayName,
    kind,
    summary: `${displayName} summary`,
    statusLabel: 'Historic',
    statusKind: 'status',
    evidenceCount: 1,
    connectionCount,
    href: `/entity/${entityId}`,
    factLinks: [],
    topicTags: [],
  };
}

function makeEdge(
  edgeId: string,
  fromEntityId: string,
  toEntityId: string,
): HistoryEdgeView {
  return {
    edgeId,
    relationshipId: edgeId,
    type: 'located_at',
    fromEntityId,
    toEntityId,
    fromDisplayName: fromEntityId,
    toDisplayName: toEntityId,
    evidenceCount: 1,
    citations: [{ id: 'c1', label: 'Citation' }],
    sentence: `${fromEntityId} connects to ${toEntityId}.`,
  };
}

test('layoutHistoryGraph is deterministic for the same seed and inputs', () => {
  const nodes = [
    makeNode('a', 'Alpha School', 'school', 2),
    makeNode('b', 'Beta Place', 'place', 1),
    makeNode('c', 'Gamma Person', 'person', 0),
  ];
  const edges = [makeEdge('e1', 'a', 'b')];
  const options = { width: 400, height: 300, seed: 42 };

  const first = layoutHistoryGraph(nodes, edges, options);
  const second = layoutHistoryGraph(nodes, edges, options);

  assert.deepEqual(first.layoutNodes, second.layoutNodes);
  assert.deepEqual(first.layoutEdges, second.layoutEdges);
});

test('layoutHistoryGraph truncates by connection count then display name', () => {
  const nodes = [
    makeNode('low', 'Zulu Record', 'place', 0),
    makeNode('mid', 'Middle Record', 'place', 1),
    makeNode('high', 'Alpha Record', 'place', 3),
  ];
  const result = layoutHistoryGraph(nodes, [], { width: 320, height: 240, maxNodes: 2, seed: 7 });

  assert.equal(result.truncated, true);
  assert.equal(result.totalNodeCount, 3);
  assert.equal(result.layoutNodes.length, 2);
  assert.deepEqual(
    result.layoutNodes.map((node) => node.entityId).sort(),
    ['high', 'mid'],
  );
});

test('layoutHistoryGraph keeps only edges between laid-out nodes', () => {
  const nodes = [
    makeNode('a', 'Alpha', 'school', 2),
    makeNode('b', 'Beta', 'place', 1),
    makeNode('c', 'Gamma', 'person', 0),
  ];
  const edges = [
    makeEdge('e-ab', 'a', 'b'),
    makeEdge('e-bc', 'b', 'c'),
    makeEdge('e-ac', 'a', 'c'),
  ];

  const result = layoutHistoryGraph(nodes, edges, {
    width: 400,
    height: 300,
    maxNodes: 2,
    seed: 11,
  });

  assert.equal(result.layoutEdges.length, 1);
  assert.equal(result.layoutEdges[0]?.edgeId, 'e-ab');
});

test('layoutHistoryGraph places nodes inside the requested bounds', () => {
  const nodes = Array.from({ length: 12 }, (_, index) =>
    makeNode(`n${index}`, `Record ${index}`, index % 2 === 0 ? 'school' : 'place', index % 3),
  );
  const edges = [makeEdge('e0', 'n0', 'n1'), makeEdge('e1', 'n2', 'n3')];

  const result = layoutHistoryGraph(nodes, edges, { width: 500, height: 400, seed: 99 });

  for (const node of result.layoutNodes) {
    assert.ok(node.x >= 28 && node.x <= 472, `x out of bounds for ${node.entityId}`);
    assert.ok(node.y >= 28 && node.y <= 372, `y out of bounds for ${node.entityId}`);
  }
});
