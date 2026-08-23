/**
 * Results rail: windowing arithmetic plus the listbox semantics the rail promises.
 *
 * The windowing assertions matter because the whole point of the rail is that 4,078 records do
 * not become 4,078 nodes — `/history` already demonstrates that cost. The a11y assertions matter
 * because windowing is what usually breaks listbox semantics: a rendered slice reports the wrong
 * set size unless `aria-setsize` and `aria-posinset` are carried deliberately.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import {
  RESULTS_ROW_HEIGHT,
  ResultsRail,
  resultsWindow,
  type ResultsRailProps,
} from './ResultsRail';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';

const RELEASE_SIZE = 4078;

function feature(index: number, overrides: Partial<ExploreMapFeature['properties']> = {}) {
  return {
    type: 'Feature',
    id: `ent_${index}`,
    geometry: { type: 'Point', coordinates: [-86.8, 33.5] },
    properties: {
      entityId: `ent_${index}`,
      href: `/entity/ent_${index}`,
      kind: 'place',
      displayName: `Record ${index}`,
      oneLineStory: '',
      precision: 'locality',
      geoPrecisionTier: 'locality',
      eraBuckets: ['1950s'],
      evidenceCount: 2,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#b86b2a',
      glyph: 'circle',
      kindFamily: 'places',
      locationLabel: 'Birmingham, Alabama',
      stateName: 'Alabama',
      ...overrides,
    },
  } as unknown as ExploreMapFeature;
}

function railProps(overrides: Partial<ResultsRailProps> = {}): ResultsRailProps {
  const features = [feature(0), feature(1), feature(2)];
  return {
    features,
    total: features.length,
    onSelect: () => {},
    sort: 'oldest',
    onSortChange: () => {},
    ...overrides,
  };
}

/* ---- windowing ------------------------------------------------------------ */

test('the window never renders the whole release', () => {
  const range = resultsWindow(RELEASE_SIZE, 0, 600);
  assert.ok(
    range.last - range.first < 40,
    `expected a small window, rendered ${range.last - range.first} rows`,
  );
});

test('the window follows the scroll position', () => {
  const deep = resultsWindow(RELEASE_SIZE, RESULTS_ROW_HEIGHT * 2000, 600);
  assert.ok(deep.first > 1980, `expected the window near row 2000, got ${deep.first}`);
  assert.ok(deep.last > deep.first);
});

test('the window is clamped at both ends of the list', () => {
  assert.equal(resultsWindow(RELEASE_SIZE, 0, 600).first, 0);
  assert.equal(resultsWindow(RELEASE_SIZE, -400, 600).first, 0);

  const end = resultsWindow(RELEASE_SIZE, RESULTS_ROW_HEIGHT * RELEASE_SIZE, 600);
  assert.equal(end.last, RELEASE_SIZE);
  assert.ok(end.first <= end.last);
});

test('an unmeasured viewport still renders a screenful rather than nothing', () => {
  const range = resultsWindow(RELEASE_SIZE, 0, 0);
  assert.ok(range.last > 0, 'a rail that paints empty on mount reads as a loading bug');
});

test('a short list is fully rendered', () => {
  assert.deepEqual(resultsWindow(3, 0, 600), { first: 0, last: 3 });
});

/* ---- semantics ------------------------------------------------------------ */

test('the rail is a listbox of options', () => {
  const html = renderToStaticMarkup(createElement(ResultsRail, railProps()));
  assert.match(html, /role="listbox"/);
  assert.equal(html.match(/role="option"/g)?.length, 3);
});

test('exactly one row is selected at a time', () => {
  const html = renderToStaticMarkup(createElement(ResultsRail, railProps({ selectedId: 'ent_1' })));
  assert.equal(html.match(/aria-selected="true"/g)?.length, 1);
  assert.equal(html.match(/aria-selected="false"/g)?.length, 2);
});

test('no row is selected when nothing is selected', () => {
  const html = renderToStaticMarkup(createElement(ResultsRail, railProps()));
  assert.equal(html.includes('aria-selected="true"'), false);
});

test('every option carries its true position in the full list, not the window', () => {
  const features = Array.from({ length: RELEASE_SIZE }, (_, index) => feature(index));
  const html = renderToStaticMarkup(
    createElement(ResultsRail, railProps({ features, total: RELEASE_SIZE })),
  );
  assert.match(html, new RegExp(`aria-setsize="${RELEASE_SIZE}"`));
  assert.match(html, /aria-posinset="1"/);
  const rendered = html.match(/role="option"/g)?.length ?? 0;
  assert.ok(rendered > 0 && rendered < 40, `windowing regressed: ${rendered} options rendered`);
});

test('the header reports matched of total', () => {
  const features = [feature(0), feature(1)];
  const html = renderToStaticMarkup(
    createElement(ResultsRail, railProps({ features, total: RELEASE_SIZE })),
  );
  assert.match(html, /2 of 4,078/);
});

test('the meta line shows place, era and grade', () => {
  const html = renderToStaticMarkup(createElement(ResultsRail, railProps()));
  assert.match(html, /Birmingham, Alabama/);
  assert.match(html, /1950s/);
  assert.match(html, /Evidence grade A/);
});

test('an ungraded record says so rather than borrowing a letter', () => {
  const html = renderToStaticMarkup(
    createElement(
      ResultsRail,
      railProps({ features: [feature(0, { confidenceTier: 'unrated' })], total: 1 }),
    ),
  );
  assert.match(html, /Evidence not graded/);
  assert.equal(/Evidence grade [ABC]/.test(html), false);
});

test('an empty result set renders the teaching empty state, never a bare list', () => {
  const html = renderToStaticMarkup(
    createElement(
      ResultsRail,
      railProps({
        features: [],
        total: RELEASE_SIZE,
        emptyState: 'No records match this lens.',
      }),
    ),
  );
  assert.match(html, /No records match this lens\./);
  assert.equal(html.includes('role="option"'), false);
});
