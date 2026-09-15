import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CANONICAL_RACE_ETHNICITY_SLICES,
  LIVES_LENSES,
  RACE_ETHNICITY_DEFINITION_LABELS,
  isLivesLens,
  lensForDefinition,
  normalizeRaceEthnicitySlice,
  preferredDefinition,
} from './race-ethnicity-slices.js';

test('merges spelling variants that share one definition', () => {
  for (const raw of ['white_nh', 'white_nonhispanic', 'white-non-hispanic', 'WHITE_NH']) {
    assert.equal(normalizeRaceEthnicitySlice(raw), 'white_nh', raw);
  }
  assert.equal(normalizeRaceEthnicitySlice('black_nonhispanic'), 'black_nh');
  assert.equal(normalizeRaceEthnicitySlice('Negro'), 'black');
});

test('never turns a race-only slice into a non-Hispanic one', () => {
  assert.equal(normalizeRaceEthnicitySlice('black'), 'black');
  assert.equal(normalizeRaceEthnicitySlice('black_alone'), 'black_alone');
  assert.equal(normalizeRaceEthnicitySlice('white'), 'white');
});

test('treats a null or empty slice as everyone and refuses unknown spellings', () => {
  assert.equal(normalizeRaceEthnicitySlice(null), 'all');
  assert.equal(normalizeRaceEthnicitySlice('  '), 'all');
  assert.equal(normalizeRaceEthnicitySlice('black_or_hispanic'), null);
});

test('every slice value seen in live observations resolves', () => {
  for (const raw of [
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
  ]) {
    assert.notEqual(normalizeRaceEthnicitySlice(raw), null, raw);
  }
});

test('every canonical definition has a reader label', () => {
  for (const slice of CANONICAL_RACE_ETHNICITY_SLICES) {
    assert.ok(RACE_ETHNICITY_DEFINITION_LABELS[slice].length > 0, slice);
  }
});

test('published definitions reach the lens they can stand for', () => {
  assert.deepEqual([...LIVES_LENSES], ['black', 'white', 'hispanic']);
  assert.equal(lensForDefinition('black_alone'), 'black');
  assert.equal(lensForDefinition('nonwhite'), 'black');
  assert.equal(lensForDefinition('spanish_surname'), 'hispanic');
  assert.equal(lensForDefinition('white'), 'white');
  assert.equal(lensForDefinition('asian'), null);
  assert.equal(isLivesLens('black_nh'), false);
});

test('the most specific published definition stands for the lens', () => {
  assert.equal(preferredDefinition('white', ['white', 'white_nh']), 'white_nh');
  assert.equal(preferredDefinition('black', ['nonwhite', 'black']), 'black');
  assert.equal(preferredDefinition('hispanic', ['puerto_rican']), 'puerto_rican');
  assert.equal(preferredDefinition('hispanic', ['white']), null);
});
