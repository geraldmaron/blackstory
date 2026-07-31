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

test('search route redirects to the record index, which is a real list without JS', () => {
  // Updated with SP-09 (repo-92n2.9). `/search` used to resolve to the history find-in-time
  // surface; `/history` is now itself a redirect, so pointing there would be a two-hop chain into
  // a page that no longer renders. The destination is `/records`, the crawlable record index.
  const searchPage = join(repoRoot, 'apps/web/src/app/search/page.tsx');
  const source = readFileSync(searchPage, 'utf8');
  assert.match(source, /permanentRedirect\(mapSearchQueryToRecordsHref/);
  assert.doesNotMatch(source, /SearchBrowseSections/);
});

test('the record index search destination needs no JavaScript to filter, page or open a record', () => {
  // The accessibility contract that makes `/records` a legitimate redirect target for `/search`:
  // rows, filter chips and page steps are all anchors rendered on the server. If any of these
  // becomes a button with an onClick, a reader without JS loses the archive's only flat index.
  const room = readFileSync(join(repoRoot, 'apps/web/src/app/records/RecordsIndex.tsx'), 'utf8');
  assert.match(room, /method="get"/, 'the find field is a plain GET form');
  assert.match(room, /rel="prev"/);
  assert.match(room, /rel="next"/);

  const kit = readFileSync(
    join(repoRoot, 'apps/web/src/components/room/HairlineIndex.tsx'),
    'utf8',
  );
  assert.match(kit, /className="ds-room-idx__row" href=/, 'index rows are anchors, not buttons');
});
