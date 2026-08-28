/**
 * Door vs Atlas intent: bare `/` is the featured first paint; the board opens only when asked.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATLAS_DOOR_PARAM, ATLAS_INSTRUMENT_HREF, wantsAtlasInstrument } from './atlas-door';

test('bare and empty queries stay on the door', () => {
  assert.equal(wantsAtlasInstrument(''), false);
  assert.equal(wantsAtlasInstrument({}), false);
  assert.equal(wantsAtlasInstrument(new URLSearchParams()), false);
  assert.equal(wantsAtlasInstrument('junk=1'), false);
  assert.equal(wantsAtlasInstrument({ kind: 'all', era: 'all' }), false);
});

test('atlas=1 or any surviving explore filter opens the instrument', () => {
  assert.equal(wantsAtlasInstrument('atlas=1'), true);
  assert.equal(wantsAtlasInstrument({ [ATLAS_DOOR_PARAM]: 'true' }), true);
  assert.equal(wantsAtlasInstrument({ state: 'DC' }), true);
  assert.equal(wantsAtlasInstrument({ selected: 'ent_dunbar_school_001' }), true);
  assert.equal(wantsAtlasInstrument({ kind: 'school' }), true);
});

test('the instrument href is the atlas flag, not bare /', () => {
  assert.equal(ATLAS_INSTRUMENT_HREF, '/?atlas=1');
});
