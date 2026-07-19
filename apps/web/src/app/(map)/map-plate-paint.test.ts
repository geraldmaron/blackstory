/**
 * Unit tests for map plate paint sync helpers used on theme toggle.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StyleSpecification } from 'maplibre-gl';
import { collectLayerPaintUpdates, PERSISTENT_PLATE_LAYER_IDS } from './map-plate-paint';

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
