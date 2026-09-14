/**
 * The built Explore style must pass MapLibre's own style-spec validator.
 *
 * `buildExploreMapStyle` is a pure builder: nothing in it checks the expressions it assembles,
 * and MapLibre only rejects an invalid one at `addLayer`, in the browser, inside a `try/catch`
 * whose only output is a console line. That is how a nested zoom `interpolate` shipped to
 * production and left Explore painting nothing but its Albers underlay. Running the same
 * validator MapLibre uses (`@maplibre/maplibre-gl-style-spec`, the version `maplibre-gl`
 * itself depends on) over every layer-mode / clustering / basemap combination the surfaces
 * actually request makes that class of failure a test failure instead of a silent plate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPropertyExpression,
  latest,
  validateStyleMin,
} from '@maplibre/maplibre-gl-style-spec';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
import { buildExploreMapStyle, EXPLORE_PRECISION_RADIUS_LAYER_ID } from './explore-style';

const source = buildExploreMapSource(listPublicEntities());

const LAYER_MODES = ['off', 'presence', 'blackShare', 'blackChange'] as const;

/** Every zoom-driven `interpolate`/`step` in an expression tree, with its nesting depth. */
function zoomExpressionDepths(expression: unknown, depth = 0, out: number[] = []): number[] {
  if (!Array.isArray(expression)) return out;
  const [op, ...rest] = expression;
  const zoomInput =
    (op === 'interpolate' && Array.isArray(rest[1]) && rest[1][0] === 'zoom') ||
    (op === 'step' && Array.isArray(rest[0]) && rest[0][0] === 'zoom');
  if (zoomInput) out.push(depth);
  for (const child of rest) zoomExpressionDepths(child, depth + 1, out);
  return out;
}

for (const clusteringEnabled of [true, false]) {
  for (const layerMode of LAYER_MODES) {
    for (const satellite of [false, true]) {
      for (const colorScheme of ['dark', 'light'] as const) {
        test(`style validates: mode=${layerMode} cluster=${clusteringEnabled} sat=${satellite} ${colorScheme}`, () => {
          const style = buildExploreMapStyle({
            featureCollection: source.featureCollection,
            jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
            layerMode,
            clusteringEnabled,
            satellite,
            colorScheme,
          });
          const errors = validateStyleMin(style);
          assert.deepEqual(
            errors.map((error) => error.message),
            [],
            'MapLibre would reject this style at addLayer',
          );
        });
      }
    }
  }
}

/** Repro of the `radiusMeters -> circle-radius` bug this suite exists to catch (module doc):
 * the property this feature's `radiusMeters` fed used to be a bare `['*', …, ['^', 2, ['zoom']]]`
 * arithmetic expression a `top-level step/interpolate only` violation `validateStyleMin` would
 * reject, but which was never wired into any layer, so nothing ever ran it through the
 * validator. Evaluating the built expression (not just re-validating the style) proves the
 * fixed version both passes AND produces the geometry the acceptance criterion asks for: a
 * radius when the tier resolved one, none when it didn't. */
test("precision-radius affordance renders only where a radius resolved, scaling with the feature's own radiusMeters", () => {
  const style = buildExploreMapStyle({
    featureCollection: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'exact-site',
          geometry: { type: 'Point', coordinates: [-77.03, 38.9] },
          properties: { entityId: 'exact-site', kind: 'place', radiusMeters: 30 },
        },
        {
          type: 'Feature',
          id: 'block',
          geometry: { type: 'Point', coordinates: [-77.03, 38.9] },
          properties: { entityId: 'block', kind: 'place', radiusMeters: 200 },
        },
        {
          type: 'Feature',
          id: 'unresolved',
          geometry: { type: 'Point', coordinates: [-77.03, 38.9] },
          // No `radiusMeters` — `resolveDisplayRadiusMeters` failed closed for this tier
          // (e.g. county) rather than guessing a jurisdiction bbox.
          properties: { entityId: 'unresolved', kind: 'place' },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON ambient namespace unavailable
    } as any,
    jurisdictionAreaFeatures: [],
    layerMode: 'off',
    clusteringEnabled: false,
  });
  const layer = style.layers.find(
    (candidate) => candidate.id === EXPLORE_PRECISION_RADIUS_LAYER_ID,
  ) as { paint?: Record<string, unknown>; filter?: unknown } | undefined;
  assert.ok(layer, 'expected the precision-radius layer in the built style');
  assert.deepEqual(layer.filter, ['all', ['!', ['has', 'point_count']], ['has', 'radiusMeters']]);

  const created = createPropertyExpression(
    layer.paint?.['circle-radius'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- style-spec's own JSON schema type, not worth re-declaring here
    latest.paint_circle['circle-radius'] as any,
  );
  assert.equal(created.result, 'success', 'circle-radius must be a valid expression');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exercising the runtime evaluator, not its TS surface
  const expression = (created as any).value;
  const evaluate = (radiusMeters: number | undefined, zoom: number): number =>
    expression.evaluate({ zoom }, { properties: { radiusMeters }, id: 0, type: 1 });

  // Past the national field (zoom 12, this layer's own maxzoom cutoff), a resolved radius
  // paints something, and a coarser one paints more than a finer one at the same zoom.
  const exactSitePixels = evaluate(30, 12);
  const blockPixels = evaluate(200, 12);
  const unresolvedPixels = evaluate(undefined, 12);
  assert.ok(exactSitePixels > 0, 'exact-site (30m) must render a nonzero radius at zoom 12');
  assert.ok(blockPixels > exactSitePixels, 'block (200m) must render larger than exact-site (30m)');
  assert.equal(unresolvedPixels, 0, 'no radiusMeters must never fabricate a radius');

  // The formula this replaces (`radiusMeters * 2^zoom / metersPerPixelAtZoom0`) exactly, to
  // within the documented sub-0.03% two-stop exponential-interpolate approximation error.
  const exact = (30 * Math.pow(2, 12)) / 156_543.03392;
  assert.ok(
    Math.abs(exactSitePixels - exact) / exact < 0.001,
    `expected ~${exact}px, got ${exactSitePixels}px`,
  );
});

test('no paint or layout property nests a zoom-driven expression inside another', () => {
  const style = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: source.jurisdictionAreaFeatures,
    layerMode: 'presence',
    clusteringEnabled: true,
  });
  for (const layer of style.layers) {
    const properties = {
      ...((layer as { paint?: Record<string, unknown> }).paint ?? {}),
      ...((layer as { layout?: Record<string, unknown> }).layout ?? {}),
    };
    for (const [key, value] of Object.entries(properties)) {
      const depths = zoomExpressionDepths(value);
      assert.ok(
        depths.length <= 1 && (depths[0] === undefined || depths[0] === 0),
        `${layer.id}.${key}: zoom expressions at depths [${depths.join(', ')}]; only one, at the top, is allowed`,
      );
    }
  }
});
