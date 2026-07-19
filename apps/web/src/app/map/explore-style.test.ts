/**
 * Confirms the `/explore` MapLibre style builder: clustering config is wired through,
 * the density layer visibility toggle works, jurisdiction-area geometry stays polygon-typed, and
 * every paint color traces back to the dignity palette (no new/red hue introduced at the render
 * layer).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
import { DIGNITY_PALETTE, EXPLORE_CLUSTER_CONFIG } from '../../lib/map-experience';
import { KIND_ENCODING_ENTRIES } from '../../lib/map-experience/kind-encoding';
import { markerHaloRadiusExpression, markerRadiusExpression } from '../../lib/map-experience/marker-size';
import {
  buildExploreMapStyle,
  ENTITY_CLUSTER_OPACITY,
  ENTITY_HALO_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './explore-style';

type LayerLike = { readonly id: string; readonly paint?: Record<string, unknown> };

function layerById(style: ReturnType<typeof buildStyleFixture>, id: string): LayerLike {
  const layer = style.layers.find((candidate) => candidate.id === id) as LayerLike | undefined;
  assert.ok(layer, `expected a layer with id "${id}"`);
  return layer!;
}

/** Extracts the `[value1, value2, ..., fallback]` outputs from a
 * `['match', input, k1, v1, k2, v2, ..., fallback]` expression, ignoring the leading `'match'`
 * tag and the input expression. */
function matchExpressionOutputs(expression: unknown): readonly unknown[] {
  const arr = expression as unknown[];
  assert.equal(arr[0], 'match', 'expected a match expression');
  const rest = arr.slice(2); // drop 'match' and the input expression
  const outputs: unknown[] = [];
  for (let i = 1; i < rest.length; i += 2) {
    outputs.push(rest[i]);
  }
  outputs.push(rest[rest.length - 1]); // fallback (also lands on an "odd" index by construction)
  return outputs;
}

function buildStyleFixture(layerMode: 'off' | 'presence' | 'blackShare' | 'blackChange') {
  const source = buildExploreMapSource(listPublicEntities());
  return buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode,
  });
}

test('the entities source is configured to cluster with the shared explore cluster config', () => {
  const style = buildStyleFixture('presence');
  const entitiesSource = style.sources['explore-entities'] as {
    cluster?: boolean;
    clusterRadius?: number;
    clusterMaxZoom?: number;
  };
  assert.equal(entitiesSource.cluster, true);
  assert.equal(entitiesSource.clusterRadius, EXPLORE_CLUSTER_CONFIG.clusterRadius);
  assert.equal(entitiesSource.clusterMaxZoom, EXPLORE_CLUSTER_CONFIG.clusterMaxZoom);
});

test('clusteringEnabled: false disables GeoJSON clustering on the entities source', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const style = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
    clusteringEnabled: false,
  });
  const entitiesSource = style.sources['explore-entities'] as { cluster?: boolean };
  assert.equal(entitiesSource.cluster, false);
});

test('unclustered point fill and halo use the shared translucent opacity constants', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const haloLayer = layerById(style, EXPLORE_UNCLUSTERED_HALO_LAYER_ID);
  const clusterLayer = layerById(style, EXPLORE_CLUSTER_LAYER_ID);
  assert.equal(haloLayer.paint?.['circle-opacity'], ENTITY_HALO_OPACITY);
  assert.equal(clusterLayer.paint?.['circle-opacity'], ENTITY_CLUSTER_OPACITY);
  const opacityOutputs = matchExpressionOutputs(pointLayer.paint?.['circle-opacity']);
  assert.ok(opacityOutputs.includes(ENTITY_POINT_FILL_OPACITY));
  assert.ok(
    opacityOutputs.every((value) => typeof value === 'number' && value <= ENTITY_POINT_FILL_OPACITY),
    'no kind fill may be more opaque than the solid-fill constant',
  );
});

test('selected-entity ring layer exists and starts with an empty filter', () => {
  const style = buildStyleFixture('presence');
  const selected = style.layers.find((layer) => layer.id === EXPLORE_SELECTED_POINT_LAYER_ID) as {
    filter?: unknown;
    paint?: Record<string, unknown>;
  };
  assert.ok(selected, 'expected selected point ring layer');
  assert.deepEqual(selected.filter, ['==', ['get', 'entityId'], '']);
  assert.equal(selected.paint?.['circle-color'], 'rgba(0,0,0,0)');
});

test('state density source starts empty so client join can setData without URL race', () => {
  const style = buildStyleFixture('presence');
  const stateSource = style.sources['explore-state-density'] as {
    data?: { type?: string; features?: unknown[] };
  };
  assert.equal(stateSource.data?.type, 'FeatureCollection');
  assert.deepEqual(stateSource.data?.features, []);
});

