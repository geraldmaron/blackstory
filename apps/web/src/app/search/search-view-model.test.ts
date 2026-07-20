/**
 * Unit tests for the search page's pure query-building result-shaping core.
 *
 * `SearchPage` itself is an async Server Component reading a `Promise<searchParams>`, which isn't
 * renderable outside a real Next.js request (no `renderToStaticMarkup` support for async
 * components no `next/navigation` runtime here). Per the test guidance, this file instead
 * exercises `buildSearchViewModel` and its small helpers directly the same logic the page's JSX
 * consumes, extracted so it's synchronously testable.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicSearchIndexDoc } from '@repo/domain';
import { getSnapshotSearchIndex } from '../../lib/search/snapshot-search-index';
import {
  buildFacetOptions,
  buildSearchPageHref,
  buildSearchViewModel,
  parseOffset,
  SEARCH_PAGE_SIZE,
  type SearchViewModel,
} from './search-view-model';

/** Minimal, type-complete `PublicSearchIndexDoc` fixture builder for synthetic index tests.  */
function fixtureDoc(
  overrides: Partial<PublicSearchIndexDoc> & Pick<PublicSearchIndexDoc, 'id' | 'displayName'>,
): PublicSearchIndexDoc {
  return {
    kind: 'place',
    nameLower: overrides.displayName.toLowerCase(),
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [],
    notabilityLabels: [],
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    relatedCount: 0,
    claimCount: 0,
    releaseId: 'test-release',
    ...overrides,
  };
}

test('q=laurence ranks the Paul Laurence Dunbar High School fixture first, matched on its name', () => {
  // Other seed entities' summaries also mention "Paul Laurence Dunbar High School" by its full
  // name (they are directly connected to it), so more than one record can match "laurence" — a
  // stronger displayName match still outranks a summary-only mention.
  const view = buildSearchViewModel({ q: 'laurence' }, getSnapshotSearchIndex());
  assert.ok(view.results.length >= 1);
  assert.equal(view.results[0]?.id, 'ent_dunbar_school_001');
  assert.equal(view.results[0]?.matchedOn, 'displayName');
  assert.match(view.results[0]?.matchedText ?? '', /Laurence/);
});

test('status=active narrows results to the status-bearing fixtures, excluding the statusless event', () => {
  const view = buildSearchViewModel({ status: 'active' }, getSnapshotSearchIndex());
  assert.equal(view.results.length, 3);
  assert.ok(view.results.every((result) => result.status === 'active'));
  assert.ok(!view.results.some((result) => result.id === 'ent_dc_landmark_listing_1975'));
});

test('a query with no matches renders the empty-state branch (results.length === 0)', () => {
  const view = buildSearchViewModel({ q: 'xyzzy-no-such-record' }, getSnapshotSearchIndex());
  assert.equal(view.results.length, 0);
  assert.equal(view.totalMatched, 0);
});

test('facet option lists are built from real counts, not a hardcoded vocabulary', () => {
  const index = [
    fixtureDoc({ id: 'p1', displayName: 'Place One', kind: 'place' }),
    fixtureDoc({ id: 'p2', displayName: 'Place Two', kind: 'place' }),
    fixtureDoc({ id: 'p3', displayName: 'Place Three', kind: 'place' }),
    fixtureDoc({ id: 's1', displayName: 'School One', kind: 'school' }),
    fixtureDoc({ id: 's2', displayName: 'School Two', kind: 'school' }),
  ];
  const view = buildSearchViewModel({}, index);
  assert.deepEqual(view.kindOptions, [
    { value: 'all', label: 'All kinds' },
    { value: 'place', label: 'Place (3)' },
    { value: 'school', label: 'School (2)' },
  ]);
});

