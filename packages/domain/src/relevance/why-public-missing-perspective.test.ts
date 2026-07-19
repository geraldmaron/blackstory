/**
 * Tests for the missing-perspective indicator derivation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveMissingPerspectiveIndicators } from './why-public-missing-perspective.js';

test('returns no indicators when harm is absent', () => {
  assert.deepEqual(deriveMissingPerspectiveIndicators([]), []);
  assert.deepEqual(deriveMissingPerspectiveIndicators(['achievement', 'joy']), []);
});

test('returns no indicators once harm is balanced by at least two other dimensions', () => {
  assert.deepEqual(deriveMissingPerspectiveIndicators(['harm', 'community', 'resistance']), []);
});

test('returns indicators for every undocumented balancing dimension when harm-only', () => {
  const indicators = deriveMissingPerspectiveIndicators(['harm']);
  assert.equal(indicators.length, 8);
  assert.ok(indicators.every((indicator) => indicator.dimension !== 'harm'));
  assert.ok(
    indicators.every((indicator) => /reflects the current state of research/.test(indicator.note)),
  );
});

test('excludes already-documented balancing dimensions from the indicator list when coverage is thin', () => {
  const indicators = deriveMissingPerspectiveIndicators(['harm', 'community']);
  assert.equal(
    indicators.some((indicator) => indicator.dimension === 'community'),
    false,
  );
  assert.equal(indicators.length, 7);
});
