/**
 * Confirms the explore page view-model: every active-release entity with a geo anchor
 * appears, era filters use decade buckets, and default filters never silently hide records.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listPublicEntities } from '../../data/public-seed';
import { buildExploreViewModel } from './explore-view-model';

test('includes every geo-anchored active-release entity by default', () => {
  const view = buildExploreViewModel({});
  assert.equal(view.filteredFeatures.length, listPublicEntities().length);
  assert.equal(view.totalMatched, listPublicEntities().length);
});

test('era filter uses BB-090 decade bucket labels from entity eraBuckets', () => {
  const view = buildExploreViewModel({});
  const eraValues = view.facetOptions.era.map((option) => option.value);
  assert.ok(eraValues.includes('1840s'));
  assert.ok(eraValues.includes('1970s'));
});

test('filtering by era reduces results without hiding unmatched entities silently', () => {
  const all = buildExploreViewModel({});
  const seventies = buildExploreViewModel({ era: '1970s' });
  assert.ok(seventies.totalMatched < all.totalMatched);
  for (const feature of seventies.filteredFeatures) {
    assert.ok(feature.properties.eraBuckets.includes('1970s'));
  }
});

test('parses shareable URL viewport and density state', () => {
  const view = buildExploreViewModel({
    lat: '38.9072',
    lng: '-77.0369',
    zoom: '11.5',
    density: '1',
    selected: 'ent_15th_st_church_001',
  });
  assert.ok(view.viewState.viewport);
  assert.equal(view.viewState.viewport!.lat, 38.9072);
  assert.equal(view.viewState.density, true);
  assert.equal(view.viewState.selected, 'ent_15th_st_church_001');
  assert.equal(view.viewState.lines, false);
});

test('lines=1 projects evidence-backed history edges onto the map', () => {
  const view = buildExploreViewModel({ lines: '1' });
  assert.equal(view.viewState.lines, true);
  assert.ok(view.availableDecades.length > 0);
  assert.ok(view.historyEdges.length > 0);
  assert.equal(view.edgeLineCollection.features.length, view.historyEdges.length);
});

test('decade slice filters relationship lines', () => {
  const allTime = buildExploreViewModel({ lines: '1' });
  const fifties = buildExploreViewModel({ lines: '1', decade: '1950s' });
  assert.ok(fifties.historyEdges.length <= allTime.historyEdges.length);
});
