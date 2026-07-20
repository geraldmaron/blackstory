/**
 * Unit tests for the entity-page location MapLibre style builder.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEntityLocationMapStyle,
  ENTITY_LOCATION_PIN_LAYER_ID,
  ENTITY_LOCATION_PIN_SOURCE_ID,
  zoomForLocationPrecision,
} from './entity-location-map-style';

test('zoomForLocationPrecision steps city → neighborhood → campus/institution', () => {
  assert.equal(zoomForLocationPrecision('city'), 10);
  assert.equal(zoomForLocationPrecision('neighborhood'), 12);
  assert.equal(zoomForLocationPrecision('campus'), 13);
  assert.equal(zoomForLocationPrecision('institution'), 13);
});

test('buildEntityLocationMapStyle wires OpenFreeMap streets and a pin at the given coords', () => {
  const style = buildEntityLocationMapStyle({ lat: 40.8336, lng: -73.9154 });
  assert.equal(style.version, 8);
  assert.ok(style.sources?.openfreemap);
  assert.ok(style.sources?.[ENTITY_LOCATION_PIN_SOURCE_ID]);
  const pinSource = style.sources?.[ENTITY_LOCATION_PIN_SOURCE_ID];
  assert.equal(pinSource?.type, 'geojson');
  if (pinSource?.type === 'geojson') {
    const data = pinSource.data as {
      readonly type: string;
      readonly features: readonly {
        readonly geometry: { readonly type: string; readonly coordinates: readonly number[] };
      }[];
    };
    assert.equal(data.features[0]?.geometry.type, 'Point');
    assert.deepEqual(data.features[0]?.geometry.coordinates, [-73.9154, 40.8336]);
  }
  assert.ok(style.layers?.some((layer) => layer.id === 'entity-street-fill'));
  assert.ok(style.layers?.some((layer) => layer.id === ENTITY_LOCATION_PIN_LAYER_ID));
});
