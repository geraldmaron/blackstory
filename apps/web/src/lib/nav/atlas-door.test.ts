/**
 * The Atlas instrument is `/explore`. `/` never mounts the board.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATLAS_INSTRUMENT_HREF } from './atlas-door';

test('the instrument href is /explore, not a query on /', () => {
  assert.equal(ATLAS_INSTRUMENT_HREF, '/explore');
  assert.doesNotMatch(ATLAS_INSTRUMENT_HREF, /atlas=1|\?/);
});
