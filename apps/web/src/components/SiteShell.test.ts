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
  assert.equal(surfaceClassFor('/'), 'instrument');
  // `/explore` 308s to `/` and never renders, so it must not be treated as a live surface —
  // a stale instrument verdict here would strip the header from a route that does not exist.
  assert.equal(surfaceClassFor('/explore'), null);
  assert.equal(surfaceClassFor('/explore/api'), null);
  assert.equal(surfaceClassFor('/locate'), 'utility');
  assert.equal(surfaceClassFor('/stories'), 'reading');
});

test('the two shell gates read the same registry, so they cannot disagree', () => {
  const header = readFileSync(join(here, 'SiteShellHeader.tsx'), 'utf8');
  const footer = readFileSync(join(here, 'SiteShellFooter.tsx'), 'utf8');
  assert.match(header, /surfaceClassFor\(pathname\) === 'instrument'/);
  assert.match(footer, /surfaceClassFor\(pathname\) === 'instrument'/);
});

test('SiteHeader uses the theme-paired lockup on every route it renders on', () => {
  const source = readFileSync(join(here, 'SiteHeader.tsx'), 'utf8');
  assert.match(source, /brandDisplay="lockup"/);
  assert.doesNotMatch(source, /brandDisplay=\{isExplore/);
  assert.doesNotMatch(source, /isAtlasShell/);
});
