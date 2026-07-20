/**
 * Tests for discovery campaign runs desk view helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSurvivorCount, shouldShowSurvivorsColumn } from './discovery-runs-view.ts';

test('shouldShowSurvivorsColumn is true when the row type includes survivors', () => {
  assert.equal(shouldShowSurvivorsColumn([]), true);
  assert.equal(shouldShowSurvivorsColumn([{}]), true);
  assert.equal(shouldShowSurvivorsColumn([{ survivors: 3 }]), true);
});

test('formatSurvivorCount renders dash for missing values', () => {
  assert.equal(formatSurvivorCount(undefined), '—');
  assert.equal(formatSurvivorCount(12), '12');
});
