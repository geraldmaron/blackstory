/**
 * Unit tests for map plate paint sync helpers used on theme toggle.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StyleSpecification } from 'maplibre-gl';
import { mapPalettes } from '@repo/ui';
import {
  buildArchiveBaseStyle,
  collectLayerPaintUpdates,
  PERSISTENT_PLATE_LAYER_IDS,
} from './map-plate-paint';

const SAMPLE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#E8E0D2' },
    },
    {
      id: 'plate-landcover',
      type: 'fill',
      source: 'openfreemap',
      'source-layer': 'landcover',
      paint: { 'fill-color': '#ebe5d1' },
    },
    {
      id: 'plate-water',
      type: 'fill',
      source: 'openfreemap',
      'source-layer': 'water',
      paint: { 'fill-color': '#c7bdaa' },
    },
    {
      id: 'plate-boundary-country',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'boundary',
      paint: { 'line-color': '#a2957c', 'line-width': 1 },
    },
    {
      id: 'plate-place-city',
      type: 'symbol',
      source: 'openfreemap',
      'source-layer': 'place',
      paint: { 'text-color': '#2e2a24', 'text-halo-color': '#f8f5ee', 'text-halo-width': 1.4 },
    },
    {
      id: 'explore-street-casing',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'transportation',
      paint: { 'line-color': 'rgba(10, 10, 10, 0.18)', 'line-width': 1 },
    },
    {
      id: 'explore-street-fill',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'transportation',
      paint: { 'line-color': 'rgba(10, 10, 10, 0.32)' },
    },
    {
      id: 'explore-street-label',
      type: 'symbol',
      source: 'openfreemap',
      'source-layer': 'transportation_name',
      paint: {
        'text-color': 'rgba(10, 10, 10, 0.55)',
        'text-halo-color': '#E8E0D2',
        'text-halo-width': 1,
      },
    },
    {
      id: 'explore-unclustered-point',
      type: 'circle',
      source: 'explore-entities',
      paint: { 'circle-color': '#B86B2A' },
    },
  ],
};

test('collectLayerPaintUpdates returns paints only for requested persistent layers', () => {
  const updates = collectLayerPaintUpdates(SAMPLE_STYLE, PERSISTENT_PLATE_LAYER_IDS);
  const layerIds = new Set(updates.map((entry) => entry.layerId));
  assert.deepEqual([...layerIds].sort(), [...PERSISTENT_PLATE_LAYER_IDS].sort());
  assert.equal(
    updates.find((entry) => entry.layerId === 'background' && entry.paintKey === 'background-color')
      ?.paintValue,
    '#E8E0D2',
  );
  assert.equal(
    updates.find(
      (entry) => entry.layerId === 'explore-street-label' && entry.paintKey === 'text-halo-color',
    )?.paintValue,
    '#E8E0D2',
  );
  assert.ok(!updates.some((entry) => entry.layerId === 'explore-unclustered-point'));
});

test('collectLayerPaintUpdates respects an explicit layer id subset', () => {
  const updates = collectLayerPaintUpdates(SAMPLE_STYLE, ['background']);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.layerId, 'background');
  assert.equal(updates[0]?.paintKey, 'background-color');
});

/**
 * The pre-`load` frame is the one MapLibre paints before any explore layer exists. Pinning it to a
 * dark literal is what let a light-theme `/explore` render as a solid black plate, so it is
 * asserted per scheme against the same token table the rest of the plate reads.
 */
test('buildArchiveBaseStyle paints the pre-load frame from the scheme land token', () => {
  function backgroundColor(scheme: 'light' | 'dark'): unknown {
    const layer = buildArchiveBaseStyle(scheme).layers.find((entry) => entry.id === 'background');
    assert.ok(layer, `${scheme} archive base must ship a background layer`);
    return (layer as { paint?: Record<string, unknown> }).paint?.['background-color'];
  }

  // The plate's background is LAND: the tiles' `water` source-layer paints the oceans and
  // lakes over it. A water-coloured pre-load frame would flash the inverse of the map that is
  // about to arrive — a continent-shaped hole rather than a continent.
  assert.equal(backgroundColor('light'), mapPalettes.light.land);
  assert.equal(backgroundColor('dark'), mapPalettes.dark.land);
  assert.notEqual(backgroundColor('light'), backgroundColor('dark'));
});
