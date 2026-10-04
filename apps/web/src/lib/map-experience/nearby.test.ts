import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExploreMapFeature } from './build-explore-map-source';
import { kindFamilyFor } from './kind-encoding';
import {
  applyNearbyRadius,
  distanceLabel,
  nearbyConstraintLabel,
  nearbyDistances,
  nearbyFrame,
  nearbySummary,
  nearestDistance,
  sortByDistance,
  type NearbyArea,
} from './nearby';

function point(id: string, lng: number, lat: number): ExploreMapFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      entityId: id,
      href: `/entity/${id}`,
      kind: 'place',
      displayName: id,
      oneLineStory: 'Test',
      precision: 'locality',
      geoPrecisionTier: 'locality',
      eraBuckets: [],
      evidenceCount: 1,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#C48A4A',
      glyph: 'circle',
      kindFamily: kindFamilyFor('place'),
    },
  };
}

const downtown = { lat: 33.7537, lng: -84.3863 };
const features = [
  point('dc', -77.0143, 38.9098),
  point('auburn', -84.3797, 33.7543), // ~0.4 mi
  point('auc', -84.4143, 33.7493), // ~1.6 mi
  point('macon', -83.6324, 32.8407), // ~75 mi
];
const device = (radiusMeters: number | null, radiusLabel?: string): NearbyArea => ({
  center: downtown,
  label: 'your location',
  source: 'device',
  radiusMeters,
  ...(radiusLabel ? { radiusLabel } : {}),
});

test('distances are computed per entity and sorting puts the nearest first', () => {
  const distances = nearbyDistances(features, downtown);
  assert.equal(distances.size, 4);
  assert.deepEqual(
    sortByDistance(features, distances).map((f) => f.properties.entityId),
    ['auburn', 'auc', 'macon', 'dc'],
  );
  const auburn = distances.get('auburn') ?? 0;
  assert.ok(auburn > 500 && auburn < 800, `auburn ~0.4mi, got ${auburn}`);
});

test('no radius keeps everything; a radius keeps only what is inside it', () => {
  const distances = nearbyDistances(features, downtown);
  assert.equal(applyNearbyRadius(features, device(null), distances).length, 4);
  assert.equal(applyNearbyRadius(features, null, distances).length, 4);
  const fiveMiles = applyNearbyRadius(features, device(8047, '5 miles'), distances);
  assert.deepEqual(fiveMiles.map((f) => f.properties.entityId).sort(), ['auburn', 'auc']);
});

test('locating the device lands at street level on you, not zoomed out to far records', () => {
  const frame = nearbyFrame({ ...device(null), accuracyMeters: 20 }, features);
  assert.equal(frame.kind, 'center');
  if (frame.kind !== 'center') return;
  assert.deepEqual(frame.center, [downtown.lng, downtown.lat]);
  assert.equal(frame.zoom, 15);
});

test('a loose device fix frames its accuracy circle instead of faking street precision', () => {
  const frame = nearbyFrame({ ...device(null), accuracyMeters: 1200 }, features);
  assert.equal(frame.kind, 'bounds');
});

test('a searched place centres at neighbourhood scale', () => {
  const frame = nearbyFrame(
    { ...device(null), source: 'search', label: 'Macon, Georgia' },
    features,
  );
  assert.equal(frame.kind, 'center');
  if (frame.kind === 'center') assert.equal(frame.zoom, 13);
});

test('frame with a radius fits the circle', () => {
  const frame = nearbyFrame(device(8047, '5 miles'), features);
  assert.equal(frame.kind, 'bounds');
  assert.equal(frame.label, '5 miles of your location');
});

test('labels read like a person wrote them', () => {
  assert.equal(nearbyConstraintLabel(device(null)), 'Near you');
  assert.equal(nearbyConstraintLabel(device(8047, '5 miles')), 'Within 5 miles of you');
  assert.equal(
    nearbyConstraintLabel({ ...device(null), source: 'search', label: 'Macon, Georgia' }),
    'Near Macon, Georgia',
  );
  assert.equal(distanceLabel(650), '0.4 mi');
  assert.equal(distanceLabel(undefined), null);
  assert.equal(nearbySummary(device(null), 4, 650), 'Showing records nearest you.');
  assert.match(nearbySummary(device(null), 4, 200_000), /nearest record is 124 mi away/);
  assert.match(nearbySummary(device(null), 4, 3_000), /nearest record is 1\.9 mi away/);
  assert.equal(nearbySummary(device(8047, '5 miles'), 2, 650), '2 records within 5 miles of you.');
});

test('nearest distance reads only the given features', () => {
  const distances = nearbyDistances(features, downtown);
  const far = features.filter((f) => ['macon', 'dc'].includes(f.properties.entityId));
  const nearest = nearestDistance(far, distances) ?? 0;
  assert.ok(nearest > 100_000 && nearest < 140_000, `macon ~75mi, got ${nearest}`);
  assert.equal(nearestDistance([], distances), undefined);
});
