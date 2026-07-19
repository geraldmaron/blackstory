/**
 * Unit tests for decade-flow MapLibre opacity fade timing and paint targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DECADE_FADE_PAINT_TARGETS,
  DECADE_LAYER_FADE_MS,
  decadeLayerFadeDurationMs,
  paintTransitionKey,
  shouldFadeDecadePatch,
} from './decade-layer-transition';

test('decade layer fade duration matches the slow motion token (480ms)', () => {
  assert.equal(DECADE_LAYER_FADE_MS, 480);
  assert.equal(decadeLayerFadeDurationMs(false), 480);
  assert.equal(decadeLayerFadeDurationMs(true), 0);
});

test('shouldFadeDecadePatch skips the initial apply and reduced motion', () => {
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: true }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: true, isInitialApply: false }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: false }), true);
});

test('fade targets cover density fills, edges, and entity circles (opacity channels only)', () => {
  const keys = DECADE_FADE_PAINT_TARGETS.map((target) => `${target.layerId}:${target.paintKey}`);
  assert.ok(keys.some((key) => key.includes('state-density') && key.endsWith('fill-opacity')));
  assert.ok(keys.some((key) => key.includes('history-edges') && key.endsWith('line-opacity')));
  assert.ok(keys.some((key) => key.includes('explore-point') && key.includes('circle-opacity')));
  for (const target of DECADE_FADE_PAINT_TARGETS) {
    assert.match(target.paintKey, /opacity/);
  }
});

test('paintTransitionKey builds MapLibre *-transition property names', () => {
  assert.equal(paintTransitionKey('fill-opacity'), 'fill-opacity-transition');
  assert.equal(paintTransitionKey('circle-opacity'), 'circle-opacity-transition');
});
