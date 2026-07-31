/**
 * The shared typeahead tier, which the Atlas palette and the books typeahead both rank with.
 *
 * The token tier exists because every matcher built on this helper used to fail on the most
 * ordinary way a person searches for a person. "calvin shirley" is not a contiguous substring of
 * "Dr. Calvin H. Shirley", so the palette answered "Nothing matches that" about a record it was
 * holding. These tests pin the tier ordering, because the ordering is the contract: a verbatim
 * hit must always outrank a scattered one.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTypeaheadQuery, typeaheadMatchTier } from './match';

test('exact, prefix and substring keep their existing order', () => {
  assert.equal(typeaheadMatchTier('school', 'School'), 100);
  assert.equal(typeaheadMatchTier('school', 'School House'), 90);
  assert.equal(typeaheadMatchTier('school', 'Old School House'), 80);
});

test('a first-name last-name query matches across a title and a middle initial', () => {
  const tier = typeaheadMatchTier('calvin shirley', 'Dr. Calvin H. Shirley');
  assert.ok(tier > 0, 'a two-word name query must find the record');
  assert.equal(tier, 75);
});

test('a contiguous substring outranks scattered tokens', () => {
  const contiguous = typeaheadMatchTier('calvin shirley', 'Calvin Shirley Memorial');
  const scattered = typeaheadMatchTier('calvin shirley', 'Dr. Calvin H. Shirley');
  assert.ok(contiguous > scattered, 'a verbatim hit must lead');
});

test('the token tier is conjunctive, not a word-any match', () => {
  assert.equal(typeaheadMatchTier('calvin shirley', 'Calvin Coolidge High School'), 0);
  assert.equal(typeaheadMatchTier('calvin shirley', 'Shirley Chisholm'), 0);
});

test('token order does not matter', () => {
  assert.equal(typeaheadMatchTier('shirley calvin', 'Dr. Calvin H. Shirley'), 75);
});

test('a single-word query never reaches the token tier', () => {
  assert.equal(typeaheadMatchTier('zzz', 'Dr. Calvin H. Shirley'), 0);
});

test('the query floor and empty inputs still return no match', () => {
  assert.equal(typeaheadMatchTier('a', 'Alabama'), 0);
  assert.equal(typeaheadMatchTier('', 'Alabama'), 0);
  assert.equal(typeaheadMatchTier('alabama', ''), 0);
});

test('normalizeTypeaheadQuery trims, lowercases and collapses whitespace', () => {
  assert.equal(normalizeTypeaheadQuery('  Calvin   SHIRLEY '), 'calvin shirley');
});
