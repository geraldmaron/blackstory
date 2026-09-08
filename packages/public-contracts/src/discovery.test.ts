/**
 * The shared discovery vocabulary's conversions. These are the values a legacy address carries
 * across a redirect, so a wrong answer here silently drops a reader's filter.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DISCOVERY_FIELDS,
  MAX_DISCOVERY_QUERY_LENGTH,
  decadeParamToEra,
  isUnsetDiscoveryValue,
  normalizeDiscoveryQuery,
} from './discovery.js';

test('a decade normalizes to its era bucket label, in either shape a reader types', () => {
  assert.equal(decadeParamToEra('1930'), '1930s');
  assert.equal(decadeParamToEra('1930s'), '1930s');
  assert.equal(decadeParamToEra(' 1960s '), '1960s');
});

test('a junk decade drops out rather than becoming a chip that matches nothing', () => {
  assert.equal(decadeParamToEra('1935'), undefined);
  assert.equal(decadeParamToEra('nineteen-thirties'), undefined);
  assert.equal(decadeParamToEra('all'), undefined);
  assert.equal(decadeParamToEra(''), undefined);
  assert.equal(decadeParamToEra(undefined), undefined);
});

test('a query is trimmed, collapsed and bounded rather than rejected', () => {
  assert.equal(normalizeDiscoveryQuery('  tulsa   greenwood '), 'tulsa greenwood');
  assert.equal(normalizeDiscoveryQuery(undefined), '');
  assert.equal(
    normalizeDiscoveryQuery('x'.repeat(MAX_DISCOVERY_QUERY_LENGTH + 40)).length,
    MAX_DISCOVERY_QUERY_LENGTH,
  );
});

test('"all" and empty both mean no narrowing, on every surface', () => {
  assert.equal(isUnsetDiscoveryValue('all'), true);
  assert.equal(isUnsetDiscoveryValue(''), true);
  assert.equal(isUnsetDiscoveryValue('  '), true);
  assert.equal(isUnsetDiscoveryValue('person'), false);
});

test('the field list is the five narrowing concepts, and nothing route-shaped', () => {
  assert.deepEqual([...DISCOVERY_FIELDS], ['q', 'kind', 'era', 'place', 'evidenceFloor']);
});
