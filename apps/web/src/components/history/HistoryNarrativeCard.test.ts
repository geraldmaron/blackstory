/**
 * SSR markup smoke tests for the history graph narrative off-ramp card.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { HistoryNodeView } from '../../lib/history/build-history-graph';
import { HistoryNarrativeCard } from './HistoryNarrativeCard';

const sampleNode: HistoryNodeView = {
  entityId: 'ent_dunbar_school_001',
  displayName: 'Paul Laurence Dunbar High School',
  kind: 'school',
  summary: 'A landmark public school in Washington, D.C.',
  statusLabel: 'Operating',
  statusKind: 'status',
  evidenceCount: 3,
  connectionCount: 2,
  href: '/entity/ent_dunbar_school_001',
  factLinks: [],
  topicTags: ['education'],
};

test('links evidence count to the entity accepted-claims anchor', () => {
  const html = renderToStaticMarkup(createElement(HistoryNarrativeCard, { node: sampleNode }));

  assert.match(html, /3 accepted claims/);
  assert.match(html, /href="\/entity\/ent_dunbar_school_001#accepted-claims"/);
});

test('links kind to explore filtered by entity kind', () => {
  const html = renderToStaticMarkup(createElement(HistoryNarrativeCard, { node: sampleNode }));

  assert.match(html, />school</);
  assert.match(html, /kind=school/);
});

test('preserves close control and open full record CTA', () => {
  const html = renderToStaticMarkup(
    createElement(HistoryNarrativeCard, {
      node: sampleNode,
      onClose: () => {},
    }),
  );

  assert.match(html, /Close Paul Laurence Dunbar High School card/);
  assert.match(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.match(html, /Open full record/);
});
