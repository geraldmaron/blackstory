/**
 * Behaviour of the trimming helpers that replaced `replace(/x+$/, '')` expressions across the
 * package, including the long-run input that made those expressions quadratic.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  trimChars,
  trimLeadingChars,
  trimTrailingChars,
  trimTrailingSlashes,
} from './trim-chars.js';

test('trailing runs are removed, and nothing else is touched', () => {
  assert.equal(trimTrailingSlashes('https://example.org///'), 'https://example.org');
  assert.equal(trimTrailingSlashes('https://example.org'), 'https://example.org');
  assert.equal(trimTrailingSlashes('///'), '');
  assert.equal(trimTrailingSlashes(''), '');
  assert.equal(trimTrailingChars('sentence...,,;:', '.,;:'), 'sentence');
  assert.equal(trimTrailingChars('nothing to trim', '.,;:'), 'nothing to trim');
});

test('leading runs are removed', () => {
  assert.equal(trimLeadingChars('///slug', '/'), 'slug');
  assert.equal(trimLeadingChars('slug', '/'), 'slug');
});

test('both ends together', () => {
  assert.equal(trimChars('///slug///', '/'), 'slug');
  assert.equal(trimChars('/a/b/', '/'), 'a/b');
});

test('a long run of the trimmed character stays linear', () => {
  // The shape that made the regex quadratic. If this ever regresses to a backtracking
  // expression, this assertion is what hangs.
  const long = `https://example.org${'/'.repeat(200_000)}`;
  assert.equal(trimTrailingSlashes(long), 'https://example.org');
  assert.equal(trimChars('/'.repeat(200_000), '/'), '');
});
