/**
 * Door pin plate cache and opaque redirect resolution.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listPublicEntities } from '../../data/public-seed';
import { NEXT_DATA_CACHE_SAFE_BYTES } from '../public-data/live-catalog-cache';
import { buildExploreMapSource } from './build-explore-map-source';
import {
  DOOR_CATALOG_REVALIDATE_SECONDS,
  DOOR_PIN_REDIRECT_CACHE_CONTROL,
  doorRedirectTableCacheShapeForTest,
} from './door-catalog';
import { firstPaintPinId, resolveDoorPinTarget } from './first-paint-pins';

const pinRoute = readFileSync(
  fileURLToPath(new URL('../../app/door/pin/[pinId]/route.ts', import.meta.url)),
  'utf8',
);
const doorHome = readFileSync(
  fileURLToPath(new URL('../../app/door-home.tsx', import.meta.url)),
  'utf8',
);
const homePage = readFileSync(
  fileURLToPath(new URL('../../app/page.tsx', import.meta.url)),
  'utf8',
);
const catalogSource = readFileSync(
  fileURLToPath(new URL('./door-catalog.ts', import.meta.url)),
  'utf8',
);

test('door catalog uses cross-request cache with release-aligned TTL', () => {
  assert.match(catalogSource, /unstable_cache/);
  assert.match(catalogSource, /loadDoorPinPlate/);
  assert.match(catalogSource, /createLiveCatalogMemoryCache/);
  assert.equal(DOOR_CATALOG_REVALIDATE_SECONDS, 1_800);
  assert.match(DOOR_PIN_REDIRECT_CACHE_CONTROL, /\bpublic\b/);
  assert.match(DOOR_PIN_REDIRECT_CACHE_CONTROL, /s-maxage=\d+/);
  assert.doesNotMatch(DOOR_PIN_REDIRECT_CACHE_CONTROL, /no-store|private/);
});

test('door redirect table fits Next data cache; full pin plate does not ride unstable_cache', () => {
  const { table, bytes, fitsNext } = doorRedirectTableCacheShapeForTest(listPublicEntities());
  assert.ok(table.pinRedirects.length > 0);
  assert.ok(
    fitsNext,
    `redirect table ${bytes} bytes must stay under ${NEXT_DATA_CACHE_SAFE_BYTES}`,
  );
  assert.match(catalogSource, /buildRedirectTableOnly\(plate\)/);
  assert.match(catalogSource, /return redirectTable;/);
});

test('door home and pin route share the cached pin plate loader', () => {
  assert.match(doorHome, /loadDoorPinPlate/);
  assert.doesNotMatch(doorHome, /toDoorLinkPins/);
  assert.doesNotMatch(doorHome, /getSharedPublicEntities/);
  assert.match(pinRoute, /resolveDoorPinRedirect/);
  assert.doesNotMatch(pinRoute, /getSharedPublicEntities|buildExploreMapSource/);
  assert.doesNotMatch(pinRoute, /force-dynamic/);
});

test('home page is ISR, not force-dynamic', () => {
  assert.match(homePage, /export const revalidate = 300/);
  assert.doesNotMatch(homePage, /force-dynamic/);
});

test('pin redirect table matches resolveDoorPinTarget for each index', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const entityOnly = {
    type: 'Feature' as const,
    id: 'ent_howard_theatre_001',
    geometry: { type: 'Point' as const, coordinates: [-77.02, 38.91] as [number, number] },
    properties: {
      entityId: 'ent_howard_theatre_001',
      href: '/entity/ent_howard_theatre_001',
      kind: 'place',
      displayName: 'Howard Theatre',
      oneLineStory: 'A landmark stage.',
      precision: 'city',
      geoPrecisionTier: 'locality' as const,
      eraBuckets: ['1920s'],
      evidenceCount: 2,
      confidenceTier: 'high' as const,
      topicTags: [],
      shade: '#6D675F',
      glyph: 'place',
      kindFamily: 'place',
      locationLabel: 'Washington, DC',
    },
  };
  const features = [...source.featureCollection.features, entityOnly];
  const pinRedirects = features.map((_feature, index) => {
    const pinId = firstPaintPinId(index);
    return resolveDoorPinTarget(pinId, features) ?? '';
  });
  const entityIndex = features.length - 1;
  const pinId = firstPaintPinId(entityIndex);
  assert.equal(pinRedirects[entityIndex], '/entity/ent_howard_theatre_001');
  assert.equal(resolveDoorPinTarget(pinId, features), pinRedirects[entityIndex]);
});
