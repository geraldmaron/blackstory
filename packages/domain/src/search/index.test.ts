/**
 * Barrel smoke test: the BB-049 search subsystem index re-exports every public entry point.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as search from './index.js';

test('the search barrel re-exports the full public surface', () => {
  assert.equal(typeof search.rankRecords, 'function');
  assert.equal(typeof search.normalizeQuery, 'function');
  assert.equal(typeof search.levenshtein, 'function');
  assert.equal(typeof search.computeFacetCounts, 'function');
  assert.equal(typeof search.applyFilters, 'function');
  assert.equal(typeof search.buildExplanation, 'function');
  assert.equal(typeof search.buildPublicSearchIndexDocs, 'function');
  assert.equal(typeof search.runPublicSearch, 'function');
});
