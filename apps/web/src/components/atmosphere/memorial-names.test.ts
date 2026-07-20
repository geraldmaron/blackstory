/**
 * Integrity tests for the map memorial names wall dataset and selection helpers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEMORIAL_NAMES,
  MEMORIAL_NAMES_PLATE,
  MEMORIAL_NAMES_REQUIRED,
  isMemorialNamePlateEligible,
  memorialNameLabel,
  selectMemorialNames,
} from './memorial-names';

test('memorial names pool is large and fully identified', () => {
  assert.ok(
    MEMORIAL_NAMES.length >= 1000,
    `expected hundreds of names, got ${MEMORIAL_NAMES.length}`,
  );
  for (const entry of MEMORIAL_NAMES) {
    assert.ok(entry.name.trim().length > 0);
    assert.ok(Number.isInteger(entry.year));
    assert.ok(entry.year >= 1800 && entry.year <= 2100);
    assert.ok(
      entry.category === 'police_violence' ||
        entry.category === 'racial_terror' ||
        entry.category === 'state_execution',
    );
  }
});

test('required memorial names are present', () => {
  const names = new Set(MEMORIAL_NAMES.map((entry) => entry.name));
  for (const required of MEMORIAL_NAMES_REQUIRED) {
    assert.ok(names.has(required), `missing required name: ${required}`);
  }
});

test('Nat Turner carries accurate state-execution context', () => {
  const nat = MEMORIAL_NAMES.find((entry) => entry.name === 'Nat Turner');
  assert.ok(nat);
  assert.equal(nat!.category, 'state_execution');
  assert.equal(nat!.year, 1831);
  assert.ok(nat!.place?.toLowerCase().includes('virginia'));
  assert.ok(
    nat!.context?.toLowerCase().includes('rebellion') ||
      nat!.context?.toLowerCase().includes('executed'),
  );
});

test('memorial name keys are unique by name+year', () => {
  const seen = new Set<string>();
  for (const entry of MEMORIAL_NAMES) {
    const key = `${entry.name.toLowerCase()}|${entry.year}`;
    assert.equal(seen.has(key), false, `duplicate ${key}`);
    seen.add(key);
  }
});

test('selectMemorialNames returns a stable non-duplicating window', () => {
  const a = selectMemorialNames('map-stage', 48);
  const b = selectMemorialNames('map-stage', 48);
  assert.deepEqual(a, b);
  assert.equal(a.length, 48);
  const keys = new Set(a.map((entry) => `${entry.name}|${entry.year}`));
  assert.equal(keys.size, 48);
});

test('memorialNameLabel includes person, year, and place when known', () => {
  const withPlace = MEMORIAL_NAMES.find((entry) => entry.place);
  assert.ok(withPlace);
  const label = memorialNameLabel(withPlace!);
  assert.ok(label.includes(withPlace!.name));
  assert.ok(label.includes(String(withPlace!.year)));
  assert.ok(label.includes(withPlace!.place!));
});

test('plate eligibility requires a full name (rejects single-token entries)', () => {
  assert.equal(
    isMemorialNamePlateEligible({ name: 'Adam', year: 1900, category: 'racial_terror' }),
    false,
  );
  assert.equal(
    isMemorialNamePlateEligible({ name: 'Jim', year: 1900, category: 'racial_terror' }),
    false,
  );
  assert.equal(
    isMemorialNamePlateEligible({ name: 'Emmett Till', year: 1955, category: 'racial_terror' }),
    true,
  );
  assert.equal(
    isMemorialNamePlateEligible({
      name: 'Lawson "Nelse" Patton',
      year: 1908,
      category: 'racial_terror',
    }),
    true,
  );
  assert.ok(MEMORIAL_NAMES_PLATE.length < MEMORIAL_NAMES.length);
  assert.ok(MEMORIAL_NAMES_PLATE.length >= 1000);
  for (const entry of MEMORIAL_NAMES_PLATE) {
    assert.ok(isMemorialNamePlateEligible(entry));
  }
});
