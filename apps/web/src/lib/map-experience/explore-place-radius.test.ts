/**
 * Unit tests for explore place-search radius presets and nearest-record helpers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExploreMapFeature } from './build-explore-map-source';
import {
  closestFeatures,
  emptyRadiusStatusMessage,
  exploreRadiusPresetById,
  featuresWithinRadius,
  formatExploreDistance,
  isUnlimitedRadius,
  mapBoundsForRadius,
  matchesRadiusStatusMessage,
  placeOnlyStatusMessage,
} from './explore-place-radius';

function pointFeature(
  id: string,
  lng: number,
  lat: number,
  name = id,
): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      entityId: id,
      href: `/entity/${id}`,
      kind: 'place',
      displayName: name,
      oneLineStory: 'Test',
      precision: 'locality',
      geoPrecisionTier: 'locality',
      eraBuckets: [],
      notabilityLabels: [],
      evidenceCount: 1,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#C48A4A',
      glyph: 'circle',
    },
  };
}

test('default radius is All (unlimited)', () => {
  const preset = exploreRadiusPresetById('not-a-preset');
  assert.equal(preset.id, 'all');
  assert.equal(preset.meters, null);
  assert.equal(isUnlimitedRadius(preset), true);
});

test('featuresWithinRadius keeps only points inside the circle, nearest first', () => {
  const center = { lat: 38.9, lng: -77.0 };
  const near = pointFeature('near', -77.01, 38.91, 'Near');
  const far = pointFeature('far', -80.0, 40.0, 'Far');
  const ranked = featuresWithinRadius([far, near], center, 20_000);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]!.feature.properties.entityId, 'near');
});

test('closestFeatures returns nearest neighbors even outside the search radius', () => {
  const center = { lat: 38.9, lng: -77.0 };
  const a = pointFeature('a', -77.05, 38.9);
  const b = pointFeature('b', -77.2, 38.9);
  const c = pointFeature('c', -78.0, 38.9);
  const closest = closestFeatures([c, a, b], center, 2);
  assert.deepEqual(
    closest.map((row) => row.feature.properties.entityId),
    ['a', 'b'],
  );
});

test('mapBoundsForRadius is centered on the search point', () => {
  const [west, south, east, north] = mapBoundsForRadius({ lat: 40, lng: -75 }, 10_000);
  assert.ok(west < -75 && east > -75);
  assert.ok(south < 40 && north > 40);
});

test('formatExploreDistance uses miles for longer spans', () => {
  assert.match(formatExploreDistance(1609), /mi away/);
  assert.match(formatExploreDistance(50), /nearby|m away/);
});

test('status copy distinguishes All from finite radius empties', () => {
  assert.match(placeOnlyStatusMessage('Tulsa'), /Centered on Tulsa/);
  assert.match(
    emptyRadiusStatusMessage({ placeLabel: 'Tulsa', radiusLabel: '5 miles' }),
    /Nothing documented within 5 miles of Tulsa/,
  );
  assert.equal(
    matchesRadiusStatusMessage({ count: 1, placeLabel: 'Tulsa', radiusLabel: '5 miles' }),
    '1 documented record within 5 miles of Tulsa.',
  );
});
