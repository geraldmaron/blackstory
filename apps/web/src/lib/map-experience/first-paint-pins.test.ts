/**
 * First-paint pins may carry geography and a public name. They may not print
 * shop tokens. Verity and Atlas locked two fails; these tests refuse to swap them.
 *
 * Fail 1: `42Cb1758`, Grade A, and `ent_` must not ride the first document.
 * Fail 2: a typed `/place/` list is a sit set, not the plate. A pin scores
 * when it is on first paint and the record it opens holds.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { FirstPaintPinPlate } from '../../app/first-paint-pin-plate';
import { listPublicEntities } from '../../data/public-seed';
import { atlasWalkHref, isHoldingPlaceHref } from '../place/public-place-path';
import { buildExploreMapSource } from './build-explore-map-source';
import {
  conusPinPercent,
  firstPaintWalksFirst,
  isFirstPaintWalk,
  toFirstPaintPins,
  toFirstPaintShell,
} from './first-paint-pins';
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

function leakyShell() {
  return {
    viewState: { selected: 'ent_leaky_001', q: '42Cb1758' },
    facetOptions: {
      kind: [{ value: 'place', label: '42Cb1758 (1)' }],
      tone: [],
      era: [{ value: '1950s', label: 'Grade A · 1950s' }],
      theme: [{ value: 'ent_topic', label: 'ent_topic' }],
      status: [],
      confidence: [{ value: 'high', label: 'Grade A' }],
      state: [],
    },
    entityDecades: [{ decade: '1950s', count: 1 }],
    totalMatched: 4101,
  };
}

function firstPaintDocument(
  pins: ReturnType<typeof toFirstPaintPins>,
  shell: ReturnType<typeof leakyShell> | ReturnType<typeof toFirstPaintShell>,
): { readonly document: string; readonly plate: string } {
  const plate = renderToStaticMarkup(createElement(FirstPaintPinPlate, { pins }));
  return {
    plate,
    document: `${JSON.stringify(shell)}${JSON.stringify(pins)}${plate}`,
  };
}

test('fail 1: shop tokens are gone from the first document, and a holding walk still sits on the plate', () => {
  const pins = toFirstPaintPins([
    leakyFeature(),
    leakyFeature({
      displayName: 'Dillard High School, Old',
      href: '/place/dillard-high-school-old',
      entityId: 'nrhp-black-heritage-91000107',
    }),
  ]);
  const shell = toFirstPaintShell(leakyShell());
  const { document, plate } = firstPaintDocument(pins, shell);
  assert.doesNotMatch(document, /42Cb1758/);
  assert.doesNotMatch(document, /Grade A/);
  assert.doesNotMatch(document, /ent_/);
  assert.doesNotMatch(document, /\/entity\//);
  assert.match(plate, /href="\/place\/dillard-high-school-old"/);
  assert.match(plate, /ds-first-paint-pin--walk/);
  assert.equal(pins.features[0]!.properties.displayName, '');
  assert.equal(pins.features[0]!.properties.href, '');
  assert.equal(pins.features[1]!.properties.displayName, 'Dillard High School, Old');
  assert.equal(pins.features[1]!.properties.href, '/place/dillard-high-school-old');
});

test('fail 2: only holding /place/ pins are links; the rest of the plate is not a sit set', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const pins = toFirstPaintPins([
    ...source.featureCollection.features,
    leakyFeature({
      displayName: 'Dillard University',
      href: '/place/dillard-university',
      entityId: 'nrhp-not-a-walk',
    }),
    leakyFeature({
      displayName: 'A named neighbor',
      href: '',
    }),
  ]);
  const holding = pins.features.filter((feature) => isFirstPaintWalk(feature));
  const plate = renderToStaticMarkup(createElement(FirstPaintPinPlate, { pins }));
  const walkHrefs = [...plate.matchAll(/href="(\/place\/[^"]+)"/g)].map((match) => match[1]);
  const pinDiscs = plate.match(/ds-map-entity-marker/g) ?? [];
  const anchors = plate.match(/<a\b/g) ?? [];
  assert.equal(pinDiscs.length, pins.features.length);
  assert.ok(pins.features.length > holding.length);
  assert.equal(walkHrefs.length, holding.length);
  assert.equal(anchors.length, holding.length);
  for (const href of walkHrefs) {
    assert.equal(isHoldingPlaceHref(href ?? ''), true);
    assert.doesNotMatch(href ?? '', /dillard-university|dillard-house|42Cb1758/);
  }
  assert.doesNotMatch(plate, /<ul\b/);
  assert.doesNotMatch(plate, /<noscript\b/);
  assert.doesNotMatch(plate, /42Cb1758|Grade A|ent_/);
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
  const walks = firstPaintWalksFirst(pins).filter((feature) => isFirstPaintWalk(feature));
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
  assert.equal(atlasWalkHref({ displayName: 'James H. Dillard House', kind: 'place' }), undefined);
});

test('the first-paint shell drops shop tokens, including leftover facet labels', () => {
  const cleaned = toFirstPaintShell(leakyShell());
  const document = JSON.stringify(cleaned);
  assert.doesNotMatch(document, /ent_/);
  assert.doesNotMatch(document, /42Cb1758/);
  assert.doesNotMatch(document, /Grade A/);
  assert.equal(cleaned.viewState.selected, undefined);
  assert.equal(cleaned.totalMatched, 4101);
});

test('CONUS projection keeps a Florida pin on the plate', () => {
  const { left, top } = conusPinPercent(-80.14, 26.12);
  assert.ok(left > 50 && left < 100);
  assert.ok(top > 50 && top < 100);
});
