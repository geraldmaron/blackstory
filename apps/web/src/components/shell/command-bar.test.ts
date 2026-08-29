/**
 * The 390 bar must keep Rooms and the brand on screen by fitting, not clipping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

test('the 390 bar wraps to the viewport instead of clipping Rooms', () => {
  const css = readFileSync(join(here, 'command-bar.css'), 'utf8');
  const start = css.indexOf('@media (max-width: 390px)');
  assert.ok(start >= 0, '390 block must exist');
  const next = css.indexOf('@media', start + 1);
  const block = next === -1 ? css.slice(start) : css.slice(start, next);
  assert.doesNotMatch(block, /overflow-x:\s*clip/);
  assert.doesNotMatch(block, /max-width:\s*calc\(100vw/);
  assert.doesNotMatch(block, /max-width:\s*calc\(100%/);
});
