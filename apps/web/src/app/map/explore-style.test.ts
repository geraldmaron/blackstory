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
import {
  DIGNITY_PALETTE,
  EXPLORE_CLUSTER_CONFIG,
  LIGHT_PLATE_OCEAN,
  plateForScheme,
} from '../../lib/map-experience';
import { brandPalette } from '@repo/ui';
import { KIND_FAMILY_ENTRIES } from '../../lib/map-experience/kind-encoding';
import {
  markerHaloRadiusExpression,
  markerRadiusExpression,
} from '../../lib/map-experience/marker-size';
import {
  COUNTY_LABELS_MIN_ZOOM,
  COUNTY_LINES_MIN_ZOOM,
} from '../../lib/map-experience/us-county-lines';
import { STATE_LABEL_FADE_END_ZOOM } from '../../lib/map-experience/state-labels';
import {
  buildExploreMapStyle,
  ENTITY_CLUSTER_OPACITY,
  ENTITY_HALO_OPACITY,
  ENTITY_POINT_FILL_OPACITY,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_MEMORIAL_NAMES_LAYER_ID,
  EXPLORE_MEMORIAL_NAMES_SOURCE_ID,
  MEMORIAL_NAMES_MAP_LAYER_ENABLED,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  PLATE_BACKGROUND_OPACITY,
  PLATE_STATE_FILL_OPACITY,
} from './explore-style';

type LayerLike = {
  readonly id: string;
  readonly type?: string;
  readonly paint?: Record<string, unknown>;
  readonly layout?: Record<string, unknown>;
};

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

