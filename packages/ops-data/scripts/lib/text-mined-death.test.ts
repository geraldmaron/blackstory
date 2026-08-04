/**
 * Unit tests for text-mined death-year helpers (review lane only).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isLynchSurnameFalsePositive,
  mineDeathWordNearYear,
  mineLifeRangeDeathYear,
  mineTextForDeathYear,
} from './text-mined-death.ts';

test('mineLifeRangeDeathYear extracts end year from parenthetical life range', () => {
  const hit = mineLifeRangeDeathYear(
    'Mary Church Terrell (1885–1952) organized for suffrage and civil rights.',
    2026,
  );
  assert.ok(hit);
  assert.equal(hit.birthYear, 1885);
  assert.equal(hit.deathYear, 1952);
  assert.match(hit.quote, /1885/);
});

test('mineLifeRangeDeathYear ignores recent end years', () => {
  const hit = mineLifeRangeDeathYear('Example Person (1990–2026) is active today.', 2026);
  assert.equal(hit, null);
});

test('mineDeathWordNearYear finds year near death lexicon', () => {
  const hit = mineDeathWordNearYear('She died in Memphis in 1968 after years of organizing.');
  assert.ok(hit);
  assert.equal(hit.deathYear, 1968);
  assert.equal(hit.signal, 'death_lexicon');
});

test('mineDeathWordNearYear uses lynching verb forms only', () => {
  const hit = mineDeathWordNearYear('He was lynched in Duluth in 1920 by a white mob.');
  assert.ok(hit);
  assert.equal(hit.deathYear, 1920);
  assert.equal(hit.signal, 'lynching_verb');
});

test('isLynchSurnameFalsePositive flags Loretta Lynch prose without lynching verbs', () => {
  assert.equal(
    isLynchSurnameFalsePositive('Loretta Lynch argued the case before the Court.'),
    true,
  );
  assert.equal(
    isLynchSurnameFalsePositive('Isaac McGhie was lynched by a white mob in Duluth in 1920.'),
    false,
  );
});

test('mineTextForDeathYear skips Lynch surname false positives', () => {
  const hit = mineTextForDeathYear(
    'ent_person_lynch_surname',
    'Loretta Lynch argued the case before the Court.',
  );
  assert.equal(hit, null);
});

test('mineTextForDeathYear prefers life range over death lexicon', () => {
  const hit = mineTextForDeathYear(
    'ent_person_life_range',
    'Mary Church Terrell (1885–1952) died after a long public career.',
  );
  assert.ok(hit);
  assert.equal(hit.signal, 'life_range');
  assert.equal(hit.deathYear, 1952);
  assert.equal(hit.birthYear, 1885);
});
