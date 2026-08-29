/**
 * The phone bar must keep Rooms on screen by wrapping, not clipping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

test('the phone bar wraps to the viewport instead of clipping Rooms', () => {
  const css = readFileSync(join(here, 'command-bar.css'), 'utf8');
  const start = css.lastIndexOf('@media (max-width: 819px)');
  assert.ok(start >= 0, 'phone wrap block must exist');
  const next = css.indexOf('@media', start + 1);
  const block = next === -1 ? css.slice(start) : css.slice(start, next);
  assert.doesNotMatch(block, /overflow-x:\s*clip/);
  assert.doesNotMatch(block, /max-width:\s*calc\(100vw/);
  assert.match(block, /flex-wrap:\s*wrap/);
  assert.match(block, /\.ds-bar__brand[\s\S]*max-width:\s*2rem/);
  assert.match(block, /min-width:\s*min-content/);
  assert.match(block, /\.ds-bar__tool[\s\S]*display:\s*none/);
});
