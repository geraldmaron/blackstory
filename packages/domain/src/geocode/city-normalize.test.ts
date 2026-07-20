/**
 * Tests for city/state parsing used by locality geocode fallback.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCityStateInput } from './city-normalize.js';

test('parseCityStateInput accepts City, ST', () => {
  assert.deepEqual(parseCityStateInput('Montgomery, AL'), {
    city: 'Montgomery',
    stateAbbrev: 'AL',
  });
  assert.deepEqual(parseCityStateInput('Washington, DC'), {
    city: 'Washington',
    stateAbbrev: 'DC',
  });
});

test('parseCityStateInput accepts City ST without comma', () => {
  assert.deepEqual(parseCityStateInput('Tulsa OK'), {
    city: 'Tulsa',
    stateAbbrev: 'OK',
  });
});

test('parseCityStateInput pulls trailing city/state from a street address', () => {
  assert.deepEqual(parseCityStateInput('1616 Chappelle St, Tulsa, OK'), {
    city: 'Tulsa',
    stateAbbrev: 'OK',
  });
});

test('parseCityStateInput rejects bare street fragments', () => {
  assert.equal(parseCityStateInput('123 Main Street'), undefined);
  assert.equal(parseCityStateInput(''), undefined);
});
