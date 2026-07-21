/**
 * Pure tests for explore place-search center marker helpers.
 * DOM construction is browser-only — exercised via MapStage integration.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXPLORE_SEARCH_CENTER_MARKER_CLASS,
  exploreSearchCenterMarkerLabel,
} from './explore-search-marker';

test('exploreSearchCenterMarkerLabel falls back when label is empty', () => {
  assert.equal(exploreSearchCenterMarkerLabel(), 'Search center');
  assert.equal(exploreSearchCenterMarkerLabel('   '), 'Search center');
});

test('exploreSearchCenterMarkerLabel trims resolved place names', () => {
  assert.equal(exploreSearchCenterMarkerLabel('  Chicago, IL  '), 'Chicago, IL');
});

test('search center marker class is distinct from entity markers', () => {
  assert.equal(EXPLORE_SEARCH_CENTER_MARKER_CLASS, 'ds-map-search-center-marker');
  assert.notEqual(EXPLORE_SEARCH_CENTER_MARKER_CLASS, 'ds-map-entity-marker');
});
