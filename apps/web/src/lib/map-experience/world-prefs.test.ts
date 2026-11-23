import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groundFrameFor,
  GROUND_MAX_ZOOM,
  GROUND_SITE_PITCH,
} from '../../components/map-stage/ground-frame';

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
