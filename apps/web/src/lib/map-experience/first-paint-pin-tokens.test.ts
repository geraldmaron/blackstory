/**
 * First-paint pin CSS tokens stay aligned with first-paint-pin-plate.css.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FIRST_PAINT_PIN_SIZE_REM,
  MAP_ENTITY_MARKER_HIT_PX,
  RECORD_LOCATOR_PIN_PX,
} from './first-paint-pin-tokens';

const pinPlateCss = readFileSync(
  fileURLToPath(new URL('../../app/first-paint-pin-plate.css', import.meta.url)),
  'utf8',
);
const doorCss = readFileSync(
  fileURLToPath(new URL('../../app/door-home.css', import.meta.url)),
  'utf8',
);
const mapStage = readFileSync(
  fileURLToPath(new URL('../../components/map-stage/MapStage.tsx', import.meta.url)),
  'utf8',
);
const shellCss = readFileSync(
  fileURLToPath(new URL('../../app/shell.css', import.meta.url)),
  'utf8',
);
const locatorCss = readFileSync(
  fileURLToPath(new URL('../../components/patterns/record-locator.css', import.meta.url)),
  'utf8',
);
const mapFrameCss = readFileSync(
  fileURLToPath(new URL('../../../../../packages/ui/src/styles/components.css', import.meta.url)),
  'utf8',
);

test('first-paint pin plate declares shared size tokens', () => {
  for (const value of Object.values(FIRST_PAINT_PIN_SIZE_REM.national)) {
    assert.match(pinPlateCss, new RegExp(value.replace('.', '\\.')));
  }
  for (const value of Object.values(FIRST_PAINT_PIN_SIZE_REM.doorNational)) {
    assert.match(pinPlateCss, new RegExp(value.replace('.', '\\.')));
  }
  for (const value of Object.values(FIRST_PAINT_PIN_SIZE_REM.doorMobileNational)) {
    assert.match(pinPlateCss, new RegExp(value.replace('.', '\\.')));
  }
  for (const value of Object.values(FIRST_PAINT_PIN_SIZE_REM.doorMobileZoomed)) {
    assert.match(pinPlateCss, new RegExp(value.replace('.', '\\.')));
  }
  for (const value of Object.values(FIRST_PAINT_PIN_SIZE_REM.zoomed)) {
    assert.match(pinPlateCss, new RegExp(value.replace('.', '\\.')));
  }
  assert.match(pinPlateCss, /--ds-first-paint-pin-size:/);
  assert.match(pinPlateCss, /--ds-accent-graphic/);
});

test('door-home does not duplicate first-paint pin size rules', () => {
  assert.doesNotMatch(doorCss, /body:has\(\.ds-door\)\s+\.ds-first-paint-pin\s*\{[^}]*width:/);
  assert.doesNotMatch(doorCss, /\.ds-door__board\.is-zoomed\s+\.ds-first-paint-pin/);
});

test('MapStage loads first-paint pin plate CSS for Explore HTML markers', () => {
  assert.match(mapStage, /first-paint-pin-plate\.css/);
});

test('Explore first-paint geography is not hidden by an empty MapLibre canvas', () => {
  assert.doesNotMatch(pinPlateCss, /body:has\(\.maplibregl-canvas\)\s+\.ds-first-paint-plate/);
  assert.match(mapStage, /dataset\.plateReady\s*=\s*'1'/);
  assert.match(mapStage, /once\('idle'/);
});

test('majority pins use Page Sand on Door, Explore, and every first-paint surface', () => {
  assert.match(pinPlateCss, /:root\s*\{[^}]*--ds-first-paint-pin-ink:\s*var\(--ds-accent-muted\)/s);
  assert.match(
    pinPlateCss,
    /:root\s*\{[^}]*--ds-first-paint-pin-ink-link:\s*var\(--ds-accent-muted\)/s,
  );
  assert.doesNotMatch(pinPlateCss, /body:has\(\.ds-door\)\s*\{[^}]*--ds-first-paint-pin-ink:/s);
  assert.doesNotMatch(pinPlateCss, /color-mix\(in srgb, var\(--ds-ink\)/);
});

test('SSR pin plate sits at map-plate tier under Atlas instrument chrome', () => {
  // A literal z-index: 2 above .ds-atlas (--ds-z-content = 1) painted pins over Lens/sheet/rail.
  assert.match(pinPlateCss, /^\s*z-index:\s*var\(--ds-z-map-plate\);/m);
  assert.match(pinPlateCss, /\.ds-first-paint-plate\s*\{[^}]*z-index:\s*var\(--ds-z-map-plate\)/s);
  const atlasCss = readFileSync(
    fileURLToPath(new URL('../../app/explore/atlas.css', import.meta.url)),
    'utf8',
  );
  assert.match(atlasCss, /\.ds-atlas\s*\{[^}]*z-index:\s*var\(--ds-z-content\)/s);
  assert.match(shellCss, /\.ds-map-stage\s*\{[^}]*isolation:\s*isolate/s);
});

test('entity marker hit target matches shell.css and first-paint map discs', () => {
  assert.match(shellCss, /\.ds-map-entity-marker/);
  assert.match(shellCss, /\.ds-map-entity-marker::after/);
  assert.match(pinPlateCss, /\.ds-map-entity-marker\.ds-first-paint-pin/);
  assert.match(pinPlateCss, /\.ds-map-entity-marker\.ds-first-paint-pin--walk/);
  assert.match(pinPlateCss, /\.ds-map-entity-marker\.ds-first-paint-pin--focus/);
  assert.equal(MAP_ENTITY_MARKER_HIT_PX, 9);
});

test('record locator pin uses copper ring without box-shadow', () => {
  assert.match(locatorCss, new RegExp(`${RECORD_LOCATOR_PIN_PX}px`));
  assert.match(locatorCss, /--ds-accent-graphic/);
  assert.doesNotMatch(locatorCss, /box-shadow/);
});

test('search center marker uses graphic copper, not text copper', () => {
  assert.match(shellCss, /\.ds-map-search-center-marker__head[\s\S]*--ds-accent-graphic/);
  assert.doesNotMatch(
    shellCss,
    /\.ds-map-search-center-marker__head[\s\S]*background:\s*var\(--ds-accent\)/,
  );
});

test('MapFrame schematic pins use Page Sand, not theme ink', () => {
  assert.match(mapFrameCss, /\.ds-map__pin\s*\{[^}]*background:\s*var\(--ds-accent-muted\)/s);
});
