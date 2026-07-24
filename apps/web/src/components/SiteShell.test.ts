/**
 * Unit tests for explore map-shell path detection and public header brand display.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isExploreMapShell } from './explore-map-shell';

const here = dirname(fileURLToPath(import.meta.url));

test('isExploreMapShell is true only for the explore map surface', () => {
  assert.equal(isExploreMapShell('/explore'), true);
  assert.equal(isExploreMapShell('/explore/'), true);
  assert.equal(isExploreMapShell('/'), false);
  assert.equal(isExploreMapShell('/locate'), false);
  assert.equal(isExploreMapShell('/explore/api'), false);
});

test('SiteHeader uses the theme-paired lockup on every route including Explore', () => {
  const source = readFileSync(join(here, 'SiteHeader.tsx'), 'utf8');
  assert.match(source, /brandDisplay="lockup"/);
  assert.doesNotMatch(source, /brandDisplay=\{isExplore/);
  assert.doesNotMatch(source, /isExploreMapShell/);
});
