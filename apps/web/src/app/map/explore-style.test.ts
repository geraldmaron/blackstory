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
import { DIGNITY_PALETTE, EXPLORE_CLUSTER_CONFIG, plateForScheme } from '../../lib/map-experience';
import { brandPalette, lightnessDelta, mapPalettes } from '@repo/ui';
import {
  COUNTY_LABELS_MIN_ZOOM,
  COUNTY_LINES_MIN_ZOOM,
} from '../../lib/map-experience/us-county-lines';
import { STATE_LABEL_FADE_END_ZOOM } from '../../lib/map-experience/state-labels';
import {
  buildExploreMapStyle,
  EXPLORE_CLUSTER_COUNT_LAYER_ID,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_JURISDICTION_TAG_LAYER_ID,
  EXPLORE_SELECTED_TAG_LAYER_ID,
  EXPLORE_COUNTY_CHOROPLETH_LAYER_ID,
  EXPLORE_COUNTY_LABEL_LAYER_ID,
  EXPLORE_COUNTY_LINES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_INCOMING_LAYER_ID,
  EXPLORE_HISTORY_EDGES_LAYER_ID,
  EXPLORE_HISTORY_EDGES_SELECTED_LAYER_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_SELECTED_POINT_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
  EXPLORE_STATE_LABEL_LAYER_ID,
  EXPLORE_STATE_LABEL_SELECTED_LAYER_ID,
  EXPLORE_STATE_LABELS_SOURCE_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  JURISDICTION_TAG_MIN_ZOOM,
  PLATE_BACKGROUND_OPACITY,
  PLATE_STATE_FILL_OPACITY,
  selectedPointFilterExpression,
  selectedTagFilterExpression,
  stateLabelFilters,
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

test('the entities source groups nearby records and carries no kind counters', () => {
  const style = buildStyleFixture('presence');
  const entitiesSource = style.sources['explore-entities'] as {
    cluster?: boolean;
    clusterRadius?: number;
    clusterMaxZoom?: number;
    clusterProperties?: Record<string, unknown>;
  };
  assert.equal(entitiesSource.cluster, true);
  assert.equal(entitiesSource.clusterRadius, EXPLORE_CLUSTER_CONFIG.clusterRadius);
  assert.equal(entitiesSource.clusterMaxZoom, EXPLORE_CLUSTER_CONFIG.clusterMaxZoom);
  assert.equal(entitiesSource.clusterProperties, undefined);
  // A framed city-precision record (zoom 10) always draws as its own mark.
  assert.ok(EXPLORE_CLUSTER_CONFIG.clusterMaxZoom < 10);
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

test('selected-entity layer exists and starts with an empty filter', () => {
  const style = buildStyleFixture('presence');
  const selected = style.layers.find((layer) => layer.id === EXPLORE_SELECTED_POINT_LAYER_ID) as {
    filter?: unknown;
    paint?: Record<string, unknown>;
  };
  assert.ok(selected, 'expected selected point layer');
  assert.deepEqual(selected.filter, ['==', ['get', 'entityId'], '']);
  assert.equal(selected.paint?.['circle-color'], DIGNITY_PALETTE.point);
});

test('selectedPointFilterExpression matches only the selected feature, never all/none ambiguously', () => {
  assert.deepEqual(selectedPointFilterExpression(undefined), ['==', ['get', 'entityId'], '']);
  assert.deepEqual(selectedPointFilterExpression(''), ['==', ['get', 'entityId'], '']);
  assert.deepEqual(selectedPointFilterExpression('e-123'), ['==', ['get', 'entityId'], 'e-123']);
  // Deselecting (undefined) after a selection must resolve back to the same empty-match
  // filter the style boots with — no feature's `entityId` is ever `''`, so this matches
  // zero features rather than "select everything".
  assert.deepEqual(selectedPointFilterExpression(undefined), ['==', ['get', 'entityId'], '']);
});

test('selection touches only the dedicated ring layer — main entity layers never filter/paint on entityId', () => {
  const style = buildStyleFixture('presence');
  // Selecting/deselecting must remain single-feature: the shared point/halo/cluster layers that
  // paint every pin carry no filter or paint expression that reads `entityId`, so a selection
  // change can only ever update EXPLORE_SELECTED_POINT_LAYER_ID's filter, never re-filter or
  // re-encode the layers/source neighboring pins render from (patterns-cinematic-map.md §2 rule 5).
  const neighborLayerIds = [
    EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    EXPLORE_CLUSTER_LAYER_ID,
    EXPLORE_JURISDICTION_TAG_LAYER_ID,
  ];
  for (const id of neighborLayerIds) {
    const layer = layerById(style, id) as LayerLike & { filter?: unknown };
    const serializedFilter = JSON.stringify(layer.filter ?? null);
    const serializedPaint = JSON.stringify(layer.paint ?? {});
    assert.ok(
      !serializedFilter.includes('entityId'),
      `${id}'s filter must not depend on entityId/selection`,
    );
    assert.ok(
      !serializedPaint.includes('entityId'),
      `${id}'s paint must not depend on entityId/selection`,
    );
  }
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
  const allowed = new Set<string>([
    ...Object.values(DIGNITY_PALETTE),
    ...Object.values(plateForScheme('dark')),
  ]);
  // The state-bounds line/background/text layers also draw from the dignity palette or the
  // shared brand tokens; the cluster/point/halo/event-glyph layers below are the ones the
  // dignity rule is specifically about (plain string paint values here; kind-keyed `match`
  // expressions are validated separately below, since `typeof value !== 'string'` skips arrays).
  const dignityGatedLayerIds = [
    EXPLORE_CLUSTER_LAYER_ID,
    EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
    EXPLORE_SELECTED_POINT_LAYER_ID,
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

  // With no data to show, this layer is simply the landmass.
  const densityLayerOff = layerById(off, EXPLORE_STATE_DENSITY_LAYER_ID);
  assert.equal(densityLayerOff.paint?.['fill-color'], plateForScheme('dark').land);
});

test('the land stays one flat value: no landcover fill, and streets are one quiet line', () => {
  const style = buildStyleFixture('presence');
  assert.ok(style.sources['openfreemap'], 'expected openfreemap vector source');
  assert.ok(!style.layers.some((layer) => layer.id === 'plate-landcover'));
  assert.ok(!style.layers.some((layer) => layer.id === 'explore-street-casing'));
  assert.ok(style.layers.some((layer) => layer.id === 'explore-street-fill'));
  assert.ok(style.layers.some((layer) => layer.id === 'explore-street-label'));
});

test('plate-road paints the design-law `road` role and hands off to the local street layers at z8', () => {
  // `plate.road` (design-direction-v9-atlas.md's "Motorway/trunk/primary, minzoom: 6")
  // had zero consumers: the local street layer uses its own, separately-tuned `street` literal,
  // not this token.
  const source = buildExploreMapSource(listPublicEntities());
  for (const colorScheme of ['light', 'dark'] as const) {
    const style = buildExploreMapStyle({
      featureCollection: source.featureCollection,
      jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
      layerMode: 'off',
      colorScheme,
    });
    const roadLayer = layerById(style, 'plate-road') as {
      type?: string;
      source?: string;
      'source-layer'?: string;
      minzoom?: number;
      maxzoom?: number;
      filter?: unknown;
      paint?: { 'line-color'?: unknown };
    };
    assert.equal(roadLayer.type, 'line');
    assert.equal(roadLayer.source, 'openfreemap');
    assert.equal(roadLayer['source-layer'], 'transportation');
    assert.equal(roadLayer.minzoom, 6);
    // Must not overlap explore-street-fill's own minzoom: 8, or the same roads paint twice.
    assert.equal(roadLayer.maxzoom, 8);
    assert.deepEqual(roadLayer.filter, [
      'match',
      ['get', 'class'],
      ['motorway', 'trunk', 'primary'],
      true,
      false,
    ]);
    assert.equal(roadLayer.paint?.['line-color'], mapPalettes[colorScheme].road);
  }
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

test('streets keep a motorway-to-minor width hierarchy at a third of the ink at most', () => {
  const style = buildStyleFixture('presence');
  const fill = layerById(style, 'explore-street-fill');
  const fillZ14 = streetWidthMatchAtZoom(fill.paint?.['line-width'], 14);
  const fillZ12 = streetWidthMatchAtZoom(fill.paint?.['line-width'], 12);
  assert.equal(widthForClass(fillZ12, 'trunk'), 1.0);
  assert.equal(widthForClass(fillZ14, 'trunk'), 2.0);
  const order = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'] as const;
  for (let i = 0; i < order.length - 1; i++) {
    assert.ok(
      widthForClass(fillZ14, order[i]!) > widthForClass(fillZ14, order[i + 1]!),
      `z14 ${order[i]} must exceed ${order[i + 1]}`,
    );
  }
  // Major roads are one step stronger than the rest, nothing more.
  assert.deepEqual(fill.paint?.['line-opacity'], [
    'match',
    ['get', 'class'],
    ['motorway', 'trunk', 'primary'],
    1,
    0.72,
  ]);
  for (const scheme of ['light', 'dark'] as const) {
    const alpha = Number(/,\s*([\d.]+)\)$/.exec(plateForScheme(scheme).street)?.[1]);
    assert.ok(alpha <= 0.35, `${scheme} street ink is ${alpha}`);
  }
});

test('the plate reads as a map: land, water and boundaries come from the tokens', () => {
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
  // The background is land, and the tiles' `water` source-layer paints the oceans and lakes
  // over it. That is what produces a real coastline: the previous pairing (water background,
  // state polygons as the only landmass) drew the United States floating with no continent
  // around it, no Great Lakes and no Gulf.
  const darkBg = layerById(dark, 'background').paint?.['background-color'];
  const lightBg = layerById(light, 'background').paint?.['background-color'];
  assert.equal(darkBg, mapPalettes.dark.land);
  assert.equal(lightBg, mapPalettes.light.land);
  assert.notEqual(darkBg, lightBg);

  // The water fill is the coastline. Without this layer the plate has no sea.
  assert.equal(layerById(dark, 'plate-water').paint?.['fill-color'], mapPalettes.dark.water);
  assert.equal(
    layerById(light, 'plate-water').paint?.['fill-color'],
    plateForScheme('light').water,
  );
  assert.equal(
    layerById(light, 'plate-boundary-country').paint?.['line-color'],
    mapPalettes.light.line2,
  );
  const lightPlate = plateForScheme('light');
  // Light water is a neutral gray, not the token's tan: no fill near the copper hue.
  assert.notEqual(lightPlate.water, mapPalettes.light.water);
  assert.equal(lightPlate.land, mapPalettes.light.land);
  assert.equal(lightPlate.stateBounds, mapPalettes.light.line);
  // County lines are deliberately not a token: §3's `line-2` is the country border, and it is
  // heavier than `line`, so wiring counties to it would make them out-read states.
  assert.equal(lightPlate.countyLine, brandPalette.stone);
  assert.notEqual(lightPlate.countyLine, mapPalettes.light.line2);

  // The separation itself, in both themes. `map-contrast.test.ts` guards the token table; this
  // guards that the rendered plate is actually wired to it.
  for (const scheme of ['light', 'dark'] as const) {
    const plate = plateForScheme(scheme);
    assert.ok(
      lightnessDelta(plate.land, plate.water) >= 18,
      `${scheme} land/water is ${lightnessDelta(plate.land, plate.water).toFixed(2)} ΔL*, needs 18`,
    );
  }

  // The landmass itself, in both schemes: with the presence layer off, the state fill IS the land.
  // Asserted per scheme because a style built for the wrong one still passes every dark-only check.
  assert.equal(
    layerById(light, EXPLORE_STATE_DENSITY_LAYER_ID).paint?.['fill-color'],
    mapPalettes.light.land,
  );
  assert.equal(
    layerById(dark, EXPLORE_STATE_DENSITY_LAYER_ID).paint?.['fill-color'],
    mapPalettes.dark.land,
  );

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
    (layer) => layer.id === EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
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

test('dark plate draws its water and boundaries from the dark token set', () => {
  const source = buildExploreMapSource(listPublicEntities());
  const dark = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'off',
    colorScheme: 'dark',
  });
  const darkPlate = plateForScheme('dark');
  assert.equal(layerById(dark, 'background').paint?.['background-color'], mapPalettes.dark.land);
  assert.equal(layerById(dark, 'plate-water').paint?.['fill-color'], mapPalettes.dark.water);
  assert.equal(darkPlate.water, mapPalettes.dark.water);
  assert.equal(
    layerById(dark, 'explore-state-bounds-line').paint?.['line-color'],
    darkPlate.stateBounds,
  );
  assert.equal(darkPlate.stateBounds, mapPalettes.dark.line);

  // Defect §0 #11's second symptom: state lines vanishing at continental zoom. They have to
  // separate from the land they are drawn on.
  assert.ok(
    lightnessDelta(darkPlate.land, darkPlate.stateBounds) >= 12,
    `dark land/state-bounds is ${lightnessDelta(darkPlate.land, darkPlate.stateBounds).toFixed(2)} ΔL*`,
  );
});

test('plate fills stay opaque', () => {
  assert.equal(PLATE_BACKGROUND_OPACITY, 1, 'ocean plate is fully opaque');
  assert.ok(
    PLATE_STATE_FILL_OPACITY < 1,
    'the density tint sits over real cartography, so it must not be opaque',
  );

  const style = buildStyleFixture('presence');
  assert.equal(
    layerById(style, 'background').paint?.['background-opacity'],
    PLATE_BACKGROUND_OPACITY,
  );
  // Presence encoding is active in this fixture, so the tint paints at its declared opacity.
  assert.equal(
    layerById(style, EXPLORE_STATE_DENSITY_LAYER_ID).paint?.['fill-opacity'],
    PLATE_STATE_FILL_OPACITY,
  );
});

test('no memorial name is painted on the plate — the layer id is absent from the built style', () => {
  // Every layer mode, not just 'presence': the population modes rebuild the layer list, so a
  // reintroduced memorial layer could hide in a mode this test never built. The check is on the
  // substring rather than the retired `explore-memorial-names` id because the defect to guard is
  // "a victim's name is painted as basemap furniture", not "this exact string came back".
  for (const mode of ['off', 'presence', 'blackShare', 'blackChange'] as const) {
    const style = buildStyleFixture(mode);
    const layerIds = (style.layers ?? []).map((layer) => layer.id);
    assert.ok(
      !layerIds.some((id) => id.includes('memorial')),
      `SP-08 deleted the memorial names layer; no layer id may reference it (mode: ${mode})`,
    );
    assert.ok(
      !Object.keys(style.sources ?? {}).some((id) => id.includes('memorial')),
      `SP-08 deleted the memorial names source; no source id may reference it (mode: ${mode})`,
    );
  }
});

test('both entity buffers promote entityId, so the decade morph can address records by id', () => {
  /*
   * `setFeatureState` addresses a feature by its id, and a GeoJSON source has none
   * unless one is promoted from the properties. Both buffers need it, because the hold marks are
   * written to each: rest on the current buffer, zero on the incoming one.
   *
   * Safe alongside clustering, and this is the part worth stating rather than assuming. MapLibre's
   * own `getId` (maplibre-gl 5.24, GeoJSONSource) reads the promoted property first and falls back
   * to `cluster_id` only when that property is absent — which is exactly the cluster case, since a
   * cluster carries no `entityId`. So leaves are addressable by record id and clusters keep their
   * generated ids and go on animating, which is correct: a cluster is a different shape in each
   * decade.
   */
  const style = buildStyleFixture('presence');
  for (const sourceId of ['explore-entities', 'explore-entities-incoming']) {
    const source = style.sources[sourceId] as { promoteId?: string; cluster?: boolean };
    assert.equal(source.promoteId, 'entityId', `${sourceId} must promote entityId`);
    assert.equal(source.cluster, true, `${sourceId} still clusters`);
  }
});

function sourceFeatures(style: ReturnType<typeof buildStyleFixture>, id: string) {
  return (style.sources[id] as { data: { features: { properties: Record<string, unknown> }[] } })
    .data.features;
}

test('county- and state-precision records never reach the map as points', () => {
  const style = buildStyleFixture('off');
  for (const row of sourceFeatures(style, 'explore-entities')) {
    assert.ok(
      !['county', 'state', 'country'].includes(String(row.properties.precision)),
      `${String(row.properties.entityId)} is drawn sharper than its stored precision`,
    );
  }
});

test('the mark is a dot for site precision and a hollow ring for neighborhood or city', () => {
  const style = buildStyleFixture('off');
  const point = layerById(style, EXPLORE_UNCLUSTERED_POINT_LAYER_ID);
  const radius = point.paint?.['circle-radius'] as unknown[];
  assert.equal(radius[0], 'case');
  const match = radius[1] as unknown[];
  assert.equal(match[0], 'match');
  assert.deepEqual(match[1], ['get', 'precision']);
  assert.deepEqual([...(match[2] as string[])].sort(), [
    'address',
    'campus',
    'institution',
    'site',
  ]);
  assert.equal(radius[2], 4, '8px dot');
  assert.equal(radius[3], 7, '14px ring');
  const fill = point.paint?.['circle-color'] as unknown[];
  assert.equal(fill[3], 'rgba(0,0,0,0)', 'the ring is hollow');
  assert.ok(!JSON.stringify(point.paint).includes('kind'), 'kind is never encoded on the mark');
});

test('groups are paper circles in three sizes with a count, never copper', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const source = buildExploreMapSource(listPublicEntities());
    const style = buildExploreMapStyle({
      featureCollection: source.featureCollection,
      jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
      layerMode: 'off',
      colorScheme: scheme,
    });
    const group = layerById(style, EXPLORE_CLUSTER_LAYER_ID);
    const plate = plateForScheme(scheme);
    assert.equal(group.paint?.['circle-color'], plate.groupFill);
    assert.notEqual(group.paint?.['circle-color'], DIGNITY_PALETTE.point);
    const steps = group.paint?.['circle-radius'] as unknown[];
    assert.equal(steps[0], 'step');
    assert.equal(steps.length, 7, 'three size steps');
    const count = layerById(style, EXPLORE_CLUSTER_COUNT_LAYER_ID);
    assert.equal(count.paint?.['text-color'], plate.groupText);
  }
});

test('the selected mark is copper with a paper halo; the selected tag is copper', () => {
  const style = buildStyleFixture('off');
  const selected = layerById(style, EXPLORE_SELECTED_POINT_LAYER_ID);
  assert.equal(selected.paint?.['circle-color'], DIGNITY_PALETTE.point);
  assert.equal(selected.paint?.['circle-stroke-width'], 2);
  assert.equal(selected.paint?.['circle-stroke-color'], plateForScheme('dark').selectedHalo);
  const tag = layerById(style, EXPLORE_SELECTED_TAG_LAYER_ID);
  assert.equal(tag.paint?.['text-color'], DIGNITY_PALETTE.point);
  assert.deepEqual(selectedTagFilterExpression('ent_a'), ['in', '|ent_a|', ['get', 'ids']]);
});

test('record density is off by default: no copper state choropleth at rest', () => {
  const style = buildStyleFixture('off');
  const density = layerById(style, EXPLORE_STATE_DENSITY_LAYER_ID);
  assert.equal(density.paint?.['fill-opacity'], 0);
});

test('jurisdiction tags stay off the national view and give way to group counts', () => {
  const style = buildStyleFixture('off');
  const ids = style.layers.map((layer) => layer.id);
  const tag = layerById(style, EXPLORE_JURISDICTION_TAG_LAYER_ID) as LayerLike & {
    minzoom?: number;
  };
  // National scale is about z3.5 to z4.5; tags begin at regional zoom, one per state.
  assert.ok((tag.minzoom ?? 0) >= 5, 'tags must not draw at national scale');
  assert.equal(JURISDICTION_TAG_MIN_ZOOM, 5.5);
  // MapLibre places symbols top layer first. The counts sit above the tags, so they claim their
  // place first and a tag that would touch a group is dropped instead of drawn over it.
  assert.ok(
    ids.indexOf(EXPLORE_JURISDICTION_TAG_LAYER_ID) < ids.indexOf(EXPLORE_CLUSTER_COUNT_LAYER_ID),
  );
  assert.ok(
    ids.indexOf(EXPLORE_JURISDICTION_TAG_LAYER_ID) <
      ids.indexOf(EXPLORE_UNCLUSTERED_POINT_LAYER_ID),
  );
  const count = layerById(style, EXPLORE_CLUSTER_COUNT_LAYER_ID);
  // Counts always draw (legible), and reserve the group circle in the collision index.
  assert.equal(count.layout?.['text-allow-overlap'], true);
  assert.ok(Number(count.layout?.['text-padding']) >= 15);
  assert.notEqual(count.layout?.['text-ignore-placement'], true);
  assert.notEqual(tag.layout?.['text-allow-overlap'], true);
});

test('state labels are a symbol layer under the groups, so a label yields to a count', () => {
  const style = buildStyleFixture('off');
  const ids = style.layers.map((layer) => layer.id);
  for (const id of [EXPLORE_STATE_LABEL_LAYER_ID, EXPLORE_STATE_LABEL_SELECTED_LAYER_ID]) {
    const label = layerById(style, id) as LayerLike & { type?: string; maxzoom?: number };
    assert.equal(label.type, 'symbol');
    // Below every record mark, group circle and count: MapLibre places top layers first.
    assert.ok(ids.indexOf(id) < ids.indexOf(EXPLORE_UNCLUSTERED_POINT_LAYER_ID));
    assert.ok(ids.indexOf(id) < ids.indexOf(EXPLORE_CLUSTER_LAYER_ID));
    assert.ok(ids.indexOf(id) < ids.indexOf(EXPLORE_CLUSTER_COUNT_LAYER_ID));
    assert.notEqual(label.layout?.['text-allow-overlap'], true);
    assert.equal(label.maxzoom, STATE_LABEL_FADE_END_ZOOM);
  }
  // Selection swaps two filters; nothing else about the labels changes.
  assert.deepEqual(stateLabelFilters('NY'), {
    rest: ['!=', ['get', 'postalCode'], 'NY'],
    selected: ['==', ['get', 'postalCode'], 'NY'],
  });
  const source = style.sources[EXPLORE_STATE_LABELS_SOURCE_ID] as {
    data: { features: readonly unknown[] };
  };
  assert.equal(source.data.features.length, 51);
});
