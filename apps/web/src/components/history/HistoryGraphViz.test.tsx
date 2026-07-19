/**
 * SSR markup smoke tests for the history graph SVG visualization and panel empty states.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HistoryGraphPanel } from './HistoryGraphPanel';
import { HistoryGraphViz } from './HistoryGraphViz';

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
  factLinks: [{ href: '/facts/dunbar-founding-1870', label: 'Sample fact' }],
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

test('HistoryGraphViz renders SVG nodes with accessible labels', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryGraphViz, {
      nodes: [sampleNode],
      edges: [sampleEdge],
      selectedId: sampleNode.entityId,
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /<svg/);
  assert.match(html, /aria-label="Paul Laurence Dunbar High School, school, Historic"/);
  assert.match(html, /ds-history-graph-viz__node--selected/);
  assert.match(html, /school/);
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
  assert.doesNotMatch(html, /ds-history-graph-viz/);
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
  assert.doesNotMatch(html, /ds-history-graph-viz/);
});

test('HistoryGraphPanel renders graph viz and selected connections', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryGraphPanel, {
      nodes: [sampleNode],
      edges: [sampleEdge],
      sparseDecade: false,
      selectedId: sampleNode.entityId,
      onSelectNode: () => {},
      onSelectEdge: () => {},
    }),
  );

  assert.match(html, /ds-history-graph-viz/);
  assert.match(html, /Connections for Paul Laurence Dunbar High School \(1\)/);
  assert.match(html, /Paul Laurence Dunbar High School is located at Washington, D\.C\./);
});
