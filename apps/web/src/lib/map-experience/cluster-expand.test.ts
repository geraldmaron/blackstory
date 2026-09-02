/**
 * Cluster expansion zoom clamping and GeoJSON clusterProperties wiring.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLUSTER_FALLBACK_ZOOM_STEP,
  clampClusterExpansionZoom,
  clusterCenterFromCoordinates,
  clusterExpandDurationMs,
  exploreClusterProperties,
} from './cluster-expand';
import { MAP_MAX_ZOOM } from './camera-presets';

test('clampClusterExpansionZoom respects MAP_MAX_ZOOM and never shrinks', () => {
  assert.equal(clampClusterExpansionZoom(8, 4), 8);
  assert.equal(clampClusterExpansionZoom(MAP_MAX_ZOOM + 4, 4), MAP_MAX_ZOOM);
  assert.ok(clampClusterExpansionZoom(4.5, 4.5) > 4.5);
});

test('clampClusterExpansionZoom falls back when expansion zoom is not finite', () => {
  assert.equal(clampClusterExpansionZoom(Number.NaN, 3), 3 + CLUSTER_FALLBACK_ZOOM_STEP);
});

test('clusterExpandDurationMs is zero when reduced motion is on', () => {
  assert.equal(clusterExpandDurationMs(true), 0);
  assert.ok(clusterExpandDurationMs(false) > 0);
});

test('clusterCenterFromCoordinates rejects invalid coordinates', () => {
  assert.equal(clusterCenterFromCoordinates(undefined), undefined);
  assert.equal(clusterCenterFromCoordinates([Number.NaN, 1]), undefined);
  assert.deepEqual(clusterCenterFromCoordinates([-77.03, 38.89]), [-77.03, 38.89]);
});

test('exploreClusterProperties tracks per-family counts for dominant paint', () => {
  const props = exploreClusterProperties();
  assert.equal(Object.keys(props).length, 5);
  assert.deepEqual(props.people_n, ['+', ['case', ['==', ['get', 'kindFamily'], 'people'], 1, 0]]);
});
