/**
 * Pins the fixes from the phone smoothness pass (PR #275): each one removed work that ran on every
 * frame of a pinch or a sheet's motion, measured before and after on a production build. A
 * regression here does not fail visibly; it makes the map and the menus stutter again.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const mapStage = read('../../components/map-stage/MapStage.tsx');
const mapControlsCss = read('../../components/map-experience/map-controls.css');
const atlasCss = read('./atlas.css');
const atlas = read('./AtlasExperience.tsx');
const heroMorph = read('../../components/story/HeroHeadlineMorph.tsx');
const shellCss = read('../shell.css');

test('records are drawn by the map, not as one HTML marker each', () => {
  assert.doesNotMatch(mapStage, /ds-map-entity-marker|syncCircularMarkers|markersRef/);
  // Hover comes from the map's own padded hit test.
  assert.match(mapStage, /notify\(listenersRef\.current, 'pinHover', target\)/);
});

test('selection is a static copper mark: no pulse loop on the map (P-04)', () => {
  assert.doesNotMatch(mapStage, /requestAnimationFrame\(tick\)/);
  assert.doesNotMatch(mapStage, /SelectedEntityPulse/);
});

test('state labels are written only on change, leave the map while invisible, and do not transition', () => {
  assert.match(mapStage, /if \(opacity === stateLabelOpacityRef\.current\) return;/);
  assert.match(mapStage, /entry\.marker\.remove\(\)/);
  assert.match(shellCss, /\.ds-state-label\.maplibregl-marker\s*\{[^}]*transition:\s*none/s);
});

test('the map controls slide by transform, never by animating an inset', () => {
  assert.doesNotMatch(mapControlsCss, /transition:[^;]*\b(right|bottom)\b/);
  assert.match(mapControlsCss, /transition:\s*transform/);
  assert.doesNotMatch(
    mapControlsCss + atlasCss,
    /\.ds-atlas\[data-sheet-open='true'\] \.ds-map-controls\s*\{[^}]*\bbottom:/s,
  );
});

test('Explore sheets animate away instead of vanishing', () => {
  for (const sheet of ['LensPanel', 'ResultsRail', 'TimePanel', 'RecordSheet']) {
    assert.match(
      atlas,
      new RegExp(`<SheetPresence show=\\{[^}]+\\}>\\s*<${sheet}\\b`),
      `${sheet} must be wrapped in SheetPresence`,
    );
  }
  assert.match(
    atlasCss,
    /\[data-presence='leaving'\][^{]*\{[^}]*animation:\s*ds-compact-sheet-leave/s,
  );
  assert.match(atlasCss, /\.ds-atlas > \.ds-sheet-presence > \.ds-lens/);
});

test('the Door headline is paced by timers and settles when it is not on screen', () => {
  assert.doesNotMatch(heroMorph, /requestAnimationFrame\(tick\)/);
  assert.match(heroMorph, /new IntersectionObserver/);
});
