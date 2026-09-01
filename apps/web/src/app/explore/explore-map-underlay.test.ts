/**
 * Explore first-paint map: locator geography, Albers board, and plate-ready handoff.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const css = readFileSync(new URL('./explore-map-underlay.css', import.meta.url), 'utf8');
const source = readFileSync(new URL('./explore-map-underlay.tsx', import.meta.url), 'utf8');
const gestures = readFileSync(new URL('./explore-map-gestures.tsx', import.meta.url), 'utf8');
const atlasHome = readFileSync(
  fileURLToPath(new URL('../atlas-home.tsx', import.meta.url)),
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

describe('explore map underlay', () => {
  it('paints the US locator as a mask on an Albers board so pin percents match states', () => {
    assert.match(css, /\.ds-explore-underlay__board[\s\S]*aspect-ratio:\s*960\s*\/\s*500/);
    assert.match(
      css,
      /\.ds-explore-underlay__ground[\s\S]*mask-image:\s*url\('\/geo\/us-locator\.svg'\)/,
    );
    assert.match(
      css,
      /\.ds-explore-underlay__ground[\s\S]*background-color:\s*var\(--ds-ink-muted\)/,
    );
    assert.doesNotMatch(css, /radial-gradient|linear-gradient|box-shadow|backdrop-filter/);
  });

  it('captures wheel, drag and pinch until the live plate is ready', () => {
    assert.match(css, /\.ds-explore-underlay\s*\{[^}]*pointer-events:\s*auto/s);
    assert.match(css, /\.ds-explore-underlay\s*\{[^}]*touch-action:\s*none/s);
    assert.match(gestures, /passive:\s*false/);
    assert.match(gestures, /preventDefault/);
    assert.match(gestures, /panLocatorView/);
    assert.match(gestures, /zoomLocatorViewAt/);
  });

  it('puts geography in server HTML, not only after client hydration', () => {
    assert.doesNotMatch(source, /'use client'/);
    assert.match(source, /ds-explore-underlay__ground/);
    assert.match(source, /ExploreMapGestures/);
  });

  it('hides only after MapLibre has geography, not when an empty canvas appears', () => {
    assert.match(
      css,
      /body:has\(\.ds-map-stage\[data-plate-ready\]\)\s+\.ds-explore-underlay\s*\{[^}]*pointer-events:\s*none/s,
    );
    assert.doesNotMatch(pinPlateCss, /body:has\(\.maplibregl-canvas\)\s+\.ds-first-paint-plate/);
    assert.match(mapStage, /dataset\.plateReady\s*=\s*'1'/);
    assert.match(mapStage, /loadStatePolygonsWithDensity/);
  });

  it('wraps the Explore pin plate so first HTML has geography', () => {
    assert.match(atlasHome, /ExploreMapUnderlay/);
    assert.match(
      atlasHome,
      /<ExploreMapUnderlay>[\s\S]*FirstPaintPinPlate[\s\S]*<\/ExploreMapUnderlay>/,
    );
  });
});
