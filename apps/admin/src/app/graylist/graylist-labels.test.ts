/**
 * Tests for graylist plain-language labels.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatGraylistDisposition, formatGraylistStatus } from './graylist-labels.ts';

test('formatGraylistDisposition maps known disposition codes', () => {
  assert.equal(
    formatGraylistDisposition('weak_signal_uncorroborated'),
    'Weak signal — not yet corroborated',
  );
  assert.equal(formatGraylistDisposition('below_threshold'), 'Below relevance threshold');
});

test('formatGraylistDisposition falls back for unknown codes', () => {
  assert.equal(formatGraylistDisposition('custom_reason'), 'custom reason');
});

test('formatGraylistStatus maps known status values', () => {
  assert.equal(formatGraylistStatus('parked'), 'Parked');
  assert.equal(formatGraylistStatus('promoted'), 'Promoted to inbox');
});
