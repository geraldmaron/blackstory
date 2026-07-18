/**
 * Unit tests for the `navigator.geolocation` wrapper against a fake `GeolocationApi`
 * no DOM/browser environment required.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestBrowserLocation, type GeolocationApi } from './browser-geolocation';

function fakeSuccess(latitude: number, longitude: number): GeolocationApi {
  return {
    getCurrentPosition(onSuccess) {
      onSuccess({ coords: { latitude, longitude } });
    },
  };
}

function fakeError(code: number): GeolocationApi {
  return {
    getCurrentPosition(_onSuccess, onError) {
      onError({ code, message: 'simulated' });
    },
  };
}

test('resolves ok:false reason:unsupported when no GeolocationApi is available', async () => {
  const outcome = await requestBrowserLocation(undefined);
  assert.deepEqual(outcome, { ok: false, reason: 'unsupported' });
});

test('resolves ok:true with lat/lng mapped from coords.latitude/longitude', async () => {
  const outcome = await requestBrowserLocation(fakeSuccess(38.846, -76.927));
  assert.deepEqual(outcome, { ok: true, position: { lat: 38.846, lng: -76.927 } });
});

test('maps GeolocationPositionError code 1 to permission_denied', async () => {
  const outcome = await requestBrowserLocation(fakeError(1));
  assert.deepEqual(outcome, { ok: false, reason: 'permission_denied' });
});

test('maps GeolocationPositionError code 2 to position_unavailable', async () => {
  const outcome = await requestBrowserLocation(fakeError(2));
  assert.deepEqual(outcome, { ok: false, reason: 'position_unavailable' });
});

test('maps GeolocationPositionError code 3 to timeout', async () => {
  const outcome = await requestBrowserLocation(fakeError(3));
  assert.deepEqual(outcome, { ok: false, reason: 'timeout' });
});

test('maps an unrecognized error code to unknown_error', async () => {
  const outcome = await requestBrowserLocation(fakeError(99));
  assert.deepEqual(outcome, { ok: false, reason: 'unknown_error' });
});