function buildStyleFixture(
  layerMode: 'off' | 'presence' | 'blackShare' | 'blackChange',
  popGeo: 'state' | 'county' = 'county',
) {
  const source = buildExploreMapSource(listPublicEntities());
  return buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode,
    popGeo,
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
    opacityOutputs.every(
      (value) => typeof value === 'number' && value <= ENTITY_POINT_FILL_OPACITY,
    ),
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

test('state density source starts empty with promoteId for feature-state morphs', () => {
  const style = buildStyleFixture('presence');
  const stateSource = style.sources['explore-state-density'] as {
    promoteId?: string;
    data?: { type?: string; features?: unknown[] };
  };
  assert.equal(stateSource.promoteId, 'id');
  assert.equal(stateSource.data?.type, 'FeatureCollection');
  assert.deepEqual(stateSource.data?.features, []);
  const incoming = style.sources['explore-state-density-incoming'] as {
    data?: { type?: string; features?: unknown[] };
  };
  assert.equal(incoming.data?.type, 'FeatureCollection');
  assert.deepEqual(incoming.data?.features, []);
});

test('dual-buffer incoming density fill starts at opacity 0 for crossdissolve', () => {
  const style = buildStyleFixture('presence');
  const incoming = style.layers.find(
    (layer) => layer.id === 'explore-state-density-fill-incoming',
  ) as {
    paint?: { 'fill-opacity'?: number };
    source?: string;
  };
  assert.ok(incoming, 'expected incoming density fill layer');
  assert.equal(incoming.source, 'explore-state-density-incoming');
  assert.equal(incoming.paint?.['fill-opacity'], 0);
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

test('population layer modes expose county choropleth fill keyed to shareTier / changeTier', () => {
  const share = buildStyleFixture('blackShare');
  const change = buildStyleFixture('blackChange');
  const presence = buildStyleFixture('presence');

  const shareLayer = layerById(share, EXPLORE_COUNTY_CHOROPLETH_LAYER_ID) as {
    layout?: { visibility?: string };
    paint?: { 'fill-opacity'?: number; 'fill-color'?: unknown };
    minzoom?: number;
  };
  const changeLayer = layerById(change, EXPLORE_COUNTY_CHOROPLETH_LAYER_ID) as {
    layout?: { visibility?: string };
    paint?: { 'fill-color'?: unknown };
  };
  const hidden = layerById(presence, EXPLORE_COUNTY_CHOROPLETH_LAYER_ID) as {
    layout?: { visibility?: string };
    paint?: { 'fill-opacity'?: number };
  };

  assert.equal(shareLayer.layout?.visibility, 'visible');
  assert.equal(shareLayer.paint?.['fill-opacity'], 0.85);
  assert.equal(shareLayer.minzoom, undefined, 'national frame must show share fills');
  assert.deepEqual((shareLayer.paint?.['fill-color'] as unknown[])?.slice(0, 3), [
    'match',
    ['get', 'shareTier'],
    'majority',
  ]);

  assert.equal(changeLayer.layout?.visibility, 'visible');
  assert.deepEqual((changeLayer.paint?.['fill-color'] as unknown[])?.slice(0, 3), [
    'match',
    ['get', 'changeTier'],
    'gainStrong',
  ]);

  assert.equal(hidden.layout?.visibility, 'none');
  assert.equal(hidden.paint?.['fill-opacity'], 0);
});

test('state population share paints on the state density layer, not county choropleth', () => {
  const share = buildStyleFixture('blackShare', 'state');
  const stateLayer = layerById(share, EXPLORE_STATE_DENSITY_LAYER_ID) as {
    paint?: { 'fill-color'?: unknown };
  };
  const countyLayer = layerById(share, EXPLORE_COUNTY_CHOROPLETH_LAYER_ID) as {
    layout?: { visibility?: string };
    paint?: { 'fill-opacity'?: number };
  };
  assert.deepEqual((stateLayer.paint?.['fill-color'] as unknown[])?.slice(0, 3), [
    'match',
    ['get', 'shareTier'],
    'majority',
  ]);
  assert.equal(countyLayer.layout?.visibility, 'none');
  assert.equal(countyLayer.paint?.['fill-opacity'], 0);
});

test('the jurisdiction-area layer renders fill geometry (never a point layer) and is empty by default', () => {
  const style = buildStyleFixture('presence');
  const areaLayer = style.layers.find((layer) => layer.id === EXPLORE_JURISDICTION_AREA_LAYER_ID);
  assert.equal(areaLayer?.type, 'fill');
  const areaSource = style.sources['explore-jurisdiction-areas'] as {
    data: { features: readonly unknown[] };
  };
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
      assert.ok(
        allowed.has(value),
        `layer "${layer.id}" paint "${key}" = "${value}" must come from DIGNITY_PALETTE`,
      );
    }
  }
});

test('the state-selected fill and density fallback tints are relocated DIGNITY_PALETTE tokens, not ad-hoc literals', () => {
  const on = buildStyleFixture('presence');
  const off = buildStyleFixture('off');
  const selectedFillLayer = layerById(on, 'explore-state-selected-fill');
  assert.equal(selectedFillLayer.paint?.['fill-color'], DIGNITY_PALETTE.selectedStateFill);

  const densityLayerOn = layerById(on, EXPLORE_STATE_DENSITY_LAYER_ID);
  const fillColor = densityLayerOn.paint?.['fill-color'] as unknown[];
  assert.equal(fillColor[0], 'interpolate');
  assert.deepEqual(fillColor[2], ['coalesce', ['feature-state', 'blend'], 0]);

  const colorAExpr = fillColor[4] as unknown[];
  const restingColor = colorAExpr[2] as unknown[];
  const tierFallback = restingColor[2] as unknown[];
  const tierOutputs = matchExpressionOutputs(tierFallback);
  assert.ok(tierOutputs.includes(DIGNITY_PALETTE.densityUnknownFill));

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

/** Pull the class→width match expression nested at a zoom stop inside a street line-width interpolate. */
function streetWidthMatchAtZoom(lineWidth: unknown, zoom: number): unknown[] {
  const expr = lineWidth as unknown[];
  assert.equal(expr[0], 'interpolate');
  assert.deepEqual(expr[2], ['zoom']);
  const zoomIndex = expr.indexOf(zoom);
  assert.ok(zoomIndex > 0, `expected zoom stop ${zoom} in street line-width`);
  const match = expr[zoomIndex + 1] as unknown[];
  assert.equal(match[0], 'match');
  assert.deepEqual(match[1], ['get', 'class']);
  return match;
}

function widthForClass(matchExpr: unknown[], roadClass: string): number {
  const index = matchExpr.indexOf(roadClass);
  assert.ok(index > 0, `expected class "${roadClass}" in road-class match`);
  return matchExpr[index + 1] as number;
}

test('street casing and fill use muted zoom stops with motorway→minor class hierarchy', () => {
  const style = buildStyleFixture('presence');
  const casing = layerById(style, 'explore-street-casing');
  const fill = layerById(style, 'explore-street-fill');
  const casingZ14 = streetWidthMatchAtZoom(casing.paint?.['line-width'], 14);
  const fillZ14 = streetWidthMatchAtZoom(fill.paint?.['line-width'], 14);
  const casingZ12 = streetWidthMatchAtZoom(casing.paint?.['line-width'], 12);
  const fillZ12 = streetWidthMatchAtZoom(fill.paint?.['line-width'], 12);

  assert.equal(widthForClass(casingZ14, 'motorway'), 4);
  assert.equal(widthForClass(casingZ14, 'trunk'), 3.5);
  assert.equal(widthForClass(casingZ14, 'primary'), 3);
  assert.equal(widthForClass(casingZ14, 'secondary'), 2.2);
  assert.equal(widthForClass(casingZ14, 'tertiary'), 1.6);
  assert.equal(widthForClass(casingZ14, 'minor'), 1.2);
  assert.equal(casingZ14[casingZ14.length - 1], 0.8);

  assert.equal(widthForClass(casingZ12, 'trunk'), 1.8);
  assert.equal(widthForClass(fillZ12, 'trunk'), 1.0);
  assert.equal(widthForClass(fillZ14, 'trunk'), 2.0);

  // Fill stays thinner than casing at every named class (and the fallback).
  for (const roadClass of [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'minor',
  ] as const) {
    assert.ok(
      widthForClass(fillZ14, roadClass) < widthForClass(casingZ14, roadClass),
      `${roadClass} fill must be thinner than casing at z14`,
    );
    assert.ok(
      widthForClass(fillZ12, roadClass) < widthForClass(casingZ12, roadClass),
      `${roadClass} fill must be thinner than casing at z12`,
    );
  }
  assert.ok((fillZ14[fillZ14.length - 1] as number) < (casingZ14[casingZ14.length - 1] as number));

  // Hierarchy: motorway > trunk > primary > secondary > tertiary > minor > fallback
  const casingOrder = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'] as const;
  for (let i = 0; i < casingOrder.length - 1; i++) {
    assert.ok(
      widthForClass(casingZ14, casingOrder[i]!) > widthForClass(casingZ14, casingOrder[i + 1]!),
      `casing z14 ${casingOrder[i]} must exceed ${casingOrder[i + 1]}`,
    );
  }
  assert.ok(widthForClass(casingZ14, 'minor') > (casingZ14[casingZ14.length - 1] as number));
});

test('light colorScheme uses a white plate with brown state bounds and stone county lines', () => {
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
  assert.equal(lightBg, LIGHT_PLATE_OCEAN);
  assert.notEqual(darkBg, lightBg);

  const lightPlate = plateForScheme('light');
  assert.equal(lightPlate.ocean, LIGHT_PLATE_OCEAN);
  assert.equal(lightPlate.stateBounds, brandPalette.copperTextLight);
  assert.equal(lightPlate.countyLine, brandPalette.stone);

  const stateBounds = layerById(light, 'explore-state-bounds-line');
  assert.equal(stateBounds.paint?.['line-color'], lightPlate.stateBounds);

  const countyLines = layerById(light, EXPLORE_COUNTY_LINES_LAYER_ID);
  assert.equal(countyLines.paint?.['line-color'], lightPlate.countyLine);
  assert.notEqual(countyLines.paint?.['line-color'], lightPlate.selected);
});

test('history relationship edge lines use theme-aware copper and toggle visibility', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const lightOff = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'presence',
    colorScheme: 'light',
    historyEdgesEnabled: false,
  });
  const lightOn = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'presence',
    colorScheme: 'light',
    historyEdgesEnabled: true,
  });
  const darkOn = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'presence',
    colorScheme: 'dark',
    historyEdgesEnabled: true,
  });

  const lightPlate = plateForScheme('light');
  const darkPlate = plateForScheme('dark');

  const lightEdge = layerById(lightOn, EXPLORE_HISTORY_EDGES_LAYER_ID);
  const lightIncoming = layerById(lightOn, EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID);
  const lightSelected = layerById(lightOn, EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID);
  const lightEdgeOff = layerById(lightOff, EXPLORE_HISTORY_EDGES_LAYER_ID);
  const darkEdge = layerById(darkOn, EXPLORE_HISTORY_EDGES_LAYER_ID);
  const darkSelected = layerById(darkOn, EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID);

  assert.equal(lightEdgeOff.layout?.visibility, 'none');
  assert.equal(lightEdge.layout?.visibility, 'visible');
  assert.equal(lightIncoming.layout?.visibility, 'visible');
  assert.equal(lightSelected.layout?.visibility, 'visible');

  // pageSand vanishes on the white plate — edges must use copper text/graphic tokens.
  assert.equal(lightEdge.paint?.['line-color'], lightPlate.historyEdge);
  assert.equal(lightEdge.paint?.['line-color'], brandPalette.copperTextLight);
  assert.notEqual(lightEdge.paint?.['line-color'], DIGNITY_PALETTE.pointHalo);
  assert.equal(lightSelected.paint?.['line-color'], lightPlate.historyEdgeSelected);
  assert.equal(lightEdge.paint?.['line-opacity'], 0.9);
  assert.equal(lightIncoming.paint?.['line-opacity'], 0);

  assert.equal(darkEdge.paint?.['line-color'], darkPlate.historyEdge);
  assert.equal(darkEdge.paint?.['line-color'], brandPalette.copperDark);
  assert.notEqual(darkEdge.paint?.['line-color'], DIGNITY_PALETTE.pointHalo);
  assert.equal(darkSelected.paint?.['line-color'], darkPlate.historyEdgeSelected);
});

