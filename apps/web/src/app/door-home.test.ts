/**
 * The door is an immersive Journey: scroll snaps chapters and zooms the pin field.
 * It is not the Atlas instrument and not a MapLibre StoryMode mount.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listPublicEntities } from '../data/public-seed';
import { buildExploreMapSource } from '../lib/map-experience/build-explore-map-source';
import { toDoorLinkPins } from '../lib/map-experience/first-paint-pins';
import { atlasWalkHref } from '../lib/place/public-place-path';
import { FirstPaintPinPlate } from './first-paint-pin-plate';

const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');
const door = readFileSync(fileURLToPath(new URL('./door-home.tsx', import.meta.url)), 'utf8');
const immersive = readFileSync(
  fileURLToPath(new URL('./door-immersive.tsx', import.meta.url)),
  'utf8',
);

test('`/` mounts DoorImmersive over the pin plate, not the Atlas instrument', () => {
  assert.match(page, /DoorHome/);
  assert.doesNotMatch(page, /AtlasHome|AtlasLoader|AtlasExperience/);
  assert.match(door, /DoorImmersive/);
  assert.match(door, /loadDoorPinPlate/);
  assert.match(door, /pickStoryChapters/);
  assert.match(door, /pickStoryRecord/);
  assert.doesNotMatch(door, /toDoorLinkPins/);
  assert.doesNotMatch(door, /LivingAtmosphereMosaic|useStoryRunner|MapStage/);
  assert.doesNotMatch(door, /['"`]\/banned-books|['"`]\/journey/);
});

test('DoorImmersive scrolls chapters and drives plate focus without MapLibre', () => {
  assert.match(immersive, /'use client'/);
  assert.match(immersive, /IntersectionObserver/);
  assert.match(immersive, /resolveDoorFocus/);
  assert.match(immersive, /linkRecords/);
  assert.match(immersive, /scrollIntoView/);
  assert.match(immersive, />\s*Begin\s*</);
  assert.match(immersive, /Open the Atlas/);
  assert.doesNotMatch(immersive, /useStoryRunner|MapStage|maplibregl/);
});

test('immersive CSS uses document snap over a fixed full-bleed plate', () => {
  const css = readFileSync(fileURLToPath(new URL('./door-home.css', import.meta.url)), 'utf8');
  assert.match(css, /html:has\(\.ds-door\)[\s\S]*scroll-snap-type:\s*y\s+proximity/);
  assert.match(css, /ds-door__board-frame/);
  assert.match(css, /\.ds-door__field[\s\S]*position:\s*fixed/);
  assert.match(css, /\.ds-door__ground[\s\S]*background:\s*var\(--ds-canvas\)/);
  assert.match(css, /\.ds-door__ground-map[\s\S]*mask-image:\s*url\('\/geo\/us-locator\.svg'\)/);
  assert.match(css, /\.ds-door__ground-map[\s\S]*background-color:\s*var\(--ds-ink-muted\)/);
  // Page Sand / copper wash behind the map was the distracting orange field.
  assert.doesNotMatch(css, /\.ds-door__ground[\s\S]*--ds-accent-muted/);
  assert.doesNotMatch(css, /mix-blend-mode:\s*multiply/);
  assert.doesNotMatch(css, /radial-gradient|linear-gradient|box-shadow|backdrop-filter/);
  // Nested overflow scrollport was the bug: wheel only hit cards. Document scrolls instead.
  assert.doesNotMatch(css, /\.ds-door-journey\s*\{[^}]*overflow-y:\s*auto/);
  // Land mask on the pin plate made link hits fail (mask alpha ~0.32).
  assert.doesNotMatch(
    css,
    /body:has\(\.ds-door\)\s+\.ds-first-paint-plate\s*\{[^}]*mask-image:\s*url\(/,
  );
});

test('DoorImmersive layout-zooms the plate (no transform:scale blur)', () => {
  assert.match(immersive, /width: `\$\{focus\.scale \* 100\}%`/);
  assert.match(immersive, /ds-door__ground-map/);
  assert.doesNotMatch(immersive, /transform:\s*`scale/);
});

test('door-home CSS switches mobile typography and gutters', () => {
  const css = readFileSync(fileURLToPath(new URL('./door-home.css', import.meta.url)), 'utf8');
  const pinCss = readFileSync(
    fileURLToPath(new URL('./first-paint-pin-plate.css', import.meta.url)),
    'utf8',
  );
  assert.match(css, /ds-door-journey__cold[\s\S]*clamp\(/);
  assert.match(css, /var\(--ds-gutter\)/);
  assert.match(pinCss, /max-width: 899px/);
  assert.match(pinCss, /--ds-first-paint-pin-size:\s*0\.1875rem/);
  assert.match(pinCss, /\.ds-door__board\.is-zoomed/);
  assert.doesNotMatch(pinCss, /ds-door__board:not\(\.is-zoomed\)/);
  assert.doesNotMatch(pinCss, /ds-first-paint-plate--door-mobile/);
});

test('DoorImmersive renders one full pin plate for every record', () => {
  assert.match(immersive, /resolveDoorFocusPinId/);
  assert.match(immersive, /catalogFeatures/);
  assert.doesNotMatch(immersive, /thinDoorNationalPins/);
  assert.doesNotMatch(immersive, /ds-first-paint-plate--door-mobile/);
});

test('Door pin plate can link every public record', () => {
  const features = buildExploreMapSource(listPublicEntities()).featureCollection.features;
  const pins = toDoorLinkPins(features);
  const html = renderToStaticMarkup(
    createElement(FirstPaintPinPlate, { pins, linkRecords: true, focusEntityId: null }),
  );
  assert.match(html, /ds-first-paint-plate--records/);
  assert.match(html, /ds-first-paint-pin--link/);
  assert.match(html, /ds-first-paint-pin--walk/);
  const linkPins = pins.features.filter((feature) => feature.properties.href.length > 0);
  const anchors = html.match(/<a\b/g) ?? [];
  assert.equal(anchors.length, linkPins.length);
  assert.equal(linkPins.length, pins.features.length);
  assert.doesNotMatch(html, /href="\/entity\//);
  assert.equal(
    atlasWalkHref({
      displayName: 'Dillard High School, Old',
      kind: 'place',
      entityId: 'nrhp-black-heritage-91000107',
    }),
    '/place/dillard-high-school-old',
  );
});
