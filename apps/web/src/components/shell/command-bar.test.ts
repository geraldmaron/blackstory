/**
 * The phone bar must keep Rooms on the first row, not clip or wrap it away.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

test('the phone bar keeps Rooms on the first row instead of clipping it', () => {
  const css = readFileSync(join(here, 'command-bar.css'), 'utf8');
  const start = css.lastIndexOf('@media (max-width: 819px)');
  assert.ok(start >= 0, 'phone grid block must exist');
  const next = css.indexOf('@media', start + 1);
  const block = next === -1 ? css.slice(start) : css.slice(start, next);
  assert.doesNotMatch(block, /overflow-x:\s*clip/);
  assert.doesNotMatch(block, /max-width:\s*calc\(100vw/);
  assert.doesNotMatch(block, /flex-wrap:\s*wrap/);
  assert.match(block, /grid-template-areas:/);
  assert.match(block, /brand tools/);
  assert.match(block, /\.ds-bar__brand[\s\S]*max-width:\s*2rem/);
  assert.match(block, /\.ds-bar__tools[\s\S]*min-width:\s*0/);
  assert.match(block, /\.ds-bar__tool[\s\S]*display:\s*none/);
  assert.match(block, /height:\s*auto/);
});

test('reading bars keep Door, Explore, and Records in Find; Explore bars keep a Door exit', () => {
  const source = readFileSync(join(here, 'CommandBar.tsx'), 'utf8');
  assert.match(source, /href="\/explore"/);
  assert.match(source, /href="\/records"/);
  assert.match(source, /href="\/"/);
  assert.match(source, /\n\s*Door\n/);
  assert.match(source, /\n\s*Explore\n/);
  assert.match(source, /aria-label="Find"/);
  assert.doesNotMatch(source, />\s*Journey\s*</);
  assert.doesNotMatch(source, /onModeChange!\('story'\)/);
});
