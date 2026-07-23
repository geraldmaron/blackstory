/**
 * iconWithFallback: fail-closed neutral glyph when resolver returns undefined.
 */
import assert from 'node:assert/strict';
import { faCircle } from '@fortawesome/free-solid-svg-icons';
import { test } from 'node:test';
import { iconWithFallback } from './icon-fallback';

test('iconWithFallback returns the icon when defined', () => {
  assert.equal(iconWithFallback(faCircle), faCircle);
});

test('iconWithFallback returns faCircle when icon is undefined', () => {
  assert.equal(iconWithFallback(undefined), faCircle);
  assert.equal(iconWithFallback(null), faCircle);
});
