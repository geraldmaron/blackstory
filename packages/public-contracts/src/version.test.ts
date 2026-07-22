import assert from 'node:assert/strict';
import { test } from 'node:test';
import { API_VERSION, DEPRECATION_WINDOW_DAYS, MIN_SUPPORTED_API_VERSION, isKnownApiVersion } from './version.js';

test('API_VERSION and MIN_SUPPORTED_API_VERSION are both v1 today', () => {
  assert.equal(API_VERSION, 'v1');
  assert.equal(MIN_SUPPORTED_API_VERSION, 'v1');
});

test('deprecation window floor is documented as 90 days (ADR-021 §2)', () => {
  assert.equal(DEPRECATION_WINDOW_DAYS, 90);
});

test('isKnownApiVersion recognizes v1 and rejects everything else', () => {
  assert.equal(isKnownApiVersion('v1'), true);
  assert.equal(isKnownApiVersion('v2'), false);
  assert.equal(isKnownApiVersion(''), false);
  assert.equal(isKnownApiVersion('v1 '), false);
});