test('the density layer stays hittable; density tint is controlled by paint not visibility', () => {
  const on = buildStyleFixture('presence');
  const off = buildStyleFixture('off');
  const onLayer = on.layers.find((layer) => layer.id === EXPLORE_STATE_DENSITY_LAYER_ID) as {
    layout?: { visibility?: string };
    paint?: { 'fill-color'?: unknown };
  };
  const offLayer = off.layers.find((layer) => layer.id === EXPLORE_STATE_DENSITY_LAYER_ID) as {
    layout?: { visibility?: string };
    paint?: { 'fill-color'?: unknown };
  };
  assert.equal(onLayer.layout?.visibility, 'visible');
  assert.equal(offLayer.layout?.visibility, 'visible');
  assert.notDeepEqual(onLayer.paint?.['fill-color'], offLayer.paint?.['fill-color']);
});

test('the jurisdiction-area layer renders fill geometry (never a point layer) and is empty by default', () => {
  const style = buildStyleFixture('presence');
  const areaLayer = style.layers.find((layer) => layer.id === EXPLORE_JURISDICTION_AREA_LAYER_ID);
  assert.equal(areaLayer?.type, 'fill');
  const areaSource = style.sources['explore-jurisdiction-areas'] as { data: { features: readonly unknown[] } };
  assert.deepEqual(areaSource.data.features, []);
});

test('every paint color used is one of the dignity-palette values (no new hue introduced at render time)', () => {
  const style = buildStyleFixture('presence');
  const allowed = new Set<string>(Object.values(DIGNITY_PALETTE));
  // The state-bounds line/background/text layers also draw from the dignity palette or the
  // shared brand tokens; the cluster/point/halo/event-glyph layers below are the ones the
  // dignity rule is specifically about (plain string paint values here; kind-keyed `match`
  // expressions are validated separately below, since `typeof value !== 'string'` skips arrays).
  const dignityGatedLayerIds = [
    EXPLORE_CLUSTER_LAYER_ID,
    EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
    EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  ];
  for (const layer of style.layers) {
    if (!dignityGatedLayerIds.includes(layer.id)) continue;
    const paint = (layer as { paint?: Record<string, unknown> }).paint ?? {};
    for (const [key, value] of Object.entries(paint)) {
      if (typeof value !== 'string' || !key.includes('color')) continue;
      assert.ok(allowed.has(value), `layer "${layer.id}" paint "${key}" = "${value}" must come from DIGNITY_PALETTE`);
    }
  }
});

test('the state-selected fill and density fallback tints are relocated DIGNITY_PALETTE tokens, not ad-hoc literals', () => {
  const on = buildStyleFixture('presence');
  const off = buildStyleFixture('off');
  const selectedFillLayer = layerById(on, 'explore-state-selected-fill');
  assert.equal(selectedFillLayer.paint?.['fill-color'], DIGNITY_PALETTE.selectedStateFill);

  const densityLayerOn = layerById(on, EXPLORE_STATE_DENSITY_LAYER_ID);
  const outputs = matchExpressionOutputs(densityLayerOn.paint?.['fill-color']);
  assert.ok(outputs.includes(DIGNITY_PALETTE.densityUnknownFill));

  const densityLayerOff = layerById(off, EXPLORE_STATE_DENSITY_LAYER_ID);
  assert.equal(densityLayerOff.paint?.['fill-color'], DIGNITY_PALETTE.densityDisabledFill);
});

test('OpenFreeMap street layers are present for casing, fill, and labels', () => {
  const style = buildStyleFixture('presence');
  assert.ok(style.sources['openfreemap'], 'expected openfreemap vector source');
  assert.ok(style.layers.some((layer) => layer.id === 'explore-street-casing'));
  assert.ok(style.layers.some((layer) => layer.id === 'explore-street-fill'));
  assert.ok(style.layers.some((layer) => layer.id === 'explore-street-label'));
});

test('light colorScheme flips ocean and street ink to the light plate', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const dark = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
    colorScheme: 'dark',
  });
  const light = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
    colorScheme: 'light',
  });
  const darkBg = layerById(dark, 'background').paint?.['background-color'];
  const lightBg = layerById(light, 'background').paint?.['background-color'];
  assert.equal(darkBg, DIGNITY_PALETTE.ocean);
  assert.equal(lightBg, DIGNITY_PALETTE.oceanLight);
  assert.notEqual(darkBg, lightBg);
});

/** Collect string color outputs nested inside case/match paint expressions. */
function collectColorLeaves(expression: unknown, into: string[] = []): readonly string[] {
  if (typeof expression === 'string' && expression.startsWith('#')) {
    into.push(expression);
    return into;
  }
  if (!Array.isArray(expression)) return into;
  for (const item of expression) collectColorLeaves(item, into);
  return into;
}