test('county label symbol layer reads name from GeoJSON and sits above county lines', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const style = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
    colorScheme: 'light',
  });
  const labelLayer = layerById(style, EXPLORE_COUNTY_LABEL_LAYER_ID) as {
    type?: string;
    source?: string;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  };
  assert.equal(labelLayer.type, 'symbol');
  assert.equal(labelLayer.source, 'explore-county-lines');
  assert.deepEqual(labelLayer.layout?.['text-field'], ['get', 'name']);
  assert.deepEqual(labelLayer.layout?.['text-font'], ['Noto Sans Regular']);

  const lineIndex = style.layers.findIndex((layer) => layer.id === EXPLORE_COUNTY_LINES_LAYER_ID);
  const labelIndex = style.layers.findIndex((layer) => layer.id === EXPLORE_COUNTY_LABEL_LAYER_ID);
  const entityIndex = style.layers.findIndex(
    (layer) => layer.id === EXPLORE_UNCLUSTERED_HALO_LAYER_ID,
  );
  assert.ok(
    lineIndex >= 0 && labelIndex > lineIndex,
    'county labels must render above county lines',
  );
  assert.ok(entityIndex > labelIndex, 'county labels must sit below entity markers');
});

test('county names stay hidden until zoomed past the state-label handoff, above the hairline gate', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const style = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
  });
  const labelLayer = layerById(style, EXPLORE_COUNTY_LABEL_LAYER_ID) as {
    minzoom?: number;
    paint?: Record<string, unknown>;
  };
  const lineLayer = layerById(style, EXPLORE_COUNTY_LINES_LAYER_ID) as { minzoom?: number };

  // Names gate strictly higher than the hairlines, and only once the state labels have faded.
  assert.equal(labelLayer.minzoom, COUNTY_LABELS_MIN_ZOOM);
  assert.equal(lineLayer.minzoom, COUNTY_LINES_MIN_ZOOM);
  assert.ok(
    (labelLayer.minzoom ?? 0) > (lineLayer.minzoom ?? 0),
    'county names must not appear at the low zoom the faint hairlines do',
  );
  assert.ok(
    (labelLayer.minzoom ?? 0) >= STATE_LABEL_FADE_END_ZOOM,
    'county names must not show while state labels are still visible',
  );

  // The opacity fade-in starts fully transparent exactly at the label min zoom (no pop-in below it).
  const opacity = labelLayer.paint?.['text-opacity'] as unknown[];
  assert.equal(opacity[0], 'interpolate');
  assert.deepEqual(opacity[2], ['zoom']);
  assert.equal(opacity[3], COUNTY_LABELS_MIN_ZOOM);
  assert.equal(opacity[4], 0);
});

