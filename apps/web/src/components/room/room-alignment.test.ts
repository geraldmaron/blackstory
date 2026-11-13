/**
 * Text alignment policy: running text and headings are start-aligned. A page's frame may be centered
 * on the screen, but the lines inside it start at one left edge.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const rule = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule exists`);
  return css.slice(start, css.indexOf('}', start));
};

test('door journey cards place themselves centered but do not center their text', () => {
  const css = read('../../app/door-home.css');
  const rule1 = rule(css, '.ds-door-journey__chapter--center');
  assert.match(rule1, /justify-items:\s*center/);
  assert.doesNotMatch(rule1, /text-align:\s*center/);
});
