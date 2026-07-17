/**
 * Confirms the history page view-model: graph release artifact drives all-time and decade
 * slices, decade views use point-in-time status (never present-day backfill), and URL state parses
 * shareable decade/filter/selection params.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statusAsOf } from '@black-book/domain';
import { resetHistoryGraphReleaseArtifactForTests } from '../../data/history-graph-seed';
import { getPublicEntity, listPublicEntities } from '../../data/public-seed';
import { buildHistoryViewModel } from './history-view-model';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

test('all-time view includes every published seed entity from the graph artifact', () => {
  const view = buildHistoryViewModel({});
  assert.equal(view.totalMatched, listPublicEntities().length);
  assert.equal(view.viewState.mode, 'all-time');
  assert.ok(view.nodes.length > 0);
  assert.ok(view.contentHash.length > 0);
});

test('decade view derives node membership from BB-092 decade artifacts', () => {
  const fifties = buildHistoryViewModel({ decade: '1950s' });
  assert.equal(fifties.viewState.mode, 'decade');
  assert.equal(fifties.activeDecade, '1950s');
  assert.ok(fifties.nodes.some((node) => node.entityId === 'ent_seed_event_001'));
  assert.ok(fifties.nodes.some((node) => node.entityId === 'ent_seed_school_001'));
});

test('decade view uses status-as-of that decade, not present-day status', () => {
  const forties = buildHistoryViewModel({ decade: '1940s' });
  const school = forties.nodes.find((node) => node.entityId === 'ent_seed_school_001');
  assert.ok(school);
  const entity = getPublicEntity('ent_seed_school_001');
  assert.ok(entity?.statusHistory);
  assert.equal(statusAsOf(entity.statusHistory, '1945'), 'historic');
  assert.equal(school!.statusLabel, 'Historic');
  assert.notEqual(school!.statusLabel, entity!.status);
});

test('sparse decade renders the sparse flag for decades outside published coverage', () => {
  const sparse = buildHistoryViewModel({ decade: '1700s' });
  assert.equal(sparse.sparseDecade, true);
  assert.equal(sparse.nodes.length, 0);
});

test('kind filter reduces results without hiding unmatched entities silently', () => {
  const all = buildHistoryViewModel({});
  const places = buildHistoryViewModel({ kind: 'place' });
  assert.ok(places.totalMatched < all.totalMatched);
  for (const node of places.nodes) {
    assert.equal(node.kind, 'place');
  }
});

test('edges expose evidence-backed citations and omit evidence-free connections', () => {
  const view = buildHistoryViewModel({});
  assert.ok(view.edges.length > 0);
  for (const edge of view.edges) {
    assert.ok(edge.evidenceCount > 0);
    assert.ok(edge.citations.length > 0);
    assert.match(edge.sentence, /\./);
  }
});

test('parses shareable URL decade, filter, and selection state', () => {
  const view = buildHistoryViewModel({
    decade: '1860s',
    kind: 'school',
    selected: 'ent_seed_school_001',
    edge: 'rel_seed_school_located_at_place',
  });
  assert.equal(view.viewState.decade, '1860s');
  assert.equal(view.viewState.filters.kind, 'school');
  assert.equal(view.viewState.selected, 'ent_seed_school_001');
  assert.equal(view.viewState.edge, 'rel_seed_school_located_at_place');
  assert.ok(view.selectedNode);
});

test('nodes link to entity pages and surface fact links when present', () => {
  const view = buildHistoryViewModel({ decade: '1950s' });
  for (const node of view.nodes) {
    assert.match(node.href, /^\/entity\//);
  }
  const place = view.nodes.find((node) => node.entityId === 'ent_seed_place_001');
  assert.ok(place);
  assert.ok(place!.factLinks.length > 0);
  assert.match(place!.factLinks[0]!.href, /^\/facts\//);
});
