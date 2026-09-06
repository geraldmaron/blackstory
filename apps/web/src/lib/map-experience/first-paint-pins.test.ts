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
  DOOR_MOBILE_NATIONAL_PIN_CAP,
  firstPaintWalksFirst,
  isFirstPaintWalk,
  resolveDoorPinTarget,
  resolveDoorFocusPinId,
  thinDoorNationalPins,
  toDoorLinkPins,
  toFirstPaintPins,
  toFirstPaintShell,
} from './first-paint-pins';
import { conusPinPercent } from './conus-mercator';
import type { ExploreMapFeature } from './build-explore-map-source';

function leakyFeature(
  overrides: Partial<ExploreMapFeature['properties']> = {},
  coordinates: [number, number] = [-80.14, 26.12],
): ExploreMapFeature {
  return {
    type: 'Feature',
    id: '42Cb1758',
    geometry: { type: 'Point', coordinates },
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

test('thinDoorNationalPins caps dense metros and balances regions', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const dense = Array.from({ length: 500 }, (_, index) =>
    leakyFeature({
      displayName: `Place ${index}`,
      href: `/door/pin/pin-${index}`,
      entityId: `pin-${index}`,
    }),
  );
  dense[0] = leakyFeature({
    displayName: 'Dillard High School, Old',
    href: '/place/dillard-high-school-old',
    entityId: 'nrhp-black-heritage-91000107',
  });
  const pins = toDoorLinkPins([...source.featureCollection.features, ...dense]);
  const thinned = thinDoorNationalPins(pins, { cap: 80 });
  assert.ok(thinned.features.length <= 80);
  assert.ok(thinned.features.length < pins.features.length);
  assert.ok(thinned.features.some((feature) => isFirstPaintWalk(feature)));
  assert.equal(DOOR_MOBILE_NATIONAL_PIN_CAP, 48);
});

test('thinDoorNationalPins keeps chapter focus and spreads west pins on a dense eastern field', () => {
  const focus = leakyFeature(
    {
      displayName: 'Howard Theatre',
      href: '/entity/ent_focus_theatre',
      entityId: 'ent_focus_theatre',
    },
    [-77.02, 38.92],
  );

  const dense: ExploreMapFeature[] = [focus];
  for (let lat = 30; lat <= 44; lat += 1.4) {
    for (let lng = -124; lng <= -75; lng += 2.6) {
      const side = lng < -102 ? 'west' : lng >= -90 ? 'east' : 'central';
      dense.push(
        leakyFeature(
          {
            displayName: `${side} heritage site ${lat}-${lng}`,
            href: `/entity/ent_${side}_${lat}_${lng}`,
            entityId: `ent_${side}_${lat}_${lng}`,
          },
          [lng, lat],
        ),
      );
    }
  }

  const pins = toDoorLinkPins(dense);
  const thinned = thinDoorNationalPins(pins, {
    focusEntityId: resolveDoorFocusPinId('ent_focus_theatre', dense),
  });
  assert.ok(thinned.features.length <= DOOR_MOBILE_NATIONAL_PIN_CAP);
  assert.ok(thinned.features.some((feature) => feature.properties.entityId === 'pin-0'));
  const westPins = thinned.features.filter((feature) => feature.geometry.coordinates[0] < -102);
  assert.ok(westPins.length >= 8);
});

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
  assert.doesNotMatch(plate, /ds-map-entity-marker/);
  assert.equal(pins.features[0]!.properties.displayName, '');
  assert.equal(pins.features[0]!.properties.href, '');
  assert.equal(pins.features[1]!.properties.displayName, 'Dillard High School, Old');
  assert.equal(pins.features[1]!.properties.href, '/place/dillard-high-school-old');
});

test('Door link pins expose public hrefs and opaque entity redirects', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const entityOnly = leakyFeature({
    displayName: 'Howard Theatre',
    href: '/entity/ent_howard_theatre_001',
    entityId: 'ent_howard_theatre_001',
    kind: 'place',
  });
  const features = [...source.featureCollection.features, entityOnly];
  const pins = toDoorLinkPins(features);
  // The Door hands these to the live plate: a marker click opens the pin's href (repo-18ma2).
  const walkCount = pins.features.filter(
    (feature) => feature.properties.holdingWalk === true,
  ).length;
  const linkCount = pins.features.filter((feature) => feature.properties.href.length > 0).length;
  assert.ok(linkCount > walkCount);
  assert.ok(walkCount > 0);
  assert.ok(pins.features.every((feature) => !feature.properties.href.startsWith('/entity/')));

  const target = resolveDoorPinTarget('pin-4', features);
  assert.equal(target, '/entity/ent_howard_theatre_001');
  assert.equal(pins.features[4]!.properties.href, '/door/pin/pin-4');
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
  const pinDiscs = plate.match(/ds-first-paint-pin(?!-)/g) ?? [];
  const anchors = plate.match(/<a\b/g) ?? [];
  assert.ok(pinDiscs.length > 0);
  assert.ok(pinDiscs.length <= pins.features.length);
  assert.doesNotMatch(plate, /ds-map-entity-marker/);
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
  assert.match(plate, /data-lng="/);
  assert.match(plate, /data-lat="/);
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

test('the first-paint projection keeps a Florida pin on the board and inside the plate frame', () => {
  // Web Mercator over the CONUS bounds box (conus-mercator.ts): the plate's own projection.
  const keys = conusPinPercent(-81.8, 24.55);
  assert.ok(keys);
  assert.ok(keys.x > 70 && keys.x < 80, String(keys.x));
  assert.ok(keys.y > 95 && keys.y <= 100, String(keys.y));
  // Alaska is off the plate's opening frame, so it is off the board — not pinned to an edge.
  assert.equal(conusPinPercent(-149.9, 61.2), null);
});

test('first-paint plate projects pins with Albers locator percents, not CONUS clamp', () => {
  const pins = toFirstPaintPins([
    leakyFeature({
      displayName: 'Dillard High School, Old',
      href: '/place/dillard-high-school-old',
      entityId: 'nrhp-black-heritage-91000107',
    }),
  ]);
  const plate = renderToStaticMarkup(createElement(FirstPaintPinPlate, { pins }));
  assert.match(plate, /left:\s*[\d.]+%/);
  assert.match(plate, /top:\s*[\d.]+%/);

  // Liberia is outside Albers USA — must not clamp onto the board edge.
  const offshoreFeature = leakyFeature(
    {
      displayName: '',
      href: '',
      entityId: 'pin-offshore',
    },
    [-9.4, 6.3],
  );
  const offshore = toFirstPaintPins([offshoreFeature]);
  const empty = renderToStaticMarkup(createElement(FirstPaintPinPlate, { pins: offshore }));
  assert.doesNotMatch(empty, /ds-first-paint-pin/);
});
