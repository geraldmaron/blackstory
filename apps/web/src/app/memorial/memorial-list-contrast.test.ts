/**
 * Tests for the memorial full-list contrast-boost predicate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldBoostListContrast } from './memorial-list-contrast';

test('not boosted while the panel is still below the viewport', () => {
  assert.equal(shouldBoostListContrast(1200, 900), false);
});

test('boosted once the panel top crosses the upper half of the viewport', () => {
  assert.equal(shouldBoostListContrast(449, 900), true);
  assert.equal(shouldBoostListContrast(450, 900), true);
  assert.equal(shouldBoostListContrast(451, 900), false);
});

test('boosted while scrolled well past the panel top (negative top)', () => {
  assert.equal(shouldBoostListContrast(-5000, 900), true);
});

test('handles a zero-height viewport defensively', () => {
  assert.equal(shouldBoostListContrast(0, 0), false);
});
