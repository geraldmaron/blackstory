/**
 * Shell gate contracts: the header and footer both read the surface class registry, and the
 * public header brand display never forks per route.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { surfaceClassFor } from '../lib/nav/surface-classes';

const here = dirname(fileURLToPath(import.meta.url));

test('only the Atlas resolves to the instrument class', () => {
  assert.equal(surfaceClassFor('/'), 'record');
  assert.equal(surfaceClassFor('/', 'atlas=1'), 'record');
  assert.equal(surfaceClassFor('/explore'), 'instrument');
  assert.equal(surfaceClassFor('/explore/api'), null);
  assert.equal(surfaceClassFor('/locate'), 'utility');
  assert.equal(surfaceClassFor('/stories'), 'reading');
});

test('the two shell gates read the same registry, so they cannot disagree', () => {
  const header = readFileSync(join(here, 'SiteShellHeader.tsx'), 'utf8');
  const footer = readFileSync(join(here, 'SiteShellFooter.tsx'), 'utf8');
  assert.match(header, /useSurfaceClass/);
  assert.match(footer, /useSurfaceClass/);
  assert.match(header, /=== 'instrument'/);
  assert.match(footer, /=== 'instrument'/);
});

test('SiteHeader uses the theme-paired lockup on every route it renders on', () => {
  const source = readFileSync(join(here, 'SiteHeader.tsx'), 'utf8');
  assert.match(source, /brandDisplay="lockup"/);
  assert.doesNotMatch(source, /brandDisplay=\{isExplore/);
  assert.doesNotMatch(source, /isAtlasShell/);
});
