/**
 * Unit tests for explore address → camera target resolution (coords vs state fallback).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMERA_COUNTY_ZOOM } from './camera-presets';
import { resolveExploreAddressCamera } from './resolve-explore-address-camera';

test('retained coordinates produce a locality camera at county zoom', () => {
  const target = resolveExploreAddressCamera({
    match: { placeName: 'Washington city', stateName: 'District of Columbia' },
    jurisdictionIds: { stateId: 'us-11' },
    precision: { exactCoordinatesRetained: true, lat: 38.8977, lng: -77.0365 },
  });
  assert.ok(target);
  assert.equal(target!.preset, 'locality');
  assert.equal(target!.viewport.zoom, CAMERA_COUNTY_ZOOM);
  assert.equal(target!.viewport.lat, 38.8977);
  assert.equal(target!.viewport.lng, -77.0365);
  assert.equal(target!.statePostalCode, 'DC');
  assert.match(target!.label, /Washington/);
});

test('without coordinates falls back to the state viewport', () => {
  const target = resolveExploreAddressCamera({
    match: { stateName: 'Georgia' },
    jurisdictionIds: { stateId: 'us-13' },
    precision: { exactCoordinatesRetained: false },
  });
  assert.ok(target);
  assert.equal(target!.preset, 'state');
  assert.equal(target!.statePostalCode, 'GA');
  assert.ok(target!.viewport.zoom < CAMERA_COUNTY_ZOOM);
});

test('returns undefined when neither coordinates nor a known state are present', () => {
  const target = resolveExploreAddressCamera({
    match: {},
    jurisdictionIds: {},
    precision: { exactCoordinatesRetained: false },
  });
  assert.equal(target, undefined);
});