test('a facet dimension with zero keys renders only the "All ___" option, not an empty select', () => {
  const index = [
    fixtureDoc({ id: 'p1', displayName: 'No Status Place' }),
    fixtureDoc({ id: 'p2', displayName: 'Another No Status Place' }),
  ];
  const view = buildSearchViewModel({}, index);
  assert.deepEqual(view.statusOptions, [{ value: 'all', label: 'All statuses' }]);
});

test('buildFacetOptions humanizes underscore/hyphen keys and appends the count', () => {
  assert.deepEqual(buildFacetOptions({ in_force: 4, 'multi-word-key': 1 }, 'All'), [
    { value: 'all', label: 'All' },
    { value: 'in_force', label: 'In Force (4)' },
    { value: 'multi-word-key', label: 'Multi Word Key (1)' },
  ]);
});

test('offset pagination advances by SEARCH_PAGE_SIZE and exposes previous/next offsets correctly', () => {
  const totalDocs = SEARCH_PAGE_SIZE + 5;
  const index = Array.from({ length: totalDocs }, (_, i) =>
    fixtureDoc({ id: `doc_${String(i).padStart(2, '0')}`, displayName: `Doc ${i}` }),
  );

  const firstPage = buildSearchViewModel({}, index);
  assert.equal(firstPage.totalMatched, totalDocs);
  assert.equal(firstPage.results.length, SEARCH_PAGE_SIZE);
  assert.equal(firstPage.hasMore, true);
  assert.equal(firstPage.nextOffset, SEARCH_PAGE_SIZE);
  assert.equal(firstPage.previousOffset, undefined);

  const secondPage = buildSearchViewModel({ offset: String(SEARCH_PAGE_SIZE) }, index);
  assert.equal(secondPage.results.length, 5);
  assert.equal(secondPage.hasMore, false);
  assert.equal(secondPage.nextOffset, undefined);
  assert.equal(secondPage.previousOffset, 0);
});

test('parseOffset clamps negative, non-numeric, and missing values to 0', () => {
  assert.equal(parseOffset(undefined), 0);
  assert.equal(parseOffset(''), 0);
  assert.equal(parseOffset('not-a-number'), 0);
  assert.equal(parseOffset('-5'), 0);
  assert.equal(parseOffset('40'), 40);
});

test('buildSearchPageHref preserves current filters and only overrides offset', () => {
  const view: SearchViewModel = {
    q: 'dunbar school',
    kind: 'school',
    status: 'all',
    era: '1890s',
    offset: 20,
    results: [],
    totalMatched: 0,
    hasMore: false,
    kindOptions: [],
    statusOptions: [],
    eraOptions: [],
    recommendations: [],
  };
  const href = buildSearchPageHref(view, 40);
  const url = new URL(href, 'https://example.test');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('q'), 'dunbar school');
  assert.equal(url.searchParams.get('kind'), 'school');
  assert.equal(url.searchParams.get('status'), null);
  assert.equal(url.searchParams.get('era'), '1890s');
  assert.equal(url.searchParams.get('offset'), '40');
});

test('buildSearchPageHref omits the offset param entirely for offset 0 (clean first-page URL)', () => {
  const view: SearchViewModel = {
    q: '',
    kind: 'all',
    status: 'all',
    era: 'all',
    offset: 20,
    results: [],
    totalMatched: 0,
    hasMore: false,
    kindOptions: [],
    statusOptions: [],
    eraOptions: [],
    recommendations: [],
  };
  assert.equal(buildSearchPageHref(view, 0), '/search');
});

test('zero-result queries expose catalog recommendations from the index', () => {
  const index = [
    fixtureDoc({ id: 'p1', displayName: 'Harlem', relatedCount: 4 }),
    fixtureDoc({ id: 'p2', displayName: 'Sweet Auburn', relatedCount: 2 }),
  ];
  const view = buildSearchViewModel({ q: 'xyzzy-no-such-record' }, index);
  assert.equal(view.totalMatched, 0);
  assert.ok(view.recommendations.length >= 1);
  assert.equal(view.recommendations[0]?.id, 'p1');
});
