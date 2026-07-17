/**
 * Tests for BB-087 law status badge vocabulary — imports BB-090 LAW_STATUSES.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LAW_STATUSES, lawStatusLabel, lawStatusTone } from './status.js';

test('LAW_STATUSES matches BB-090 vocabulary', () => {
  assert.deepEqual(LAW_STATUSES, ['in_force', 'amended', 'repealed', 'struck_down', 'enjoined']);
});

test('lawStatusLabel returns human-readable labels', () => {
  assert.equal(lawStatusLabel('struck_down'), 'Struck down');
});

test('lawStatusTone maps enjoined to warning', () => {
  assert.equal(lawStatusTone('enjoined'), 'warning');
});
