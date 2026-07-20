/**
 * Tests for the passive-euphemism editorial check.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoPassiveEuphemisms, findPassiveEuphemisms } from './why-public-editorial.js';

test('findPassiveEuphemisms is case-insensitive and returns no matches for clean prose', () => {
  assert.deepEqual(
    findPassiveEuphemisms('The school was founded in 1867 by formerly enslaved residents.'),
    [],
  );
});

test('findPassiveEuphemisms matches known euphemistic phrasing', () => {
  const findings = findPassiveEuphemisms('Tensions Arose after the march reached downtown.');
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.phrase, 'tensions arose');
});

test('assertNoPassiveEuphemisms does not throw for clean prose', () => {
  assert.doesNotThrow(() =>
    assertNoPassiveEuphemisms(
      'A mob of white residents burned the church on the night of March 3.',
    ),
  );
});

test('assertNoPassiveEuphemisms throws with the matched phrase named', () => {
  assert.throws(
    () => assertNoPassiveEuphemisms('An incident occurred near the courthouse in 1921.'),
    /an incident occurred/,
  );
});
