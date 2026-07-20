/**
 * Correction category/target-type guard tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CORRECTION_CATEGORIES,
  CORRECTION_TARGET_TYPES,
  isCorrectionCategory,
  isCorrectionTargetType,
} from './categories.ts';

test('isCorrectionCategory accepts every declared category and rejects drift', () => {
  for (const category of CORRECTION_CATEGORIES) {
    assert.equal(isCorrectionCategory(category), true);
  }
  assert.equal(isCorrectionCategory('unknown_category'), false);
  assert.equal(isCorrectionCategory(42), false);
  assert.equal(isCorrectionCategory(undefined), false);
});

test('isCorrectionTargetType accepts every declared target type and rejects drift', () => {
  for (const targetType of CORRECTION_TARGET_TYPES) {
    assert.equal(isCorrectionTargetType(targetType), true);
  }
  assert.equal(isCorrectionTargetType('unknown_target'), false);
  assert.equal(isCorrectionTargetType(null), false);
});
