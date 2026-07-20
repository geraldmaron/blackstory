/**
 * Unit tests for explore map-shell path detection (footer omitted only on `/explore`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExploreMapShell } from './explore-map-shell';

test('isExploreMapShell is true only for the explore map surface', () => {
  assert.equal(isExploreMapShell('/explore'), true);
  assert.equal(isExploreMapShell('/explore/'), true);
  assert.equal(isExploreMapShell('/'), false);
  assert.equal(isExploreMapShell('/locate'), false);
  assert.equal(isExploreMapShell('/explore/api'), false);
});
