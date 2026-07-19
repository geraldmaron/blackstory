/**
 * Tests for catalog living status plain labels.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatLivingStatusLabel } from './living-status-label.ts';

test('formatLivingStatusLabel maps canonical values', () => {
  assert.equal(formatLivingStatusLabel('living'), 'Living');
  assert.equal(formatLivingStatusLabel('deceased'), 'Deceased');
  assert.equal(formatLivingStatusLabel('unknown'), 'Unknown');
});

test('formatLivingStatusLabel renders dash when unset', () => {
  assert.equal(formatLivingStatusLabel(undefined), '—');
});
