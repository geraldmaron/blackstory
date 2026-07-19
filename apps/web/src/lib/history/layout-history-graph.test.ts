/**
 * Unit tests for adaptive history graph layout — mode selection, aggregation,
 * neighborhood focus, and deterministic coordinates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryEdgeView, HistoryNodeView } from './build-history-graph';
import {
  HISTORY_RECORD_GRAPH_MAX,
  layoutHistoryGraph,
  resolveHistoryGraphMode,
} from './layout-history-graph';
import { kindEncodingFor } from '../map-experience/kind-encoding';

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
    topicTags: [],
  };
}

function makeEdge(edgeId: string, fromEntityId: string, toEntityId: string): HistoryEdgeView {
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

test('resolveHistoryGraphMode prefers neighborhood, then records, then aggregate', () => {
  assert.equal(resolveHistoryGraphMode(100, undefined, false), 'aggregate');
  assert.equal(resolveHistoryGraphMode(10, undefined, false), 'records');
  assert.equal(resolveHistoryGraphMode(100, 'ent_a', true), 'neighborhood');
  assert.equal(resolveHistoryGraphMode(100, 'ent_a', false), 'aggregate');
});

test('layoutHistoryGraph aggregates by kind when the set is large', () => {
  const nodes = Array.from({ length: HISTORY_RECORD_GRAPH_MAX + 5 }, (_, index) =>
    makeNode(`n${index}`, `Record ${index}`, index % 2 === 0 ? 'school' : 'place', index % 3),
  );
  const edges = [makeEdge('e0', 'n0', 'n1'), makeEdge('e1', 'n2', 'n3')];
  const result = layoutHistoryGraph(nodes, edges, { width: 640, height: 360, seed: 1 });

  assert.equal(result.mode, 'aggregate');
  assert.equal(result.layoutNodes.length, 2);
  assert.ok(result.layoutNodes.every((node) => node.role === 'kind-hub'));
  assert.ok(result.layoutNodes.every((node) => node.shade === kindEncodingFor(node.kind).shade));
  assert.ok(result.layoutEdges.length >= 1);
});

test('layoutHistoryGraph focuses on a selected record neighborhood', () => {
  const nodes = [
    makeNode('a', 'Alpha School', 'school', 2),
    makeNode('b', 'Beta Place', 'place', 1),
    makeNode('c', 'Gamma Person', 'person', 0),
  ];
  const edges = [makeEdge('e-ab', 'a', 'b'), makeEdge('e-ac', 'a', 'c')];
  const result = layoutHistoryGraph(nodes, edges, {
    width: 640,
    height: 360,
    seed: 3,
    selectedId: 'a',
  });

  assert.equal(result.mode, 'neighborhood');
  assert.equal(result.layoutNodes[0]?.id, 'a');
  assert.equal(result.layoutNodes.length, 3);
  assert.equal(result.layoutEdges.length, 2);
});

test('layoutHistoryGraph uses record mode for small filtered sets', () => {
  const nodes = [
    makeNode('a', 'Alpha School', 'school', 2),
    makeNode('b', 'Beta Place', 'place', 1),
  ];
  const edges = [makeEdge('e1', 'a', 'b')];
  const first = layoutHistoryGraph(nodes, edges, { width: 400, height: 300, seed: 42 });
  const second = layoutHistoryGraph(nodes, edges, { width: 400, height: 300, seed: 42 });

  assert.equal(first.mode, 'records');
  assert.deepEqual(first.layoutNodes, second.layoutNodes);
  const school = first.layoutNodes.find((node) => node.kind === 'school');
  assert.ok(school);
  assert.equal(school.shade, kindEncodingFor('school').shade);
  assert.equal(school.glyph, 'square');
});

test('layoutHistoryGraph places nodes inside the requested bounds', () => {
  const nodes = Array.from({ length: 8 }, (_, index) =>
    makeNode(`n${index}`, `Record ${index}`, index % 2 === 0 ? 'school' : 'place', index % 3),
  );
  const edges = [makeEdge('e0', 'n0', 'n1')];
  const result = layoutHistoryGraph(nodes, edges, { width: 500, height: 400, seed: 99 });

  for (const node of result.layoutNodes) {
    assert.ok(node.x >= 0 && node.x <= 500, `x out of bounds for ${node.id}`);
    assert.ok(node.y >= 0 && node.y <= 400, `y out of bounds for ${node.id}`);
  }
});