test('dark colorScheme keeps the ink ocean and pageSand state bounds', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const dark = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
    colorScheme: 'dark',
  });
  assert.equal(layerById(dark, 'background').paint?.['background-color'], '#080606');
  const darkPlate = plateForScheme('dark');
  assert.equal(darkPlate.ocean, '#080606');
  assert.equal(
    layerById(dark, 'explore-state-bounds-line').paint?.['line-color'],
    darkPlate.stateBounds,
  );
  assert.equal(darkPlate.stateBounds, DIGNITY_PALETTE.pointHalo);
});

test('plate fills stay opaque — memorial names are a style layer under land, not DOM bleed', () => {
  assert.equal(PLATE_BACKGROUND_OPACITY, 1, 'ocean plate is fully opaque');
  assert.equal(PLATE_STATE_FILL_OPACITY, 1, 'state fills occlude memorial names on land');

  const style = buildStyleFixture('presence');
  assert.equal(
    layerById(style, 'background').paint?.['background-opacity'],
    PLATE_BACKGROUND_OPACITY,
  );
  assert.equal(
    layerById(style, EXPLORE_STATE_DENSITY_LAYER_ID).paint?.['fill-opacity'],
    PLATE_STATE_FILL_OPACITY,
  );
});

test('memorial names symbol layer stays wired but hidden until re-enabled', () => {
  assert.equal(
    MEMORIAL_NAMES_MAP_LAYER_ENABLED,
    false,
    'live plate memorial field is parked; flip flag to restore',
  );

  const style = buildStyleFixture('presence');
  const layerIds = (style.layers ?? []).map((layer) => layer.id);
  const backgroundIdx = layerIds.indexOf('background');
  const memorialIdx = layerIds.indexOf(EXPLORE_MEMORIAL_NAMES_LAYER_ID);
  const stateIdx = layerIds.indexOf(EXPLORE_STATE_DENSITY_LAYER_ID);
  assert.ok(backgroundIdx >= 0 && memorialIdx > backgroundIdx);
  assert.ok(stateIdx > memorialIdx, 'state fills must paint above memorial names');

  const memorial = layerById(style, EXPLORE_MEMORIAL_NAMES_LAYER_ID);
  assert.equal(memorial.type, 'symbol');
  assert.equal(memorial.layout?.visibility, 'none');
  assert.equal(memorial.layout?.['text-allow-overlap'], false);
  assert.equal(memorial.layout?.['text-ignore-placement'], false);
  assert.ok((memorial.layout?.['text-padding'] as number) <= 2);
  assert.deepEqual(memorial.layout?.['text-size'], ['get', 'size']);
  assert.deepEqual(memorial.layout?.['text-rotate'], ['get', 'rotate']);
  assert.deepEqual(memorial.layout?.['text-font'], ['Noto Sans Italic']);
  assert.deepEqual(
    memorial.layout?.['text-field'],
    ['get', 'name'],
    'memorial labels are name-only (no year/place)',
  );
  const opacity = memorial.paint?.['text-opacity'];
  assert.ok(
    JSON.stringify(opacity).includes('feature-state'),
    'text-opacity must read feature-state.passed for decade fades',
  );

  const source = style.sources?.[EXPLORE_MEMORIAL_NAMES_SOURCE_ID] as {
    data?: { features?: unknown[] };
    promoteId?: string;
  };
  assert.equal(source?.promoteId, 'id');
  assert.equal(
    source?.data?.features?.length ?? -1,
    0,
    'hidden memorial source stays empty until the layer is re-enabled',
  );
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
  const expectedShades = KIND_FAMILY_ENTRIES.map(([, entry]) => entry.shade);
  for (const shade of expectedShades) {
    assert.ok(colorOutputs.includes(shade), `expected kind shade ${shade} in circle-color`);
  }
  assert.ok(colorOutputs.includes(DIGNITY_PALETTE.kindMassacre));
  assert.ok(colorOutputs.includes(DIGNITY_PALETTE.kindPlantation));
  assert.ok(colorOutputs.includes(DIGNITY_PALETTE.kindEpicenter));
  const allowed = new Set<string>(Object.values(DIGNITY_PALETTE));
  for (const output of colorOutputs) {
    assert.ok(
      allowed.has(output),
      `circle-color output "${output}" must come from DIGNITY_PALETTE`,
    );
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

test("the point layer's fill/stroke signature (the non-color glyph channel) is not identical across every kind", () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const opacityOutputs = matchExpressionOutputs(pointLayer.paint?.['circle-opacity']);
  const strokeWidthOutputs = matchExpressionOutputs(pointLayer.paint?.['circle-stroke-width']);
  // At least one kind (institution, the "ring" glyph) must differ from the others on both
  // opacity (mostly hollow) and stroke-width (thick) proof the glyph channel is real, not
  // decorative filler that happens to be identical everywhere.
  assert.ok(
    new Set(opacityOutputs).size > 1,
    'circle-opacity must differ across kinds (fill vs. mostly-hollow)',
  );
  assert.ok(
    new Set(strokeWidthOutputs).size > 1,
    'circle-stroke-width must differ across kinds (thin vs. thick rim)',
  );
});

test('the institution "ring" glyph is mostly hollow with a thick Stone-sourced stroke', () => {
  const style = buildStyleFixture('presence');
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const opacityExpr = pointLayer.paint?.['circle-opacity'] as unknown[];
  const strokeColorExpr = pointLayer.paint?.['circle-stroke-color'] as unknown[];
  const institutionIndex = (opacityExpr as unknown[]).indexOf('institution');
  assert.ok(institutionIndex > 0, 'expected "institution" as a match case in circle-opacity');
  assert.ok(
    (opacityExpr[institutionIndex + 1] as number) < 1,
    'institution fill must be less than fully opaque (a ring, not a solid dot)',
  );
  const strokeInstitutionIndex = strokeColorExpr.indexOf('institution');
  assert.equal(strokeColorExpr[strokeInstitutionIndex + 1], DIGNITY_PALETTE.kindInstitutionStroke);
});

test('the event kind gets a second, unfilled glyph-ring layer filtered to kind === "event"', () => {
  const style = buildStyleFixture('presence');
  const eventGlyphLayer = layerById(style, EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID);
  assert.equal(
    eventGlyphLayer.paint?.['circle-opacity'],
    0,
    'the event glyph ring must be unfilled (stroke only)',
  );
  const pointLayer = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  assert.deepEqual(
    eventGlyphLayer.paint?.['circle-stroke-color'],
    pointLayer.paint?.['circle-color'],
  );
  const layerSpec = style.layers.find(
    (layer) => layer.id === EXPLORE_UNCLUSTERED_EVENT_GLYPH_LAYER_ID,
  ) as {
    filter?: unknown;
  };
  assert.deepEqual(layerSpec.filter, [
    'all',
    ['!', ['has', 'point_count']],
    ['==', ['get', 'kind'], 'event'],
  ]);
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
