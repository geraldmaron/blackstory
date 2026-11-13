import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverDek, firstYear, splitLede, splitSectionHeading } from './story-text';

test('a section heading that leads with a year splits into year and title', () => {
  assert.deepEqual(splitSectionHeading('1790 · A ledger open on his knee'), {
    year: '1790',
    title: 'A ledger open on his knee',
  });
  assert.deepEqual(splitSectionHeading('Today · You are counted, still'), {
    year: 'Today',
    title: 'You are counted, still',
  });
});

test('a heading with no leading year comes back whole', () => {
  assert.deepEqual(splitSectionHeading('The record'), { title: 'The record' });
  assert.deepEqual(splitSectionHeading('Where the record disagrees'), {
    title: 'Where the record disagrees',
  });
});

test('a short summary stays whole', () => {
  assert.deepEqual(splitLede('Adams did not own enslaved people.'), {
    dek: 'Adams did not own enslaved people.',
  });
});

test('a long summary splits after its first sentence, and no word is lost', () => {
  const first =
    'The United States has been writing Black people down since before it had a president: a fraction in the Constitution, a numbered line on a property schedule.';
  const rest =
    'The archive those records left behind is enormous, and for most of American history it is the paperwork of being counted by somebody else. This chapter reads that archive in order, and marks the few places where the hand holding the pen changes.';
  const split = splitLede(`${first} ${rest}`);
  assert.equal(split.dek, first);
  assert.equal(split.rest, rest);
});

test('an abbreviation is not a sentence end', () => {
  const words = Array.from({ length: 60 }, () => 'word').join(' ');
  const text = `The U.S. Census counted ${words} here. Then it stopped counting.`;
  const split = splitLede(text);
  assert.ok(split.dek.startsWith('The U.S. Census counted'));
  assert.equal(`${split.dek} ${split.rest ?? ''}`.trim(), text);
});

test('a cover dek is the first whole sentence, never a cut phrase', () => {
  assert.equal(
    coverDek(
      'Adams did not own enslaved people, and said so in print. He also signed the 1798 laws.',
    ),
    'Adams did not own enslaved people, and said so in print.',
  );
  assert.equal(coverDek('No sentence end here'), 'No sentence end here');
  assert.equal(
    coverDek('The U.S. Census counted every household twice. Then it stopped.'),
    'The U.S. Census counted every household twice.',
  );
});

test('a span gives the year it opens on, and nothing when it names no year', () => {
  assert.equal(firstYear('1787-present'), '1787');
  assert.equal(firstYear('1797–1801'), '1797');
  assert.equal(firstYear('1841 (31 days)'), '1841');
  assert.equal(firstYear('1950s'), '1950s');
  assert.equal(firstYear('Undated'), undefined);
  assert.equal(firstYear(undefined), undefined);
});
