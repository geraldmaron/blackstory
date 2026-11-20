import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groundFrameFor,
  GROUND_MAX_ZOOM,
  GROUND_SITE_PITCH,
} from '../../components/map-stage/RecordGround';
import { DOOR_ORBIT_FILL, doorOrbitZoom } from '../../app/door-field-frame';

test('Ground: only a site-precision record is pitched and shown over imagery', () => {
  assert.deepEqual(groundFrameFor('site', false), {
    zoom: GROUND_MAX_ZOOM,
    pitch: GROUND_SITE_PITCH,
    imagery: true,
  });
  for (const precision of ['city', 'county', 'state']) {
    const frame = groundFrameFor(precision, false);
    assert.equal(frame.pitch, 0, precision);
    assert.equal(frame.imagery, false, precision);
    assert.ok(frame.zoom < GROUND_MAX_ZOOM, precision);
  }
});

test('Ground: a quiet record is flat on the plain plate', () => {
  assert.deepEqual(groundFrameFor('site', true), {
    zoom: GROUND_MAX_ZOOM,
    pitch: 0,
    imagery: false,
  });
});

const discFor = (width: number, height: number) =>
  (512 * 2 ** doorOrbitZoom({ top: 0, left: 0, width, height })) /
  (Math.PI * Math.cos((36 * Math.PI) / 180));

test('Orbit: the globe disc fills the same share of a roomy map window', () => {
  for (const side of [320, 600, 900]) {
    assert.ok(Math.abs(discFor(side * 1.1, side) - DOOR_ORBIT_FILL * side) < 0.001, String(side));
  }
});

test('Orbit: a short phone strip gets a horizon sized to its width, not a thumbnail', () => {
  assert.ok(discFor(343, 130) > 260);
  assert.ok(discFor(343, 130) <= 343);
});
