/**
 * SSR smoke tests for the `/history` data panel — kind composition, connection lists
 * when edges exist, and no dominating empty-state when edges are absent.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HistoryDataPanel } from './HistoryDataPanel';
import { HistoryGraphPanel } from './HistoryGraphPanel';

const sampleNode: HistoryNodeView = {
  entityId: 'ent_dunbar_school_001',
  displayName: 'Paul Laurence Dunbar High School',
  kind: 'school',
  summary: 'Fixture school summary.',
  statusLabel: 'Historic',
  statusKind: 'status',
  evidenceCount: 2,
  connectionCount: 1,
  href: '/entity/ent_dunbar_school_001',
  topicTags: ['education'],
};

const sampleEdge: HistoryEdgeView = {
  edgeId: 'rel_dunbar_located',
  relationshipId: 'rel_dunbar_located',
  type: 'located_at',
  fromEntityId: 'ent_dunbar_school_001',
  toEntityId: 'ent_dc_place_001',
  fromDisplayName: 'Paul Laurence Dunbar High School',
  toDisplayName: 'Washington, D.C.',
  evidenceCount: 2,
  citations: [{ id: 'c1', label: 'Primary citation' }],
  sentence: 'Paul Laurence Dunbar High School is located at Washington, D.C.',
};

function makeNode(
  entityId: string,
  kind: string,
  connectionCount: number,
): HistoryNodeView {
  return {
    ...sampleNode,
    entityId,
    displayName: entityId,
    kind,
    connectionCount,
    href: `/entity/${entityId}`,
  };
}

test('HistoryDataPanel renders kind composition without a relationship SVG', () => {
  const nodes = Array.from({ length: 30 }, (_, index) =>
    makeNode(`n${index}`, index % 2 === 0 ? 'school' : 'place', 0),
  );
  const html = renderToStaticMarkup(
    createElement(HistoryDataPanel, {
      nodes,
      edges: [],
      sparseDecade: false,
      onSelectKind: () => {},
    }),
  );

  assert.match(html, /Kind composition/);
  assert.match(html, /ds-history-data/);
  assert.doesNotMatch(html, /ds-history-graph-viz/);
  assert.doesNotMatch(html, /No documented connections in this view/);
  assert.doesNotMatch(html, /publication bar/);
  assert.match(html, /From the archive/);
});

test('HistoryDataPanel lists documented connections when edges exist', () => {
  const place: HistoryNodeView = {
    ...sampleNode,
    entityId: 'ent_dc_place_001',
    displayName: 'Washington, D.C.',
    kind: 'place',
    connectionCount: 1,
    href: '/entity/ent_dc_place_001',
  };
  const html = renderToStaticMarkup(
    createElement(HistoryDataPanel, {
      nodes: [sampleNode, place],
      edges: [sampleEdge],
      sparseDecade: false,
      selectedId: sampleNode.entityId,
      onSelectNode: () => {},
      onSelectEdge: () => {},
    }),
  );

  assert.match(html, /Documented connections/);
  assert.match(html, /Paul Laurence Dunbar High School is located at Washington, D\.C\./);
  assert.match(html, /Connections for Paul Laurence Dunbar High School \(1\)/);
  assert.match(html, /From the archive/);
});

test('HistoryGraphPanel keeps sparse-decade empty state', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryGraphPanel, {
      nodes: [],
      edges: [],
      sparseDecade: true,
    }),
  );

  assert.match(html, /Limited published coverage for this decade/);
  assert.doesNotMatch(html, /ds-history-data/);
});

test('HistoryGraphPanel keeps no-filter-match empty state', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryGraphPanel, {
      nodes: [],
      edges: [],
      sparseDecade: false,
    }),
  );

  assert.match(html, /No records match these filters/);
  assert.doesNotMatch(html, /ds-history-data/);
});
