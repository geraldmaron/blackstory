/**
 * Unit tests for locate → explore deep-link construction (camera, radius, near label).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMERA_COUNTY_ZOOM } from '../map-experience/camera-presets';
import { buildLocateExploreHref, LOCATE_EXPLORE_DEFAULT_RADIUS_ID } from './locate-explore-href';
import { parseExploreSearchParams } from '../map-experience/url-state';

const PALM_BEACH_RESOLUTION = {
  match: {
    countyName: 'Palm Beach County',
    stateName: 'Florida',
  },
  jurisdictionIds: { countryId: 'us', stateId: 'us-12', countyId: 'us-12-099' },
  precision: {
    tier: 'locality',
    exactCoordinatesRetained: true,
    lat: 26.7056,
    lng: -80.0364,
  },
} as const;

test('retained coordinates produce explore href with 10mi radius and near label', () => {
  const href = buildLocateExploreHref(PALM_BEACH_RESOLUTION);
  assert.match(href, /^\/explore\?/);
  assert.match(href, /radius=10mi/);
  assert.match(href, /near=Palm\+Beach\+County/);
  assert.match(href, /lat=26\.7056/);
  assert.match(href, /lng=-80\.0364/);

  const [, qs] = href.split('?');
  const parsed = parseExploreSearchParams(Object.fromEntries(new URLSearchParams(qs)));
  assert.equal(parsed.radius, LOCATE_EXPLORE_DEFAULT_RADIUS_ID);
  assert.equal(parsed.near, 'Palm Beach County, Florida');
  assert.ok(parsed.viewport);
  assert.equal(parsed.viewport!.lat, 26.7056);
  assert.equal(parsed.viewport!.lng, -80.0364);
  assert.equal(parsed.viewport!.zoom, CAMERA_COUNTY_ZOOM);
});

test('state-only fallback links to explore without a finite radius', () => {
  const href = buildLocateExploreHref({
    match: { stateName: 'Georgia' },
    jurisdictionIds: { countryId: 'us', stateId: 'us-13' },
    precision: { tier: 'state', exactCoordinatesRetained: false },
  });
  assert.match(href, /^\/explore\?/);
  assert.doesNotMatch(href, /radius=/);
  assert.match(href, /near=Georgia/);
  assert.ok(
    parseExploreSearchParams(Object.fromEntries(new URLSearchParams(href.split('?')[1]!))).viewport,
  );
});

test('falls back to bare /explore when neither coords nor state can be framed', () => {
  const href = buildLocateExploreHref({
    match: {},
    jurisdictionIds: { countryId: 'us' },
    precision: { tier: 'country', exactCoordinatesRetained: false },
  });
  assert.equal(href, '/explore');
});
