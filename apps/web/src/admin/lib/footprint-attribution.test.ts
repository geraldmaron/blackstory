/**
 * State attribution for the Footprint view and the catalog state filter. The label forms below
 * are the ones observed in the active release on 2026-10-29.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  UNASSIGNED_STATE,
  attributeState,
  normalizeStateFilterValue,
  stateFilterLabel,
  stateFilterValueFor,
} from './footprint-attribution.js';
import {
  entityIdsForStateFilter,
  type PublishedJurisdictionRow,
} from './published-jurisdictions.js';

test('city-and-state, postal, state-only and D.C. labels all resolve', () => {
  assert.equal(attributeState('Alsip, Illinois')?.postalCode, 'IL');
  assert.equal(attributeState('Selma, AL')?.postalCode, 'AL');
  assert.equal(attributeState('Indiana')?.postalCode, 'IN');
  assert.equal(attributeState('Washington, District of Columbia')?.postalCode, 'DC');
});

test('territories, foreign places, junk and placeholders are unassigned, not guessed', () => {
  for (const label of [
    'San Juan, Puerto Rico',
    'Nassau, Bahamas',
    'Arkansas State Capitol',
    'Unknown',
    'United States',
    '',
    null,
  ]) {
    assert.equal(stateFilterValueFor(label), UNASSIGNED_STATE, String(label));
  }
});

test('filter values accept any-case postal codes and unassigned, and nothing else', () => {
  assert.equal(normalizeStateFilterValue('al'), 'AL');
  assert.equal(normalizeStateFilterValue('Unassigned'), UNASSIGNED_STATE);
  assert.equal(normalizeStateFilterValue('ZZ'), undefined);
  assert.equal(normalizeStateFilterValue("AL'; drop"), undefined);
  assert.equal(normalizeStateFilterValue(''), undefined);
  assert.equal(stateFilterLabel('AL'), 'Alabama');
  assert.equal(stateFilterLabel(UNASSIGNED_STATE), 'No state assigned');
});

test('every row lands in exactly one filter value, so state totals reconcile', () => {
  const row = (entityId: string, jurisdictionLabel: string | null): PublishedJurisdictionRow => ({
    entityId,
    jurisdictionLabel,
    kind: 'place',
    recordMaturity: null,
    lat: null,
    lng: null,
  });
  const rows = [
    row('a', 'Selma, AL'),
    row('b', 'Birmingham, Alabama'),
    row('c', 'Nassau, Bahamas'),
    row('d', null),
  ];
  assert.deepEqual(entityIdsForStateFilter(rows, 'AL'), ['a', 'b']);
  assert.deepEqual(entityIdsForStateFilter(rows, 'al'), ['a', 'b']);
  assert.deepEqual(entityIdsForStateFilter(rows, UNASSIGNED_STATE), ['c', 'd']);
  assert.deepEqual(entityIdsForStateFilter(rows, 'GA'), []);
});
