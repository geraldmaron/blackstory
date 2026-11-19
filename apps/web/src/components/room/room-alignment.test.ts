/**
 * Text alignment policy: running text and headings are start-aligned. A page's frame may be centered
 * on the screen, but the lines inside it start at one left edge.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

test('the door opening and walk card start-align their text', () => {
  const css = read('../../app/door-home.css');
  assert.doesNotMatch(css, /text-align:\s*center/);
});
