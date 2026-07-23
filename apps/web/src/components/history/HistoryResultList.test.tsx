/**
 * Smoke tests for history browse UI components accessible markup and link targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_HISTORY_FILTERS } from '../../lib/history/filters';
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
  eraLabel: '1870s to 1910s',
  eraBuckets: ['1870s', '1910s'],
  entityStatus: 'historic',
  evidenceCount: 2,
  connectionCount: 1,
  href: '/entity/ent_dunbar_school_001',
  topicTags: ['education'],
};

test('DecadeStepper renders tablist with all-time and decade tabs', () => {
  const html = renderToStaticMarkup(
    <DecadeStepper
      decades={['1860s', '1950s']}
      viewState={{ mode: 'decade', decade: '1950s', filters: DEFAULT_HISTORY_FILTERS }}
    />,
  );
  assert.match(html, /role="tablist"/);
  assert.match(html, /ds-explore-edition__decade-stepper/);
  assert.match(html, /ds-explore-edition__decade-tab/);
  assert.match(html, /All time/);
  assert.match(html, /1950s/);
  assert.match(html, /aria-selected="true"/);
});

test('HistoryResultList renders entity links', () => {
  const html = renderToStaticMarkup(
    <HistoryResultList
      nodes={[sampleNode]}
      labelledBy="history-results"
      selectedId="ent_dunbar_school_001"
    />,
  );
  assert.match(html, /href="\/entity\/ent_dunbar_school_001"/);
  assert.match(html, /1870s to 1910s/);
  assert.match(html, /ds-history-edition__rip-fact-label/);
  assert.match(html, /aria-current="true"/);
});
