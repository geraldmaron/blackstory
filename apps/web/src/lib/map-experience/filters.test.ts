/**
 * Confirms the filter/facet pure logic: opt-in filtering (never silently hides), and
 * facet-option counting/labeling.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExploreMapFeature } from './build-explore-map-source';
import {
  applyExploreFilters,
  buildExploreFacetOptions,
  DEFAULT_EXPLORE_FILTERS,
  filterFeaturesInBounds,
  sortFeaturesForList,
} from './filters';
import { kindFamilyFor } from './kind-encoding';

function feature(overrides: Partial<ExploreMapFeature['properties']>): ExploreMapFeature {
  const kind = overrides.kind ?? 'place';
  return {
    type: 'Feature',
    id: overrides.entityId ?? 'ent_test',
    geometry: { type: 'Point', coordinates: [-77, 38.9] },
    properties: {
      entityId: 'ent_test',
      href: '/entity/ent_test',
      kind,
      displayName: 'Test Place',
      oneLineStory: 'A test one-line story.',
      precision: 'city',
      geoPrecisionTier: 'locality',
      eraBuckets: ['1950s'],
      notabilityLabels: [],
      evidenceCount: 1,
      confidenceTier: 'medium',
      topicTags: ['education'],
      shade: '#C48A4A',
      glyph: 'circle',
      kindFamily: kindFamilyFor(kind),
      ...overrides,
    },
  };
}

test('the default filter state (all "all") returns every feature unfiltered', () => {
  const features = [feature({ entityId: 'a' }), feature({ entityId: 'b', kind: 'school' })];
  assert.equal(applyExploreFilters(features, DEFAULT_EXPLORE_FILTERS).length, 2);
});

test('kind/era/theme/tone/status/confidence filters are opt-in and compose with AND semantics', () => {
  const features = [
    feature({
      entityId: 'a',
      kind: 'place',
      eraBuckets: ['1950s'],
      topicTags: ['education'],
      confidenceTier: 'high',
      mapTone: 'plantation',
      status: 'historic',
    }),
    feature({
      entityId: 'b',
      kind: 'school',
      eraBuckets: ['1960s'],
      topicTags: ['freedmen'],
      confidenceTier: 'low',
      status: 'active',
    }),
  ];

  const placesOnly = applyExploreFilters(features, { ...DEFAULT_EXPLORE_FILTERS, kind: 'places' });
  assert.deepEqual(
    placesOnly.map((f) => f.properties.entityId).sort(),
    ['a', 'b'],
  );

  const legacyMicroKind = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    kind: 'school',
  });
  assert.deepEqual(
    legacyMicroKind.map((f) => f.properties.entityId),
    ['b'],
  );

  const eraAndTheme = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    era: '1950s',
    theme: 'education',
  });
  assert.deepEqual(
    eraAndTheme.map((f) => f.properties.entityId),
    ['a'],
  );

  const toneOnly = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    tone: 'plantation',
  });
  assert.deepEqual(
    toneOnly.map((f) => f.properties.entityId),
    ['a'],
  );

  const statusOnly = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    status: 'active',
  });
  assert.deepEqual(
    statusOnly.map((f) => f.properties.entityId),
    ['b'],
  );

  const noMatch = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    kind: 'place',
    era: '1960s',
  });
  assert.equal(noMatch.length, 0);
});

test('theme filter prefers topicIds over legacy topicTags (same as facet options)', () => {
  const features = [
    feature({
      entityId: 'ids-only',
      topicTags: [],
      topicIds: ['education'],
    }),
    feature({
      entityId: 'tags-only',
      topicTags: ['education'],
    }),
    feature({
      entityId: 'other',
      topicTags: ['freedmen'],
      topicIds: ['freedmen'],
    }),
  ];

  const filtered = applyExploreFilters(features, {
    ...DEFAULT_EXPLORE_FILTERS,
    theme: 'education',
  });
  assert.deepEqual(
    filtered.map((row) => row.properties.entityId).sort(),
    ['ids-only', 'tags-only'],
  );
});

test('facet options lead with an "All ___" option and count real occurrences', () => {
  const features = [
    feature({ entityId: 'a', kind: 'place', eraBuckets: ['1950s'], topicTags: ['hbcu'] }),
    feature({
      entityId: 'b',
      kind: 'place',
      eraBuckets: ['1950s', '1960s'],
      mapTone: 'massacre',
      status: 'historic',
      statePostalCode: 'SC',
      stateName: 'South Carolina',
    }),
    feature({ entityId: 'c', kind: 'school', eraBuckets: ['1960s'], status: 'active' }),
  ];

  const facets = buildExploreFacetOptions(features);
  assert.equal(facets.kind[0]!.value, 'all');
  assert.deepEqual(
    facets.kind.map((option) => option.value),
    ['all', 'places'],
  );
  const placesOption = facets.kind.find((option) => option.value === 'places');
  assert.match(placesOption!.label, /^Places \(3\)$/);

  // Era facet sorts chronologically, not alphabetically (1950s before 1960s).
  assert.deepEqual(
    facets.era.map((option) => option.value),
    ['all', '1950s', '1960s'],
  );

  const themeHbcu = facets.theme.find((option) => option.value === 'hbcu');
  assert.match(themeHbcu!.label, /HBCUs \(1\)/);

  assert.deepEqual(
    facets.tone.map((option) => option.value),
    ['all', 'massacre'],
  );
  assert.match(facets.tone[1]!.label, /Massacre/);

  assert.ok(facets.status.some((option) => option.value === 'active'));
  assert.ok(facets.state.some((option) => option.value === 'SC'));
  assert.match(facets.state.find((option) => option.value === 'SC')!.label, /South Carolina/);
});

test('sortFeaturesForList orders chronologically by earliest era, undated last, ties alphabetical', () => {
  const features = [
    feature({ entityId: 'undated', displayName: 'Undated Hall', eraBuckets: [] }),
    feature({ entityId: 'newer', displayName: 'Newer School', eraBuckets: ['1960s', '1970s'] }),
    feature({ entityId: 'older-b', displayName: 'Bethel Church', eraBuckets: ['1840s'] }),
    feature({
      entityId: 'older-a',
      displayName: 'Avery Institute',
      eraBuckets: ['1840s', '1900s'],
    }),
  ];
  assert.deepEqual(
    sortFeaturesForList(features).map((f) => f.properties.entityId),
    ['older-a', 'older-b', 'newer', 'undated'],
  );
  // Input order untouched (pure).
  assert.equal(features[0]!.properties.entityId, 'undated');
});

test('filterFeaturesInBounds keeps only points inside the live camera extent', () => {
  const features: ExploreMapFeature[] = [
    {
      ...feature({ entityId: 'dc' }),
      geometry: { type: 'Point', coordinates: [-77.04, 38.9] },
    },
    {
      ...feature({ entityId: 'nyc' }),
      geometry: { type: 'Point', coordinates: [-74.0, 40.7] },
    },
    {
      ...feature({ entityId: 'sf' }),
      geometry: { type: 'Point', coordinates: [-122.4, 37.8] },
    },
  ];

  const midAtlantic = filterFeaturesInBounds(features, {
    west: -80,
    south: 36,
    east: -70,
    north: 42,
  });
  assert.deepEqual(
    midAtlantic.map((f) => f.properties.entityId),
    ['dc', 'nyc'],
  );
});

test('filterFeaturesInBounds handles antimeridian-crossing extents', () => {
  const features: ExploreMapFeature[] = [
    {
      ...feature({ entityId: 'west' }),
      geometry: { type: 'Point', coordinates: [170, 0] },
    },
    {
      ...feature({ entityId: 'east' }),
      geometry: { type: 'Point', coordinates: [-170, 0] },
    },
    {
      ...feature({ entityId: 'other' }),
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  ];

  const wrapped = filterFeaturesInBounds(features, {
    west: 160,
    south: -10,
    east: -160,
    north: 10,
  });
  assert.deepEqual(wrapped.map((f) => f.properties.entityId).sort(), ['east', 'west']);
});
