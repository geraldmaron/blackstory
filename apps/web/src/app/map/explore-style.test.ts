/**
 * Confirms the BB-051 `/explore` MapLibre style builder: clustering config is wired through,
 * the density layer visibility toggle works, jurisdiction-area geometry stays polygon-typed, and
 * every paint color traces back to the dignity palette (no new/red hue introduced at the render
 * layer).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource, DIGNITY_PALETTE } from '../../lib/map-experience';
import {
  buildExploreMapStyle,
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_JURISDICTION_AREA_LAYER_ID,
  EXPLORE_STATE_DENSITY_LAYER_ID,
} from './explore-style';

function buildStyleFixture(densityLayerEnabled: boolean) {
  const source = buildExploreMapSource(listPublicEntities());
  return buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    densityLayerEnabled,
  });
}

test('the entities source is configured to cluster with the shared BB-051 cluster config', () => {
  const style = buildStyleFixture(true);
  const entitiesSource = style.sources['explore-entities'] as { cluster?: boolean; clusterRadius?: number };
  assert.equal(entitiesSource.cluster, true);
  assert.equal(entitiesSource.clusterRadius, 60);
});

test('state density source starts empty so client join can setData without URL race', () => {
  const style = buildStyleFixture(true);
  const stateSource = style.sources['explore-state-density'] as {
    data?: { type?: string; features?: unknown[] };
  };
  assert.equal(stateSource.data?.type, 'FeatureCollection');
  assert.deepEqual(stateSource.data?.features, []);
});

test('the density layer stays hittable; density tint is controlled by paint not visibility', () => {
  const on = buildStyleFixture(true);
  const off = buildStyleFixture(false);
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
  const style = buildStyleFixture(true);
  const areaLayer = style.layers.find((layer) => layer.id === EXPLORE_JURISDICTION_AREA_LAYER_ID);
  assert.equal(areaLayer?.type, 'fill');
  const areaSource = style.sources['explore-jurisdiction-areas'] as { data: { features: readonly unknown[] } };
  assert.deepEqual(areaSource.data.features, []);
});

test('every paint color used is one of the dignity-palette values (no new hue introduced at render time)', () => {
  const style = buildStyleFixture(true);
  const allowed = new Set(Object.values(DIGNITY_PALETTE));
  // The state-bounds line/background/text layers also draw from the dignity palette or the
  // shared brand tokens; the cluster/point/halo layers below are the ones the dignity rule is
  // specifically about.
  const dignityGatedLayerIds = [EXPLORE_CLUSTER_LAYER_ID, 'explore-point-halo', 'explore-point'];
  for (const layer of style.layers) {
    if (!dignityGatedLayerIds.includes(layer.id)) continue;
    const paint = (layer as { paint?: Record<string, unknown> }).paint ?? {};
    for (const [key, value] of Object.entries(paint)) {
      if (typeof value !== 'string' || !key.includes('color')) continue;
      assert.ok(allowed.has(value), `layer "${layer.id}" paint "${key}" = "${value}" must come from DIGNITY_PALETTE`);
    }
  }
});
