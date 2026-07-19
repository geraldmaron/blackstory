/**
 * Tests for the living-status derivation guess (the related workstream).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LIVING_STATUS, deriveLivingStatus, treatAsLiving } from './living.js';

test('deriveLivingStatus defaults to unknown (treated as living) with no signal', () => {
  assert.equal(deriveLivingStatus({}), DEFAULT_LIVING_STATUS);
  assert.equal(treatAsLiving(deriveLivingStatus({})), true);
});

test('deriveLivingStatus returns deceased when a death year is present', () => {
  assert.equal(deriveLivingStatus({ deathYear: 1968 }), 'deceased');
  assert.equal(deriveLivingStatus({ birthYear: 1929, deathYear: 1968 }), 'deceased');
});

test('deriveLivingStatus returns deceased for an implausibly old birth year with no death year', () => {
  assert.equal(deriveLivingStatus({ birthYear: 1850, asOfYear: 2026 }), 'deceased');
});

test('deriveLivingStatus stays unknown for a plausible living-age birth year', () => {
  assert.equal(deriveLivingStatus({ birthYear: 1990, asOfYear: 2026 }), DEFAULT_LIVING_STATUS);
});

test('deriveLivingStatus never independently asserts living from absence of evidence', () => {
  // No birth/death signal at all: falls back to 'unknown', never a hard 'living' assertion.
  assert.notEqual(deriveLivingStatus({ asOfYear: 2026 }), 'living');
});
