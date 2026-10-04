import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPACT_MEDIA_QUERY, isCompactViewport } from './compact-viewport';

test('phones are compact in both orientations; tablets and laptops are not', () => {
  assert.equal(isCompactViewport(390, 844), true, 'phone portrait');
  assert.equal(isCompactViewport(844, 390), true, 'phone landscape');
  assert.equal(isCompactViewport(820, 1180), false, 'tablet portrait');
  assert.equal(isCompactViewport(1280, 800), false, 'laptop');
  assert.equal(isCompactViewport(1180, 820), false, 'tablet landscape');
});

test('the media query string matches the CSS contract', () => {
  assert.equal(COMPACT_MEDIA_QUERY, '(max-width: 819px), (max-height: 559px)');
});