test('the point layer colors kinds and semantic tones from DIGNITY_PALETTE via shade-aware case', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const colorExpr = pointLayer.paint?.['circle-color'] as unknown[];
  assert.equal(colorExpr[0], 'case');
  assert.deepEqual(colorExpr[1], ['has', 'shade']);
  assert.deepEqual(colorExpr[2], ['get', 'shade']);
  const colorOutputs = collectColorLeaves(colorExpr);
  const expectedShades = KIND_ENCODING_ENTRIES.map(([, entry]) => entry.shade);
  for (const shade of expectedShades) {
    assert.ok(colorOutputs.includes(shade), `expected kind shade ${shade} in circle-color`);
  }
  assert.ok(colorOutputs.includes(DIGNITY_PALETTE.kindMassacre));
  assert.ok(colorOutputs.includes(DIGNITY_PALETTE.kindPlantation));
  assert.ok(colorOutputs.includes(DIGNITY_PALETTE.kindEpicenter));
  const allowed = new Set<string>(Object.values(DIGNITY_PALETTE));
  for (const output of colorOutputs) {
    assert.ok(allowed.has(output), `circle-color output "${output}" must come from DIGNITY_PALETTE`);
  }
});

test('halo and event-glyph layers use the same kind color expression as the point fill', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const haloLayer = layerById(style, EXPLORE_UNCLUSTERED_HALO_LAYER_ID);
  const eventGlyphLayer = layerById(style, EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID);
  assert.deepEqual(
    haloLayer.paint?.['circle-color'],
    pointLayer.paint?.['circle-color'],
    'halo must share kind shade with the point (not a flat sand wash)',
  );
  assert.deepEqual(
    eventGlyphLayer.paint?.['circle-stroke-color'],
    pointLayer.paint?.['circle-color'],
    'event glyph stroke must share kind shade with the point',
  );
  assert.notEqual(haloLayer.paint?.['circle-color'], DIGNITY_PALETTE.pointHalo);
});

test('the point layer\'s fill/stroke signature (the non-color glyph channel) is not identical across every kind', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const opacityOutputs = matchExpressionOutputs(pointLayer.paint?.['circle-opacity']);
  const strokeWidthOutputs = matchExpressionOutputs(pointLayer.paint?.['circle-stroke-width']);
  // At least one kind (institution, the "ring" glyph) must differ from the others on both
  // opacity (mostly hollow) and stroke-width (thick) proof the glyph channel is real, not
  // decorative filler that happens to be identical everywhere.
  assert.ok(new Set(opacityOutputs).size > 1, 'circle-opacity must differ across kinds (fill vs. mostly-hollow)');
  assert.ok(new Set(strokeWidthOutputs).size > 1, 'circle-stroke-width must differ across kinds (thin vs. thick rim)');
});

test('the institution "ring" glyph is mostly hollow with a thick Stone-sourced stroke', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const opacityExpr = pointLayer.paint?.['circle-opacity'] as unknown[];
  const strokeColorExpr = pointLayer.paint?.['circle-stroke-color'] as unknown[];
  const institutionIndex = (opacityExpr as unknown[]).indexOf('institution');
  assert.ok(institutionIndex > 0, 'expected "institution" as a match case in circle-opacity');
  assert.ok((opacityExpr[institutionIndex + 1] as number) < 1, 'institution fill must be less than fully opaque (a ring, not a solid dot)');
  const strokeInstitutionIndex = strokeColorExpr.indexOf('institution');
  assert.equal(strokeColorExpr[strokeInstitutionIndex + 1], DIGNITY_PALETTE.kindInstitutionStroke);
});

test('the event kind gets a second, unfilled glyph-ring layer filtered to kind === "event"', () => {
  const style = buildStyleFixture('presence');
  const eventGlyphLayer = layerById(style, EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID);
  assert.equal(eventGlyphLayer.paint?.['circle-opacity'], 0, 'the event glyph ring must be unfilled (stroke only)');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  assert.deepEqual(
    eventGlyphLayer.paint?.['circle-stroke-color'],
    pointLayer.paint?.['circle-color'],
  );
  const layerSpec = style.layers.find((layer) => layer.id === EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID) as {
    filter?: unknown;
  };
  assert.deepEqual(layerSpec.filter, ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'event']]);
});

test('point and halo radii are literally markerRadiusExpression()/markerHaloRadiusExpression() (one source of truth with marker-size.ts)', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const haloLayer = layerById(style, EXPLORE_UNCLUSTERED_HALO_LAYER_ID);
  assert.deepEqual(pointLayer.paint?.['circle-radius'], markerRadiusExpression());
  assert.deepEqual(haloLayer.paint?.['circle-radius'], markerHaloRadiusExpression());
});

test('clusters use zoom-scaled count-step radii from CLUSTER_RADIUS_BY_COUNT', () => {
  const style = buildStyleFixture('presence');
  const clusterLayer = layerById(style, EXPLORE_CLUSTER_LAYER_ID);
  const radius = clusterLayer.paint?.['circle-radius'] as unknown[];
  assert.equal(radius[0], 'interpolate');
  assert.deepEqual(radius[2], ['zoom']);
  assert.equal(radius[3], 3);
  assert.equal(radius[5], 5.5);
  assert.equal(radius[7], 9);
  const nationalStep = (radius[4] as unknown[])[1] as unknown[];
  assert.equal(nationalStep[0], 'step');
  assert.deepEqual(nationalStep.slice(2), [10, 10, 14, 50, 18, 200, 22]);
});
