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
import { buildExploreMapStyle, EXPLORE_UNCLUSTERED_POINT_LAYER_ID } from './explore-style';

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

/** The precision mark evaluates to the contract sizes: an 8px dot for site precision and a
 * 14px ring for neighborhood or city, read from the feature's own stored precision. */
test('the record mark radius follows stored precision, evaluated by the style-spec runtime', () => {
  const style = buildExploreMapStyle({
    featureCollection: source.featureCollection,
    jurisdictionAreaFeatures: [],
    layerMode: 'off',
  });
  const layer = style.layers.find(
    (candidate) => candidate.id === EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  ) as { paint?: Record<string, unknown> } | undefined;
  assert.ok(layer);
  const created = createPropertyExpression(
    layer.paint?.['circle-radius'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- style-spec's own JSON schema type, not worth re-declaring here
    latest.paint_circle['circle-radius'] as any,
  );
  assert.equal(created.result, 'success', 'circle-radius must be a valid expression');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exercising the runtime evaluator, not its TS surface
  const expression = (created as any).value;
  const radius = (precision: string): number =>
    expression.evaluate({ zoom: 10 }, { properties: { precision }, id: 0, type: 1 });
  assert.equal(radius('site'), 4);
  assert.equal(radius('address'), 4);
  assert.equal(radius('city'), 7);
  assert.equal(radius('neighborhood'), 7);
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
