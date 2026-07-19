/**
 * SSR markup smoke tests for the adaptive history graph SVG and panel empty states.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HISTORY_RECORD_GRAPH_MAX } from '../../lib/history/layout-history-graph';
import { kindEncodingFor } from '../../lib/map-experience/kind-encoding';
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

function makeNode(entityId: string, kind: string, connectionCount: number): HistoryNodeView {
  return {
    ...sampleNode,
    entityId,
    displayName: entityId,
    kind,
    connectionCount,
    href: `/entity/${entityId}`,
  };
}

test('HistoryGraphViz renders SVG nodes with kind shade encoding', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryGraphViz, {
      nodes: [sampleNode],
      edges: [],
      onSelectNode: () => {},
    }),
  );

  const schoolShade = kindEncodingFor('school').shade;
  assert.match(html, /<svg/);
  assert.match(html, /aria-label="Paul Laurence Dunbar High School, school, Historic"/);
  assert.match(html, new RegExp(schoolShade.replace('#', '\\#')));
  assert.match(html, /data-mode="records"/);
  assert.match(html, />School</);
});

test('HistoryGraphViz focuses neighborhood when a record is selected', () => {
  const place: HistoryNodeView = {
    ...sampleNode,
    entityId: 'ent_dc_place_001',
    displayName: 'Washington, D.C.',
    kind: 'place',
    connectionCount: 1,
    href: '/entity/ent_dc_place_001',
  };
  const html = renderToStaticMarkup(
    createElement(HistoryGraphViz, {
      nodes: [sampleNode, place],
      edges: [sampleEdge],
      selectedId: sampleNode.entityId,
      onSelectNode: () => {},
    }),
  );

  assert.match(html, /data-mode="neighborhood"/);
  assert.match(html, /Focused on this record/);
  assert.match(html, /ds-history-graph-viz__node--selected/);
});

test('HistoryGraphViz aggregates large sets into kind hubs', () => {
  const nodes = Array.from({ length: HISTORY_RECORD_GRAPH_MAX + 3 }, (_, index) =>
    makeNode(`n${index}`, index % 2 === 0 ? 'school' : 'place', 1),
  );
  const html = renderToStaticMarkup(
    createElement(HistoryGraphViz, {
      nodes,
      edges: [],
      onSelectKind: () => {},
    }),
  );

  assert.match(html, /data-mode="aggregate"/);
  assert.match(html, /Grouped by kind/);
  assert.match(html, /Kind color key/);
  assert.match(html, /School kind/);
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
