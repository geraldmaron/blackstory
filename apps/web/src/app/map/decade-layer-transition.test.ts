/**
 * Unit tests for decade-flow dual-buffer morph timing and paint targets.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  buildDecadeHoldSet,
  buildDensityColorMorphStates,
  DECADE_CROSSFADE_IN_TARGETS,
  DECADE_CROSSFADE_OUT_TARGETS,
  DECADE_LAYER_FADE_MS,
  decadeCrossfadeOpacities,
  decadeHoldOpacityExpression,
  decadeLayerFadeDurationMs,
  easeInOutCubic,
  entityIdsInCollection,
  isDecadeFadePaintChannel,
  lerpHexColor,
  paintTransitionKey,
  restoreDecadeFadePaintFromStyle,
  shouldFadeDecadePatch,
  shouldMorphDecadeDataPatch,
} from './decade-layer-transition';
import {
  EXPLORE_CLUSTER_COUNT_INCOMING_LAYER_ID,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_PRECISION_RADIUS_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-layer-ids';

test('decade morph duration is a slow ambient dissolve (~1.6s), not the 480ms UI token', () => {
  assert.equal(DECADE_LAYER_FADE_MS, 1600);
  assert.equal(decadeLayerFadeDurationMs(false), 1600);
  assert.equal(decadeLayerFadeDurationMs(true), 0);
});

test('Explore must not request the ambient morph on patchData', () => {
  // The 1.6s dual-buffer dissolve reads as lag on a decade or filter click, which is a direct
  // interaction. Explore's decade crossfade is the 420ms pin transition in
  // decade-transition.ts; the ambient morph belongs to surfaces that move the camera on their
  // own. The helpers below stay exercised by the unit tests in this file.
  const atlasSource = readFileSync(
    new URL('../explore/AtlasExperience.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(atlasSource, /from ['"][^'"]*decade-layer-transition['"]/);
  assert.doesNotMatch(atlasSource, /fade:\s*true/);
});

test('shouldFadeDecadePatch skips the initial apply and reduced motion', () => {
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: true }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: true, isInitialApply: false }), false);
  assert.equal(shouldFadeDecadePatch({ reducedMotion: false, isInitialApply: false }), true);
});

test('shouldMorphDecadeDataPatch refuses morph when relationship lines toggle', () => {
  assert.equal(
    shouldMorphDecadeDataPatch({
      reducedMotion: false,
      isInitialApply: false,
      layerModeChanged: false,
      historyEdgesToggled: true,
    }),
    false,
  );
  assert.equal(
    shouldMorphDecadeDataPatch({
      reducedMotion: false,
      isInitialApply: false,
      layerModeChanged: false,
      historyEdgesToggled: false,
    }),
    true,
  );
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
      populationLayerActive: true,
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

test('the precision-radius affordance fades out with the pin stack, with no incoming counterpart to fade back in on its own', () => {
  const outLayerIds = new Set(DECADE_CROSSFADE_OUT_TARGETS.map((target) => target.layerId));
  const inLayerIds = new Set(DECADE_CROSSFADE_IN_TARGETS.map((target) => target.layerId));
  assert.ok(
    outLayerIds.has(EXPLORE_PRECISION_RADIUS_LAYER_ID),
    'a static ring during a decade dissolve would read as a rendering glitch, not chrome',
  );
  assert.ok(
    !inLayerIds.has(EXPLORE_PRECISION_RADIUS_LAYER_ID),
    'there is no dual-buffer precision-radius layer to fade in — promote restores it from style',
  );
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

test('restoreDecadeFadePaintFromStyle resets incoming to 0 and restores primary paint from style', () => {
  const paints = new Map<string, unknown>();
  const map = {
    getLayer: (id: string) => (id.includes('explore') ? {} : undefined),
    setPaintProperty: (layerId: string, paintKey: string, value: unknown) => {
      paints.set(`${layerId}:${paintKey}`, value);
    },
  } as unknown as MapLibreMap;
  const kindOpacity = ['match', ['get', 'kind'], 'place', 0.52, 'institution', 0.2, 0.52];
  const style = {
    layers: [
      {
        id: EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
        type: 'circle',
        paint: { 'circle-opacity': kindOpacity },
      },
    ],
  } as unknown as StyleSpecification;

  restoreDecadeFadePaintFromStyle(map, style);

  assert.equal(paints.get(`${EXPLORE_UNCLUSTERED_POINT_INCOMING_LAYER_ID}:circle-opacity`), 0);
  assert.deepEqual(paints.get(`${EXPLORE_UNCLUSTERED_POINT_LAYER_ID}:circle-opacity`), kindOpacity);
});

/* Per-entity decade morph: a record in both decades does not move. */

