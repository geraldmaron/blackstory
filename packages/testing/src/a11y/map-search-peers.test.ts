/**
 * Search and map must expose accessible list peers.
 * Asserts peer modules exist and document the no-JS screen-reader path without
 * importing apps/web (path ownership stays in the web app).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { MAP_SEARCH_ACCESSIBLE_PEERS } from './map-search-peers.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');

test('documented map/search accessible peer modules exist in the repo', () => {
  for (const peer of MAP_SEARCH_ACCESSIBLE_PEERS) {
    const absolute = join(repoRoot, peer.webPath);
    assert.equal(existsSync(absolute), true, `missing peer for ${peer.journey}: ${peer.webPath}`);
  }
});

test('SynchronizedResultList peer documents list-not-fallback contract in source', () => {
  const listPath = join(
    repoRoot,
    'apps/web/src/components/map-experience/SynchronizedResultList.tsx',
  );
  const source = readFileSync(listPath, 'utf8');
  assert.match(source, /accessible list peer/i);
  assert.match(source, /aria-labelledby/);
});

test('search route redirects to unified history find-in-time surface', () => {
  const searchPage = join(repoRoot, 'apps/web/src/app/search/page.tsx');
  const source = readFileSync(searchPage, 'utf8');
  assert.match(source, /redirect\(mapSearchQueryToHistoryHref/);
  assert.doesNotMatch(source, /SearchBrowseSections/);
});
