/**
 * Confirms the chapter-2 draw refuses the records it must refuse. The chapter pushes in close and
 * dwells, so a violence-adjacent record must never be eligible — the camera gate limits the move
 * but cannot decline the framing, which is what this picker is for.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eligibleStoryRecords, pickStoryRecord } from './pick-story-record';
import type { ExploreMapFeature } from '../map-experience/build-explore-map-source';

function feature(
  properties: Partial<ExploreMapFeature['properties']> & { readonly entityId: string },
): ExploreMapFeature {
  return {
    type: 'Feature',
    id: properties.entityId,
    geometry: { type: 'Point', coordinates: [-86.8, 33.5] },
    properties: {
      href: `/entity/${properties.entityId}`,
      kind: 'place',
      displayName: properties.entityId,
      oneLineStory: 'A published one-line story.',
      precision: 'city',
      geoPrecisionTier: 'city',
      eraBuckets: ['1950s'],
      notabilityLabels: [],
      evidenceCount: 3,
      confidenceTier: 'high',
      topicTags: [],
      shade: '#000000',
      glyph: 'dot',
      kindFamily: 'place',
      locationLabel: 'Birmingham, Alabama',
      ...properties,
    } as ExploreMapFeature['properties'],
  };
}

test('a lynching record is never the record the story pushes in on', () => {
  const features = [
    feature({ entityId: 'lynching', topicIds: ['racial-terror-lynching'] }),
    feature({ entityId: 'school', topicIds: ['education'] }),
  ];
  const eligible = eligibleStoryRecords(features);
  assert.deepEqual(
    eligible.map((entry) => entry.properties.entityId),
    ['school'],
  );
});

test('massacre and plantation tones are refused the same way', () => {
  const features = [
    feature({ entityId: 'massacre', mapTone: 'massacre' }),
    feature({ entityId: 'plantation', mapTone: 'plantation' }),
    feature({ entityId: 'epicenter', mapTone: 'epicenter' }),
  ];
  // `epicenter` encodes presence, not harm, so it stays eligible — the same split camera-dignity
  // makes for camera moves.
  assert.deepEqual(
    eligibleStoryRecords(features).map((entry) => entry.properties.entityId),
    ['epicenter'],
  );
});

test('a record with no published place is refused, because the chapter names a place', () => {
  const features = [
    feature({ entityId: 'placeless', locationLabel: undefined as never }),
    feature({ entityId: 'placed' }),
  ];
  assert.deepEqual(
    eligibleStoryRecords(features).map((entry) => entry.properties.entityId),
    ['placed'],
  );
});

test('a record with no evidence and a record with no summary are both refused', () => {
  const features = [
    feature({ entityId: 'unevidenced', evidenceCount: 0 }),
    feature({ entityId: 'silent', oneLineStory: '' }),
    feature({ entityId: 'good' }),
  ];
  assert.deepEqual(
    eligibleStoryRecords(features).map((entry) => entry.properties.entityId),
    ['good'],
  );
});

test('the draw carries the record own published fields, not a written description', () => {
  const spotlight = pickStoryRecord(
    [
      feature({
        entityId: 'ent_dunbar',
        displayName: 'Dunbar High School',
        locationLabel: 'Washington, D.C.',
        eraBuckets: ['1870s'],
        oneLineStory: 'The first public high school for Black students in the country.',
        evidenceCount: 5,
      }),
    ],
    0,
  );
  assert.ok(spotlight);
  assert.equal(spotlight.entityId, 'ent_dunbar');
  assert.equal(spotlight.name, 'Dunbar High School');
  assert.equal(spotlight.place, 'Washington, D.C.');
  assert.equal(spotlight.era, '1870s');
  assert.equal(spotlight.evidenceCount, 5);
});

test('the draw reaches every eligible record and survives a bad roll', () => {
  const features = Array.from({ length: 8 }, (_, index) => feature({ entityId: `ent_${index}` }));
  const seen = new Set<string>();
  for (let i = 0; i < 80; i += 1) seen.add(pickStoryRecord(features, i / 80)!.entityId);
  assert.equal(seen.size, 8);

  assert.ok(pickStoryRecord(features, 1));
  assert.ok(pickStoryRecord(features, Number.NaN));
});

test('a release with nothing eligible returns null rather than an unusable record', () => {
  assert.equal(pickStoryRecord([], 0.5), null);
  assert.equal(pickStoryRecord([feature({ entityId: 'x', mapTone: 'massacre' })], 0.5), null);
});
