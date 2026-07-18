/**
 * Smoke tests for history browse UI components accessible markup and link targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecadeStepper } from './DecadeStepper';
import { HistoryResultList } from './HistoryResultList';

void React;

const sampleNode = {
  entityId: 'ent_dunbar_school_001',
  displayName: 'Paul Laurence Dunbar High School',
  kind: 'school',
  summary: 'Fixture school summary.',
  statusLabel: 'Historic',
  statusKind: 'status' as const,
  evidenceCount: 2,
  href: '/entity/ent_dunbar_school_001',
  factLinks: [{ href: '/facts/dunbar-founding-1870', label: 'Sample fact' }],
  topicTags: ['education'],
};

test('DecadeStepper renders tablist with all-time and decade tabs', () => {
  const html = renderToStaticMarkup(
    <DecadeStepper
      decades={['1860s', '1950s']}
      viewState={{ mode: 'decade', decade: '1950s', filters: { kind: 'all' } }}
    />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /All time/);
  assert.match(html, /1950s/);
  assert.match(html, /aria-selected="true"/);
});

test('HistoryResultList renders entity links and fact off-ramps', () => {
  const html = renderToStaticMarkup(
    <HistoryResultList nodes={[sampleNode]} labelledBy="history-results" selectedId="ent_dunbar_school_001" />,
  );
  assert.match(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /href="\/facts\/dunbar-founding-1870"/);
});
