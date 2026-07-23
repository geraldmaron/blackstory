/**
 * Tests for public prose sanitization before plain-text publication surfaces.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizePublicProseField, sanitizePublicProseText } from './public-render.js';

test('sanitizePublicProseText resolves pipe labels and never emits brackets', () => {
  assert.equal(
    sanitizePublicProseText('The U.S. [[gap_supreme_court|Supreme Court]], established in 1789.'),
    'The U.S. Supreme Court, established in 1789.',
  );
});

test('sanitizePublicProseText falls back to entity id when markup has no label', () => {
  assert.equal(sanitizePublicProseText('See [[gap_supreme_court]] for context.'), 'See gap_supreme_court for context.');
});

test('sanitizePublicProseText is a no-op when no markup is present', () => {
  const plain = 'A concise summary with no linked names.';
  assert.equal(sanitizePublicProseText(plain), plain);
});

test('sanitizePublicProseField preserves undefined', () => {
  assert.equal(sanitizePublicProseField(undefined), undefined);
});
