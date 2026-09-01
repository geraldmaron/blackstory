/**
 * Handoffs may still name `/explore`. `/` is the Door; the instrument is `/explore`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATLAS_INSTRUMENT_HREF } from './atlas-door';

test('the handoff href is not a query on /', () => {
  assert.equal(ATLAS_INSTRUMENT_HREF, '/explore');
  assert.doesNotMatch(ATLAS_INSTRUMENT_HREF, /atlas=1|\?/);
});
