/**
 * Explore first-paint map: the plate's own picture, at the plate's own frame, handed off as a
 * crossfade (repo-27uao). Every number in the stylesheet is pinned here against the modules it
 * mirrors, so the board cannot drift away from the plate without this failing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLATE_OPENING_PADDING_PX } from '../../lib/map-experience/camera-presets';
import {
  CONUS_MERCATOR_ASPECT,
  CONUS_MERCATOR_HEIGHT,
  CONUS_MERCATOR_WIDTH,
  conusBoxPxAtZoom,
} from '../../lib/map-experience/conus-mercator';

const css = readFileSync(new URL('./explore-map-underlay.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('./explore-map-underlay.tsx', import.meta.url), 'utf8');
const gestures = readFileSync(new URL('./explore-map-gestures.tsx', import.meta.url), 'utf8');
const atlasHome = readFileSync(
  fileURLToPath(new URL('../atlas-home.tsx', import.meta.url)),
  'utf8',
);
const pinPlate = readFileSync(
  fileURLToPath(new URL('../first-paint-pin-plate.tsx', import.meta.url)),
  'utf8',
);
const pinPlateCss = readFileSync(
  fileURLToPath(new URL('../first-paint-pin-plate.css', import.meta.url)),
  'utf8',
);
const mapStage = readFileSync(
  fileURLToPath(new URL('../../components/map-stage/MapStage.tsx', import.meta.url)),
  'utf8',
);
const atlasCamera = readFileSync(
  fileURLToPath(new URL('./hooks/use-atlas-camera.ts', import.meta.url)),
  'utf8',
);

describe('explore map underlay', () => {
  it('paints the CONUS board in Web Mercator, the plate’s projection, as a mask', () => {
    assert.match(
      css,
      /\.ds-explore-underlay__ground[\s\S]*mask-image:\s*url\('\/geo\/us-conus-mercator\.svg'\)/,
    );
    assert.match(
      css,
      /\.ds-explore-underlay__ground[\s\S]*background-color:\s*var\(--ds-first-paint-ground-ink\)/,
    );
    assert.doesNotMatch(css, /us-locator\.svg|960\s*\/\s*500/);
    assert.doesNotMatch(css, /radial-gradient|linear-gradient|box-shadow|backdrop-filter/);
    assert.match(pinPlate, /conusPinPercent/);
    assert.doesNotMatch(pinPlate, /locatorPinPercent|albers/i);
  });

  it('lays the board over the exact frame the plate opens on', () => {
    // MapStage's constructor: CONUS fitted inside the opening padding, centered.
    assert.match(mapStage, /fitBoundsOptions: \{ padding: PLATE_OPENING_PADDING_PX \}/);
    const clearance = 2 * PLATE_OPENING_PADDING_PX;
    const floorWidth = conusBoxPxAtZoom(3).width.toFixed(2);
    assert.match(
      css,
      new RegExp(
        `width:\\s*max\\(${floorWidth}px, min\\(calc\\(100vw - ${clearance}px\\), calc\\(\\(100dvh - ${clearance}px\\) \\* ${CONUS_MERCATOR_ASPECT.toFixed(6)}\\)\\)\\)`,
      ),
    );
    assert.match(
      css,
      new RegExp(`aspect-ratio:\\s*${CONUS_MERCATOR_WIDTH}\\s*/\\s*${CONUS_MERCATOR_HEIGHT}`),
    );
    // Centered in the canvas, and free to overflow it the way the plate does at its floor.
    assert.match(css, /\.ds-explore-underlay__canvas[\s\S]*place-items:\s*center/);
    assert.match(css, /\.ds-explore-underlay__canvas[\s\S]*place-content:\s*center/);
    assert.match(css, /\.ds-explore-underlay\s*\{[^}]*overflow:\s*hidden/s);
    assert.doesNotMatch(css, /\.ds-explore-underlay__board\s*\{[^}]*max-height/s);
  });

  it('switches to the plate’s zoom-4 clusters where the fit crosses zoom 4', () => {
    // The fit crosses 4 once the box can be `conusBoxPxAtZoom(4)` wide inside the clearance.
    const { width, height } = conusBoxPxAtZoom(4);
    const minWidth = Math.ceil(width + 2 * PLATE_OPENING_PADDING_PX);
    const minHeight = Math.ceil(height + 2 * PLATE_OPENING_PADDING_PX);
    assert.match(
      pinPlateCss,
      new RegExp(`@media \\(min-width: ${minWidth}px\\) and \\(min-height: ${minHeight}px\\)`),
    );
    assert.match(pinPlateCss, /\.ds-first-paint-pin--in-z3\s*\{[^}]*visibility:\s*hidden/s);
    assert.match(
      pinPlateCss,
      /\.ds-first-paint-cluster\[data-zoom='4'\]\s*\{[^}]*display:\s*none/s,
    );
  });

  it('captures wheel, drag and pinch until the live plate is ready', () => {
    assert.match(css, /\.ds-explore-underlay\s*\{[^}]*pointer-events:\s*auto/s);
    assert.match(css, /\.ds-explore-underlay\s*\{[^}]*touch-action:\s*none/s);
    assert.match(gestures, /passive:\s*false/);
    assert.match(gestures, /preventDefault/);
    assert.match(gestures, /panLocatorView/);
    assert.match(gestures, /zoomLocatorViewAt/);
  });

  it('lets every pin take a click, with a padded target, until the live plate is ready', () => {
    assert.match(
      css,
      /\.ds-explore-underlay\s+\.ds-first-paint-pin\s*\{[^}]*pointer-events:\s*auto/s,
    );
    assert.match(css, /\.ds-explore-underlay\s+\.ds-first-paint-pin::after/);
    assert.match(gestures, /readExplorePinTarget/);
    assert.match(gestures, /emitExplorePinSelect/);
    assert.match(gestures, /pointerExceededClickSlop/);
    assert.doesNotMatch(gestures, /if \(target\?\.closest\('a, button'\)\) return;/);
  });

  it('puts geography in server HTML, not only after client hydration', () => {
    assert.doesNotMatch(source, /'use client'/);
    assert.match(source, /ds-explore-underlay__ground/);
    assert.match(source, /ExploreMapGestures/);
  });

  it('hides only after MapLibre has geography, and the establishing shot waits for that', () => {
    assert.match(
      css,
      /body:has\(\.ds-map-stage\[data-plate-ready\]\)\s+\.ds-explore-underlay\s*\{[^}]*pointer-events:\s*none/s,
    );
    assert.doesNotMatch(pinPlateCss, /body:has\(\.maplibregl-canvas\)\s+\.ds-first-paint-plate/);
    assert.match(mapStage, /dataset\.plateReady\s*=\s*'1'/);
    assert.match(mapStage, /loadStatePolygonsWithDensity/);
    // One reveal per plate life, told to subscribers; the shot starts a beat after it, on the
    // revealed plate, never under the crossfade (use-atlas-camera.ts).
    assert.match(mapStage, /notify\(listenersRef\.current, 'ready'\)/);
    assert.match(mapStage, /if \(event === 'ready' && plateReadyRef\.current\)/);
    assert.match(atlasCamera, /stage\.subscribe\('ready'/);
    assert.match(atlasCamera, /camera\.wide\(\{ trigger: 'ambient' \}\), delay\)/);
    assert.doesNotMatch(atlasCamera, /stage\.mapAvailable\]\)/);
  });

  it('wraps the Explore pin plate so first HTML has geography', () => {
    assert.match(atlasHome, /ExploreMapUnderlay/);
    assert.match(
      atlasHome,
      /<ExploreMapUnderlay>[\s\S]*FirstPaintPinPlate[\s\S]*<\/ExploreMapUnderlay>/,
    );
  });
});
