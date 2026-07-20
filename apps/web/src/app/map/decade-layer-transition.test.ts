/**
 * Unit tests for decade-flow dual-buffer morph timing and paint targets.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDensityColorMorphStates,
  DECADE_CROSSFADE_IN_TARGETS,
  DECADE_CROSSFADE_OUT_TARGETS,
  DECADE_FADE_PAINT_TARGETS,
  DECADE_LAYER_FADE_MS,
  decadeCrossfadeOpacities,
  decadeLayerFadeDurationMs,
  easeInOutCubic,
  isDecadeFadePaintChannel,
  lerpHexColor,
  paintTransitionKey,
  shouldFadeDecadePatch,
  shouldMorphDecadeDataPatch,
} from './decade-layer-transition';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
} from './explore-layer-ids';

test('decade morph duration is a slow ambient dissolve (~1.6s), not the 480ms UI token', () => {
  assert.equal(DECADE_LAYER_FADE_MS, 1600);
  assert.equal(decadeLayerFadeDurationMs(false), 1600);
  assert.equal(decadeLayerFadeDurationMs(true), 0);
});

test('shouldFadeDecadePatch skips the initial apply and reduced motion', () => {
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: true }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: true, isInitialApply: false }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: false }), true);
});

test('shouldMorphDecadeDataPatch refuses morph when layerMode changes', () => {
  assert.equal(
    shouldMorphDecadeDataPatch({
      reducedMotion: false,
      isInitialApply: false,
      layerModeChanged: true,
    }),
    false,
  );
  assert.equal(
    shouldMorphDecadeDataPatch({
      reducedMotion: false,
      isInitialApply: false,
      layerModeChanged: false,
    }),
    true,
  );
  assert.equal(
    shouldMorphDecadeDataPatch({
      reducedMotion: false,
      isInitialApply: true,
      layerModeChanged: false,
    }),
    false,
  );
});

test('crossfade out targets cover pins, edges, and clusters — not density (color lerp)', () => {
  const keys = DECADE_CROSSFADE_OUT_TARGETS.map((target) => `${target.layerId}:${target.paintKey}`);
  assert.ok(!keys.some((key) => key.includes('state-density')));
  assert.ok(keys.some((key) => key.includes('history-edges') && key.endsWith('line-opacity')));
  assert.ok(keys.some((key) => key.includes('explore-point') && key.includes('circle-opacity')));
  assert.ok(
    keys.some(
      (key) => key.includes(EXPLORE_CLUSTER_COUNT_LAYER_ID) && key.endsWith('text-opacity'),
    ),
  );
  for (const target of DECADE_CROSSFADE_OUT_TARGETS) {
    assert.match(target.paintKey, /opacity/);
    assert.ok(target.restOpacity > 0);
  }
});

test('crossfade in targets mirror the pin stack only (density uses feature-state color lerp)', () => {
  const layerIds = new Set(DECADE_CROSSFADE_IN_TARGETS.map((target) => target.layerId));
  assert.ok(!layerIds.has('explore-state-density-fill-incoming'));
  assert.ok(layerIds.has(EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID));
  assert.ok(layerIds.has(EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID));
  for (const target of DECADE_CROSSFADE_IN_TARGETS) {
    assert.match(target.layerId, /incoming/);
    assert.match(target.paintKey, /opacity/);
  }
});

test('deprecated DECADE_FADE_PAINT_TARGETS matches pin/edge out channels only', () => {
  assert.equal(DECADE_FADE_PAINT_TARGETS.length, DECADE_CROSSFADE_OUT_TARGETS.length);
  assert.ok(DECADE_FADE_PAINT_TARGETS.every((target) => !target.layerId.includes('incoming')));
});

test('isDecadeFadePaintChannel matches pin/edge dissolve channels only', () => {
  assert.equal(isDecadeFadePaintChannel(EXPLORE_STATE_DENSITY_LAYER_ID, 'fill-opacity'), false);
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

test('buildDensityColorMorphStates pairs settled colorA with next fillColor', () => {
  const current = new Map([['06', 'rgba(184, 107, 42, 0.12)']]);
  const states = buildDensityColorMorphStates(current, [
    {
      id: '06',
      properties: { fips: '06', fillColor: 'rgba(184, 107, 42, 0.28)' },
    },
    {
      id: '48',
      properties: { fips: '48', fillColor: 'rgba(184, 107, 42, 0.5)' },
    },
  ]);
  assert.equal(states.length, 2);
  assert.deepEqual(states[0], {
    fips: '06',
    colorA: 'rgba(184, 107, 42, 0.12)',
    colorB: 'rgba(184, 107, 42, 0.28)',
  });
  assert.equal(states[1]?.colorA, states[1]?.colorB);
});

test('lerpHexColor interpolates rgba density fills', () => {
  assert.equal(
    lerpHexColor('rgba(184, 107, 42, 0.12)', 'rgba(184, 107, 42, 0.28)', 0),
    'rgba(184, 107, 42, 0.12)',
  );
  assert.equal(
    lerpHexColor('rgba(184, 107, 42, 0.12)', 'rgba(184, 107, 42, 0.28)', 1),
    'rgba(184, 107, 42, 0.28)',
  );
  const mid = lerpHexColor('rgba(184, 107, 42, 0.12)', 'rgba(184, 107, 42, 0.28)', 0.5);
  assert.ok(mid.startsWith('rgba(184, 107, 42, 0.2'));
});

test('easeInOutCubic is smooth and clamped', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(easeInOutCubic(0.5) > 0.4 && easeInOutCubic(0.5) < 0.6);
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
});

test('paintTransitionKey builds MapLibre *-transition property names', () => {
  assert.equal(paintTransitionKey('fill-opacity'), 'fill-opacity-transition');
  assert.equal(paintTransitionKey('circle-opacity'), 'circle-opacity-transition');
});
