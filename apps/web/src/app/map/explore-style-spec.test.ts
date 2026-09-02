/**
 * The built Explore style must pass MapLibre's own style-spec validator.
 *
 * `buildExploreMapStyle` is a pure builder: nothing in it checks the expressions it assembles,
 * and MapLibre only rejects an invalid one at `addLayer`, in the browser, inside a `try/catch`
 * whose only output is a console line. That is how a nested zoom `interpolate` shipped to
 * production and left the Atlas painting nothing but its Albers underlay. Running the same
 * validator MapLibre uses (`@maplibre/maplibre-gl-style-spec`, the version `maplibre-gl`
 * itself depends on) over every layer-mode / clustering / basemap combination the surfaces
 * actually request makes that class of failure a test failure instead of a silent plate.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreMapSource } from '../../lib/map-experience/build-explore-map-source';
import { buildExploreMapStyle } from './explore-style';

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
