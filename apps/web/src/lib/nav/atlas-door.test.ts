/**
 * Handoffs: filtered instrument stays on `/explore?…`; bare map journey is `/`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATLAS_INSTRUMENT_HREF, MAP_JOURNEY_HREF } from './atlas-door';

test('instrument href is /explore without a query (focus params added by callers)', () => {
  assert.equal(ATLAS_INSTRUMENT_HREF, '/explore');
  assert.doesNotMatch(ATLAS_INSTRUMENT_HREF, /atlas=1|\?/);
});

test('map journey is the Door at /', () => {
  assert.equal(MAP_JOURNEY_HREF, '/');
});
