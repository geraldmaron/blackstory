import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editDistance, nearestQuery } from './nearest-query';

const HAYSTACKS = [
  'bethel ame church a church founded in 1816 philadelphia, pennsylvania',
  'mother emanuel church charleston, south carolina',
  'tulsa race massacre tulsa, oklahoma',
  'chord of memory a mural birmingham, alabama',
];

test('an adjacent swap, a dropped letter and a wrong letter are each one edit', () => {
  assert.equal(editDistance('churhc', 'church', 1), 1);
  assert.equal(editDistance('chuch', 'church', 1), 1);
  assert.equal(editDistance('churck', 'church', 1), 1);
  assert.equal(editDistance('chirp', 'church', 1), 2);
});

test('a misspelled word becomes the nearest word some record holds', () => {
  assert.equal(nearestQuery('churhc', HAYSTACKS), 'church');
  assert.equal(nearestQuery('Tulsa masacre', HAYSTACKS), 'tulsa massacre');
  // Two edits are allowed only from eight letters up.
  assert.equal(nearestQuery('philadelfia', HAYSTACKS), 'philadelphia');
});

test('among equally near words the one in more records wins', () => {
  assert.equal(nearestQuery('kill', ['rose hill', 'sugar hill', 'the old mill']), 'hill');
});

test('no offer when the words are known, or when a word has no near neighbor', () => {
  assert.equal(nearestQuery('church', HAYSTACKS), null);
  assert.equal(nearestQuery('zzzzqqq', HAYSTACKS), null);
  assert.equal(nearestQuery('churhc zzzzqqq', HAYSTACKS), null);
  assert.equal(nearestQuery('', HAYSTACKS), null);
});
