/**
 * Apparatus TOC and section heads draw destination glyphs from the catalog, not hand-picked SVGs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { destinationById } from '../../lib/nav/destination-registry';

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, 'page.tsx'), 'utf8');

test('apparatus TOC sections come from the destination catalog', () => {
  assert.match(pageSource, /destinationById/);
  assert.match(pageSource, /DestinationIcon/);
  assert.match(pageSource, /TOC_IDS/);
  for (const id of ['about', 'methodology', 'data', 'law', 'books'] as const) {
    assert.ok(destinationById(id), `${id} must exist in the catalog`);
    assert.match(pageSource, new RegExp(`id="${id}"`));
  }
});
