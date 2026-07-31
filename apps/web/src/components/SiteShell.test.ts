/**
 * Atlas shell-gate path detection and public header brand display.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isAtlasShell } from './explore-map-shell';

const here = dirname(fileURLToPath(import.meta.url));

test('isAtlasShell is true only for the Atlas', () => {
  assert.equal(isAtlasShell('/'), true);
  // `/explore` 308s to `/` and never renders, so it must not be treated as a live surface —
  // a stale `true` here would strip the header from a route that does not exist.
  assert.equal(isAtlasShell('/explore'), false);
  assert.equal(isAtlasShell('/explore/api'), false);
  assert.equal(isAtlasShell('/locate'), false);
  assert.equal(isAtlasShell('/chapters'), false);
});

test('the two shell gates read the same predicate, so they cannot disagree', () => {
  const header = readFileSync(join(here, 'SiteShellHeader.tsx'), 'utf8');
  const footer = readFileSync(join(here, 'SiteShellFooter.tsx'), 'utf8');
  assert.match(header, /isAtlasShell/);
  assert.match(footer, /isAtlasShell/);
});

test('SiteHeader uses the theme-paired lockup on every route it renders on', () => {
  const source = readFileSync(join(here, 'SiteHeader.tsx'), 'utf8');
  assert.match(source, /brandDisplay="lockup"/);
  assert.doesNotMatch(source, /brandDisplay=\{isExplore/);
  assert.doesNotMatch(source, /isAtlasShell/);
});
