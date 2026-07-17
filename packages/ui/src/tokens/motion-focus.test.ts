
/**
 * Asserts reduced-motion CSS tokens collapse durations and motion token documents the query.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { motion } from './foundation.ts';

const stylesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles');

test('motion tokens document prefers-reduced-motion', () => {
  assert.equal(motion.reducedMotionQuery, '(prefers-reduced-motion: reduce)');
});

test('token CSS collapses durations under reduced motion', () => {
  const css = readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--bb-duration-base:\s*0\.01ms/);
});

test('base CSS disables transitions and animations under reduced motion', () => {
  const css = readFileSync(path.join(stylesDir, 'base.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /transition-duration:\s*0\.01ms\s*!important/);
});

test('focus styles use :focus-visible with outline tokens', () => {
  const css = readFileSync(path.join(stylesDir, 'base.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*var\(--bb-focus-width\)/);
});
