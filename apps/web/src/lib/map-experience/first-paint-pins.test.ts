/**
 * First-paint pins may carry geography and a public name. They may not print
 * shop tokens. This is the sit Nova failed: the FeatureCollection on `/`
 * still shipped `42Cb1758`, Grade A, and `ent_` ids.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { atlasWalkHref } from '../place/public-place-path';
import { buildExploreMapSource } from './build-explore-map-source';
import { firstPaintWalksFirst, toFirstPaintPins, toFirstPaintShell } from './first-paint-pins';
import type { ExploreMapFeature } from './build-explore-map-source';

function leakyFeature(overrides: Partial<ExploreMapFeature['properties']> = {}): ExploreMapFeature {
  return {
    type: 'Feature',
    id: '42Cb1758',
    geometry: { type: 'Point', coordinates: [-80.14, 26.12] },
    properties: {
      entityId: 'ent_leaky_001',
      href: '/entity/ent_leaky_001',
      kind: 'place',
      displayName: '42Cb1758',
      oneLineStory: 'Grade A · 2 sources. An opaque catalog token.',
      precision: 'city',
      geoPrecisionTier: 'locality',
      eraBuckets: ['1950s'],
      evidenceCount: 2,
      confidenceTier: 'high',
      topicTags: ['ent_topic'],
      shade: '#6D675F',
      glyph: 'place',
      kindFamily: 'place',
      locationLabel: 'Fort Lauderdale, Florida',
      ...overrides,
    },
  };
}

test('first-paint pins drop shop tokens from anything that would ship in the first HTML', () => {
  const pins = toFirstPaintPins([
    leakyFeature(),
    leakyFeature({
      displayName: 'Old Dillard High School',
      href: '/place/dillard-high-school-old',
      entityId: 'nrhp-black-heritage-91000107',
    }),
  ]);
  const document = JSON.stringify(pins);
  assert.doesNotMatch(document, /42Cb1758/);
  assert.doesNotMatch(document, /Grade A/);
  assert.doesNotMatch(document, /ent_/);
  assert.doesNotMatch(document, /\/entity\//);
  assert.equal(pins.features.length, 2);
  assert.equal(pins.features[0]!.properties.displayName, '');
  assert.equal(pins.features[0]!.properties.href, '');
  assert.equal(pins.features[1]!.properties.displayName, 'Old Dillard High School');
  assert.equal(pins.features[1]!.properties.href, '/place/dillard-high-school-old');
  assert.match(pins.features[0]!.id.toString(), /^pin-\d+$/);
  assert.match(pins.features[0]!.properties.entityId, /^pin-\d+$/);
});

test('the seed plate stays a plate of pins; only holding slugs walk', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const pins = toFirstPaintPins(source.featureCollection.features);
  assert.ok(pins.features.length > 0);
  assert.equal(pins.features.length, source.featureCollection.features.length);
  const document = JSON.stringify(pins);
  assert.doesNotMatch(document, /42Cb1758/);
  assert.doesNotMatch(document, /Grade A/);
  assert.doesNotMatch(document, /ent_/);
  const walks = firstPaintWalksFirst(pins).filter((feature) =>
    feature.properties.href.startsWith('/place/'),
  );
  assert.ok(walks.length > 0);
  for (const walk of walks) {
    assert.match(walk.properties.href, /^\/place\//);
    assert.ok(walk.properties.displayName.length > 0);
    assert.doesNotMatch(walk.properties.href, /dillard-university|dillard-house/);
  }
});

test('Dillard University and the house do not walk; Old Dillard High School does', () => {
  assert.equal(
    atlasWalkHref({
      displayName: 'Dillard High School, Old',
      kind: 'place',
      entityId: 'nrhp-black-heritage-91000107',
    }),
    '/place/dillard-high-school-old',
  );
  assert.equal(atlasWalkHref({ displayName: 'Dillard University', kind: 'place' }), undefined);
  assert.equal(
    atlasWalkHref({ displayName: 'James H. Dillard House', kind: 'place' }),
    undefined,
  );
});

test('the first-paint shell drops an internal selected id', () => {
  const cleaned = toFirstPaintShell({
    viewState: { selected: 'ent_dunbar_school_001' },
    totalMatched: 4101,
  });
  const document = JSON.stringify(cleaned);
  assert.doesNotMatch(document, /ent_/);
  assert.equal(cleaned.viewState.selected, undefined);
  assert.equal(cleaned.totalMatched, 4101);
});
