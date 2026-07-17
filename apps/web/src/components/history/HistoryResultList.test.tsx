/**
 * Smoke tests for BB-093 history browse UI components — accessible markup and link targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DecadeStepper } from './DecadeStepper';
import { HistoryResultList } from './HistoryResultList';

void React;

const sampleNode = {
  entityId: 'ent_seed_place_001',
  displayName: 'Seed Historical Place',
  kind: 'place',
  summary: 'Fixture place summary.',
  statusLabel: 'Historic',
  statusKind: 'status' as const,
  evidenceCount: 2,
  href: '/entity/ent_seed_place_001',
  factLinks: [{ href: '/facts/BB-F-000001/rosa-parks-arrested-december-1-1955', label: 'Sample fact' }],
  topicTags: ['community'],
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
    <HistoryResultList nodes={[sampleNode]} labelledBy="history-results" selectedId="ent_seed_place_001" />,
  );
  assert.match(html, /href="\/entity\/ent_seed_place_001"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /href="\/facts\/BB-F-000001\/rosa-parks-arrested-december-1-1955"/);
});
