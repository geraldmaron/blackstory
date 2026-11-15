import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import {
  ExploreRecordList,
  RESULTS_ROW_HEIGHT,
  confidenceLevelFor,
  resultsWindow,
} from './ExploreRecordList';

function feature(id: string, overrides: Record<string, unknown> = {}): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [-76.8, 39.27] },
    properties: {
      entityId: id,
      href: `/entity/${id}`,
      kind: 'person',
      displayName: 'Benjamin Banneker',
      oneLineStory: '',
      precision: 'city',
      eraBuckets: ['1750s'],
      evidenceCount: 4,
      confidenceTier: 'high',
      topicTags: [],
      locationLabel: 'Ellicott City, Maryland',
      ...overrides,
    },
  } as unknown as ExploreMapFeature;
}

test('the window renders only the rows in view plus overscan', () => {
  const slice = resultsWindow(4000, RESULTS_ROW_HEIGHT * 100, RESULTS_ROW_HEIGHT * 10);
  assert.ok(slice.first > 80 && slice.first <= 100);
  assert.ok(slice.last - slice.first < 30);
  assert.deepEqual(resultsWindow(3, 0, 600), { first: 0, last: 3 });
});

test('the grade tag level follows the stored tier, unknown tiers read as ungraded', () => {
  assert.deepEqual(['high', 'medium', 'low', 'unrated', 'bogus'].map(confidenceLevelFor), [
    'high',
    'medium',
    'low',
    'unrated',
    'unrated',
  ]);
});

test('a row is two lines: name and decade, then kind as a word, place and grade', () => {
  const html = renderToStaticMarkup(
    createElement(ExploreRecordList, { features: [feature('a')], onSelect: () => {} }),
  );
  assert.match(html, /role="listbox"/);
  assert.match(html, /aria-setsize="1"/);
  const order = [
    'Benjamin Banneker',
    '1750s',
    'Person · Ellicott City, Maryland',
    'Well evidenced',
  ];
  const at = order.map((text) => html.indexOf(text));
  for (const index of at) assert.ok(index >= 0);
  assert.deepEqual(
    [...at].sort((a, b) => a - b),
    at,
  );
});

test('the selected row is marked by state, not by color alone', () => {
  const html = renderToStaticMarkup(
    createElement(ExploreRecordList, {
      features: [feature('a'), feature('b', { displayName: 'Striking Clock' })],
      selectedId: 'b',
      onSelect: () => {},
    }),
  );
  assert.match(html, /aria-selected="true"[^>]*class="ds-xlist__row ds-xlist__row--selected"/);
});

test('nothing matching renders the caller’s explanation, never a bare empty list', () => {
  const html = renderToStaticMarkup(
    createElement(ExploreRecordList, {
      features: [],
      onSelect: () => {},
      emptyState: createElement('p', null, 'No records match these filters.'),
    }),
  );
  assert.match(html, /No records match these filters\./);
  assert.doesNotMatch(html, /role="listbox"/);
});
