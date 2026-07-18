/**
 * Confirms the filter/facet pure logic: opt-in filtering (never silently hides), and
 * facet-option counting/labeling.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature } from './build-explore-map-source';
import { applyExploreFilters, buildExploreFacetOptions, DEFAULT_EXPLORE_FILTERS, sortFeaturesForList } from './filters';

function feature(overrides: Partial<ExploreMapFeature['properties']>): ExploreMapFeature {
  return {
    type: 'Feature',
    id: overrides.entityId ?? 'ent_test',
    geometry: { type: 'Point', coordinates: [-77, 38.9] },
    properties: {
      entityId: 'ent_test',
      href: '/entity/ent_test',
      kind: 'place',
      displayName: 'Test Place',
      oneLineStory: 'A test one-line story.',
      precision: 'city',
      geoPrecisionTier: 'locality',
      eraBuckets: ['1950s'],
      notabilityLabels: [],
      evidenceCount: 1,
      confidenceTier: 'medium',
      topicTags: ['education'],
      ...overrides,
    },
  };
}

test('the default filter state (all "all") returns every feature unfiltered', () => {
  const features = [feature({ entityId: 'a' }), feature({ entityId: 'b', kind: 'school' })];
  assert.equal(applyExploreFilters(features, DEFAULT_EXPLORE_FILTERS).length, 2);
});

test('kind/era/theme/confidence filters are opt-in and compose with AND semantics', () => {
  const features = [
    feature({ entityId: 'a', kind: 'place', eraBuckets: ['1950s'], topicTags: ['education'], confidenceTier: 'high' }),
    feature({ entityId: 'b', kind: 'school', eraBuckets: ['1960s'], topicTags: ['freedmen'], confidenceTier: 'low' }),
  ];

  const kindOnly = applyExploreFilters(features, { ...DEFAULT_EXPLORE_FILTERS, kind: 'school' });
  assert.deepEqual(kindOnly.map((f) => f.properties.entityId), ['b']);

  const eraAndTheme = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    era: '1950s',
    theme: 'education',
  });
  assert.deepEqual(eraAndTheme.map((f) => f.properties.entityId), ['a']);

  const noMatch = applyExploreFilters(features, { ...DEFAULT_EXPLORE_FILTERS, kind: 'place', era: '1960s' });
  assert.equal(noMatch.length, 0);
});

test('facet options lead with an "All ___" option and count real occurrences', () => {
  const features = [
    feature({ entityId: 'a', kind: 'place', eraBuckets: ['1950s'] }),
    feature({ entityId: 'b', kind: 'place', eraBuckets: ['1950s', '1960s'] }),
    feature({ entityId: 'c', kind: 'school', eraBuckets: ['1960s'] }),
  ];

  const facets = buildExploreFacetOptions(features);
  assert.equal(facets.kind[0]!.value, 'all');
  assert.deepEqual(
    facets.kind.map((option) => option.value),
    ['all', 'place', 'school'],
  );
  const placeOption = facets.kind.find((option) => option.value === 'place');
  assert.match(placeOption!.label, /\(2\)/);

  // Era facet sorts chronologically, not alphabetically (1950s before 1960s).
  assert.deepEqual(
    facets.era.map((option) => option.value),
    ['all', '1950s', '1960s'],
  );
});

test('sortFeaturesForList orders chronologically by earliest era, undated last, ties alphabetical', () => {
  const features = [
    feature({ entityId: 'undated', displayName: 'Undated Hall', eraBuckets: [] }),
    feature({ entityId: 'newer', displayName: 'Newer School', eraBuckets: ['1960s', '1970s'] }),
    feature({ entityId: 'older-b', displayName: 'Bethel Church', eraBuckets: ['1840s'] }),
    feature({ entityId: 'older-a', displayName: 'Avery Institute', eraBuckets: ['1840s', '1900s'] }),
  ];
  assert.deepEqual(
    sortFeaturesForList(features).map((f) => f.properties.entityId),
    ['older-a', 'older-b', 'newer', 'undated'],
  );
  // Input order untouched (pure).
  assert.equal(features[0]!.properties.entityId, 'undated');
});