test('the hold set is the records documented in both decades, and nothing else', () => {
  const held = buildDecadeHoldSet(['ent_a', 'ent_b', 'ent_c'], ['ent_b', 'ent_c', 'ent_d']);
  assert.deepEqual([...held].sort(), ['ent_b', 'ent_c']);
  // ent_a leaves and ent_d arrives: both must animate, so neither is held.
  assert.equal(held.has('ent_a'), false);
  assert.equal(held.has('ent_d'), false);
});

test('the hold set ignores order, blanks and whitespace, since the source is rebuilt per decade', () => {
  const held = buildDecadeHoldSet([' ent_a ', '', 'ent_b'], ['ent_b', 'ent_a']);
  assert.deepEqual([...held].sort(), ['ent_a', 'ent_b']);
  assert.deepEqual([...buildDecadeHoldSet([], ['ent_a'])], []);
  assert.deepEqual([...buildDecadeHoldSet(['ent_a'], [])], []);
});

test('entityIdsInCollection reads record ids and skips unkeyed features', () => {
  assert.deepEqual(
    entityIdsInCollection({
      features: [
        { properties: { entityId: 'ent_a' } },
        { properties: {} },
        { properties: { entityId: '  ' } },
        { properties: { entityId: 'ent_b' } },
      ],
    }),
    ['ent_a', 'ent_b'],
  );
});

test('a held record sits still on both buffers while everything else crossfades', () => {
  // Mid-dissolve is where the old behavior was worst, so assert there.
  const { outOpacity, inOpacity } = decadeCrossfadeOpacities(0.5, 1);
  const out = decadeHoldOpacityExpression(1, outOpacity);
  const incoming = decadeHoldOpacityExpression(0, inOpacity);

  // Current buffer: held records stay at rest, the rest fade out.
  assert.deepEqual(out, ['case', ['boolean', ['feature-state', 'hold'], false], 1, 0.5]);
  // Incoming buffer: held records stay at zero, so the same record is never drawn twice.
  assert.deepEqual(incoming, ['case', ['boolean', ['feature-state', 'hold'], false], 0, 0.5]);
});

test('the default is false, so a cluster — which has no entityId to promote — still animates', () => {
  const [, condition] = decadeHoldOpacityExpression(1, 0.25) as [
    string,
    readonly unknown[],
    number,
    number,
  ];
  assert.deepEqual(condition, ['boolean', ['feature-state', 'hold'], false]);
});

test('holding is why this exists: two half-opacity copies composite to 0.75, not 1', () => {
  /*
   * The reason the old dual-buffer dissolve was visible on records that never left. The existing
   * contract test asserts out + in ≈ rest, which is true arithmetically and false on screen:
   * stacking two translucent copies is 1 - (1 - a)(1 - b). At the midpoint that is 0.75 of rest,
   * so every persisting pin dipped and its stroke double-drew.
   */
  const rest = 1;
  const { outOpacity, inOpacity } = decadeCrossfadeOpacities(0.5, rest);
  assert.equal(outOpacity + inOpacity, rest, 'arithmetic sum is the old contract');

  const composited = 1 - (1 - outOpacity) * (1 - inOpacity);
  assert.ok(composited < rest, 'but compositing two copies never reaches rest');
  assert.equal(Number(composited.toFixed(2)), 0.75);

  // Held records take a single branch on a single buffer, so there is nothing to composite.
  const heldOnCurrent = decadeHoldOpacityExpression(rest, outOpacity)[2];
  const heldOnIncoming = decadeHoldOpacityExpression(0, inOpacity)[2];
  assert.equal(heldOnCurrent, rest);
  assert.equal(heldOnIncoming, 0);
});
