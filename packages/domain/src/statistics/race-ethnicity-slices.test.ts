import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIVES_GROUP_SLICES,
  isLivesGroupSlice,
  normalizeRaceEthnicitySlice,
} from './race-ethnicity-slices.js';

test('merges spelling variants that share one definition', () => {
  for (const raw of ['white_nh', 'white_nonhispanic', 'white-non-hispanic', 'WHITE_NH']) {
    assert.equal(normalizeRaceEthnicitySlice(raw), 'white_nh', raw);
  }
  assert.equal(normalizeRaceEthnicitySlice('black_nonhispanic'), 'black_nh');
});

test('never turns a race-only slice into a non-Hispanic one', () => {
  assert.equal(normalizeRaceEthnicitySlice('black'), 'black');
  assert.equal(normalizeRaceEthnicitySlice('black_alone'), 'black_alone');
  assert.equal(normalizeRaceEthnicitySlice('white'), 'white');
  assert.equal(normalizeRaceEthnicitySlice('white_alone'), 'white_alone');
});

test('treats a null or empty slice as everyone', () => {
  assert.equal(normalizeRaceEthnicitySlice(null), 'all');
  assert.equal(normalizeRaceEthnicitySlice(undefined), 'all');
  assert.equal(normalizeRaceEthnicitySlice('  '), 'all');
});

test('returns null for a spelling it does not recognize instead of guessing', () => {
  assert.equal(normalizeRaceEthnicitySlice('black_or_hispanic'), null);
});

test('every slice value seen in live observations resolves', () => {
  const live = [
    'black_alone',
    'white_alone',
    'black',
    'white_nonhispanic',
    'white_nh',
    'white',
    'hispanic',
    'nonwhite',
    'white-non-hispanic',
    'asian',
    'black_nonhispanic',
  ];
  for (const raw of live) {
    assert.notEqual(normalizeRaceEthnicitySlice(raw), null, raw);
  }
});

test('Lives groups are exactly the three non-overlapping slices', () => {
  assert.deepEqual([...LIVES_GROUP_SLICES], ['black_nh', 'white_nh', 'hispanic']);
  assert.equal(isLivesGroupSlice('black_nh'), true);
  assert.equal(isLivesGroupSlice('black_alone'), false);
});
