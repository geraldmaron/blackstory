/**
 * Unit tests for decade-flow dual-buffer crossfade timing and paint targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DECADE_CROSSFADE_IN_TARGETS,
  DECADE_CROSSFADE_OUT_TARGETS,
  DECADE_FADE_PAINT_TARGETS,
  DECADE_LAYER_FADE_MS,
  decadeCrossfadeOpacities,
  decadeLayerFadeDurationMs,
  isDecadeFadePaintChannel,
  paintTransitionKey,
  shouldFadeDecadePatch,
} from './decade-layer-transition';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
} from './explore-layer-ids';

test('decade crossfade duration is a slow ambient dissolve (1s), not the 480ms UI token', () => {
  assert.equal(DECADE_LAYER_FADE_MS, 1000);
  assert.equal(decadeLayerFadeDurationMs(false), 1000);
  assert.equal(decadeLayerFadeDurationMs(true), 0);
});

test('shouldFadeDecadePatch skips the initial apply and reduced motion', () => {
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: true }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: true, isInitialApply: false }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: false }), true);
});

test('crossfade out targets cover density fills, edges, entity circles, and cluster counts', () => {
  const keys = DECADE_CROSSFADE_OUT_TARGETS.map((target) => `${target.layerId}:${target.paintKey}`);
  assert.ok(keys.some((key) => key.includes('state-density') && key.endsWith('fill-opacity')));
  assert.ok(keys.some((key) => key.includes('history-edges') && key.endsWith('line-opacity')));
  assert.ok(keys.some((key) => key.includes('explore-point') && key.includes('circle-opacity')));
  assert.ok(
    keys.some((key) => key.includes(EXPLORE_CLUSTER_COUNT_LAYER_ID) && key.endsWith('text-opacity')),
  );
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    assert.match(target.paintKey, /opacity/);
    assert.ok(target.restOpacity > 0);
  }
});

test('crossfade in targets mirror the dual buffer (incoming density + pin stack)', () => {
  const layerIds = new Set(DECADE_CROSSFADE_IN_TARGETS.map((target) => target.layerId));
  assert.ok(layerIds.has(EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID));
  assert.ok(layerIds.has(EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID));
  assert.ok(layerIds.has(EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID));
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    assert.match(target.layerId, /incoming/);
    assert.match(target.paintKey, /opacity/);
  }
});

test('deprecated DECADE_FADE_PAINT_TARGETS matches current-buffer out channels only', () => {
  assert.equal(DECADE_FADE_PAINT_TARGETS.length, DECADE_CROSSFADE_OUT_TARGETS.length);
  assert.ok(DECADE_FADE_PAINT_TARGETS.every((target) => !target.layerId.includes('incoming')));
});

test('isDecadeFadePaintChannel matches both current and incoming dissolve channels', () => {
  assert.equal(isDecadeFadePaintChannel(EXPLORE_STATE_DENSITY_LAYER_ID, 'fill-opacity'), true);
  assert.equal(isDecadeFadePaintChannel(EXPLORE_STATE_DENSITY_INCOMING_LAYER_ID, 'fill-opacity'), true);
  assert.equal(isDecadeFadePaintChannel(EXPLORE_CLUSTER_COUNT_LAYER_ID, 'text-opacity'), true);
  assert.equal(isDecadeFadePaintChannel(EXPLORE_CLUSTER_COUNT_LAYER_ID, 'text-color'), false);
});

test('decadeCrossfadeOpacities never empties the plate (out+in ≈ rest across the dissolve)', () => {
  const rest = 1;
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const { outOpacity, inOpacity } = decadeCrossfadeOpacities(progress, rest);
    assert.ok(Math.abs(outOpacity + inOpacity - rest) < 1e-9);
    assert.ok(outOpacity >= 0 && inOpacity >= 0);
  }
  assert.deepEqual(decadeCrossfadeOpacities(0, 0.9), { outOpacity: 0.9, inOpacity: 0 });
  assert.deepEqual(decadeCrossfadeOpacities(1, 0.9), { outOpacity: 0, inOpacity: 0.9 });
});

test('paintTransitionKey builds MapLibre *-transition property names', () => {
  assert.equal(paintTransitionKey('fill-opacity'), 'fill-opacity-transition');
  assert.equal(paintTransitionKey('circle-opacity'), 'circle-opacity-transition');
});
