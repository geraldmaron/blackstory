/**
 * Tests for Lives citation Wayback enrichment (lookup only).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  enrichLivesCitationsWithArchive,
  type LivesCitationArchiveLookup,
} from './citation-archive.ts';

test('enrichment attaches archiveUrl on found and leaves misses alone', async () => {
  const lookup: LivesCitationArchiveLookup = {
    async findSnapshot(url) {
      if (url.includes('found')) {
        return {
          status: 'found',
          snapshot: { url: 'https://web.archive.org/web/20200101000000/' + url },
        };
      }
      return { status: 'miss', reason: 'no_snapshot' };
    },
  };
  const [found, miss] = await enrichLivesCitationsWithArchive(
    [
      { label: 'a', url: 'https://example.com/found' },
      { label: 'b', url: 'https://example.com/missing' },
    ],
    lookup,
  );
  assert.ok(found?.archiveUrl?.includes('web.archive.org'));
  assert.equal(miss?.archiveUrl, undefined);
});
