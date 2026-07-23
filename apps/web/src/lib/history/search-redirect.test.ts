/**
 * Redirect mapper tests: legacy /search query params land on /history.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapSearchQueryToHistoryHref } from './search-redirect';

test('mapSearchQueryToHistoryHref preserves keyword and facet params', () => {
  assert.equal(
    mapSearchQueryToHistoryHref({
      q: 'church',
      kind: 'school',
      status: 'active',
      era: '1890s',
    }),
    '/history?q=church&kind=school&status=active&era=1890s',
  );
});

test('mapSearchQueryToHistoryHref drops default all values and empty query', () => {
  assert.equal(mapSearchQueryToHistoryHref({ kind: 'all', status: 'all' }), '/history');
  assert.equal(mapSearchQueryToHistoryHref({}), '/history');
});

test('mapSearchQueryToHistoryHref preserves offset when non-zero', () => {
  assert.equal(mapSearchQueryToHistoryHref({ q: 'a', offset: '20' }), '/history?q=a&offset=20');
});
