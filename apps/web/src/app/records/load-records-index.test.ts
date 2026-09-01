/**
 * loadRecordsIndex query-key parsing — metadata and page must share one build.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recordsHref } from '../../lib/records/build-records-index';
import { loadRecordsIndexFromKey, recordsQueryCacheKey } from './load-records-index';

describe('recordsQueryCacheKey', () => {
  it('matches recordsHref so metadata and page collide on one cache entry', () => {
    assert.equal(recordsQueryCacheKey({}), recordsHref({}));
    assert.equal(
      recordsQueryCacheKey({ state: 'DC', evidence: 'B', page: '2' }),
      recordsHref({ state: 'DC', evidence: 'B', page: 2 }),
    );
  });

  it('round-trips filter params out of the cache key', () => {
    const key = recordsQueryCacheKey({ state: 'DC', evidence: 'B' });
    const { query } = loadRecordsIndexFromKey(key);
    assert.equal(query.state, 'DC');
    assert.equal(query.evidence, 'B');
    assert.equal(query.page, 1);
  });
});
