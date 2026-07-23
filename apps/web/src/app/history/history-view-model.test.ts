/**
 * Confirms the history page view-model: graph release artifact drives all-time and decade
 * slices, decade views use point-in-time status (never present-day backfill), and URL state parses
 * shareable decade/filter/selection params.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statusAsOf } from '@repo/domain';
import { maxDecadeInclusive } from '@repo/domain';
import { resetHistoryGraphReleaseArtifactForTests } from '../../data/history-graph-seed';
import { getPublicEntity, listPublicEntities } from '../../data/public-seed';
import { buildHistoryViewModel } from './history-view-model';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

test('all-time view includes every published seed entity from the graph artifact', () => {
  const entities = listPublicEntities();
  const view = buildHistoryViewModel({}, entities);
  assert.equal(view.totalMatched, entities.length);
  assert.equal(view.viewState.mode, 'all-time');
  assert.ok(view.nodes.length > 0);
  assert.ok(view.contentHash.length > 0);
});

test('all-time view includes an injected undated entity with undated status label', () => {
  const undated = {
    id: 'ent_undated_fixture_001',
    kind: 'place' as const,
    displayName: 'Undated Place Fixture',
    summary: 'No temporal spans.',
    era: 'undated',
    notabilityLabels: [] as const,
    topicTags: ['fixture'] as const,
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'city' as const,
    locationLabel: 'Washington, D.C.',
    relevanceExplanation: 'Fixture.',
    historicalContext: 'Fixture.',
    recordMaturity: 'minimum_record' as const,
    researchCoverage: 'partial' as const,
    mapPin: { x: 50, y: 50 },
    claims: [] as const,
    revision: {
      releaseId: 'seed-snapshot',
      generatedAt: '2026-07-17T00:00:00.000Z',
      recordUpdatedAt: '2026-07-01T00:00:00.000Z',
    },
    relatedIds: [] as const,
    related: [] as const,
    timeline: [] as const,
  };
  const catalog = [...listPublicEntities(), undated];
  const view = buildHistoryViewModel({}, catalog);
  assert.equal(view.totalMatched, catalog.length);
  const node = view.nodes.find((entry) => entry.entityId === undated.id);
  assert.ok(node);
  assert.equal(node!.statusKind, 'undated');
  assert.equal(node!.statusLabel, 'Status not yet published for this record');
});

test('all-time nodes carry resolved era labels from eraBuckets', () => {
  const view = buildHistoryViewModel({});
  const school = view.nodes.find((node) => node.entityId === 'ent_dunbar_school_001');
  assert.ok(school);
  assert.ok(school!.eraBuckets.includes('1870s'));
  assert.match(school!.eraLabel, /1870s/);
});

test('decade view derives node membership from decade artifacts', () => {
  const seventies = buildHistoryViewModel({ decade: '1970s' });
  assert.equal(seventies.viewState.mode, 'decade');
  assert.equal(seventies.activeDecade, '1970s');
  assert.ok(seventies.nodes.some((node) => node.entityId === 'ent_dc_landmark_listing_1975'));
  assert.ok(seventies.nodes.some((node) => node.entityId === 'ent_dunbar_school_001'));
});

test('decade view uses status-as-of that decade, not present-day status', () => {
  const eighties = buildHistoryViewModel({ decade: '1880s' });
  const school = eighties.nodes.find((node) => node.entityId === 'ent_dunbar_school_001');
  assert.ok(school);
  const entity = getPublicEntity('ent_dunbar_school_001');
  assert.ok(entity?.statusHistory);
  assert.equal(statusAsOf(entity.statusHistory, '1885'), 'historic');
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
    decade: '1870s',
    kind: 'school',
    selected: 'ent_dunbar_school_001',
    edge: 'rel_dunbar_school_located_at_church',
  });
  assert.equal(view.viewState.decade, '1870s');
  assert.equal(view.viewState.filters.kind, 'school');
  assert.equal(view.viewState.selected, 'ent_dunbar_school_001');
  assert.equal(view.viewState.edge, 'rel_dunbar_school_located_at_church');
  assert.ok(view.selectedNode);
});

test('query filter matches display name or summary', () => {
  const view = buildHistoryViewModel({ q: 'dunbar' });
  assert.ok(view.totalMatched >= 1);
  assert.ok(
    view.nodes.every((node) => {
      const haystack = `${node.displayName} ${node.summary}`.toLowerCase();
      return haystack.includes('dunbar');
    }),
  );
});

test('sort by connections orders higher-degree nodes first', () => {
  const view = buildHistoryViewModel({ sort: 'connections' });
  assert.ok(view.nodes.length >= 2);
  for (let i = 1; i < view.nodes.length; i += 1) {
    const prev = view.nodes[i - 1]!;
    const curr = view.nodes[i]!;
    assert.ok(prev.connectionCount >= curr.connectionCount);
  }
});

test('nodes link to entity pages', () => {
  const view = buildHistoryViewModel({ decade: '1970s' });
  for (const node of view.nodes) {
    assert.match(node.href, /^\/entity\//);
  }
  const place = view.nodes.find((node) => node.entityId === 'ent_15th_st_church_001');
  assert.ok(place);
});

test('topic filter reduces results to matching topic tags', () => {
  const all = buildHistoryViewModel({});
  const education = buildHistoryViewModel({ topic: 'education' });
  assert.ok(education.totalMatched <= all.totalMatched);
  for (const node of education.nodes) {
    assert.ok(node.topicTags.includes('education'));
  }
});

test('connections filter with keeps only nodes that have edges', () => {
  const view = buildHistoryViewModel({ connections: 'with' });
  assert.ok(view.totalMatched >= 1);
  for (const node of view.nodes) {
    assert.ok(node.connectionCount > 0);
  }
});

test('status filter matches slug derived from status label', () => {
  const all = buildHistoryViewModel({});
  const historicOption = all.facetOptions.status.find((entry) => entry.value === 'historic');
  if (!historicOption) {
    assert.ok(all.facetOptions.status.length > 1, 'seed should expose a historic status facet');
    return;
  }
  const historic = buildHistoryViewModel({ status: 'historic' });
  assert.ok(historic.totalMatched >= 1);
  for (const node of historic.nodes) {
    assert.match(node.statusLabel.toLowerCase(), /historic/);
  }
});

test('facet options include kind, status, and topic with counts', () => {
  const view = buildHistoryViewModel({});
  assert.ok(view.facetOptions.kind.length > 1);
  assert.ok(
    view.facetOptions.kind.some((entry) => entry.value !== 'all' && (entry.count ?? 0) > 0),
  );
  assert.ok(view.facetOptions.status.length > 1);
  assert.ok(view.facetOptions.topic.length > 1);
  const topicWithCount = view.facetOptions.topic.find(
    (entry) => entry.value !== 'all' && (entry.count ?? 0) > 0,
  );
  assert.ok(topicWithCount);
});

test('overview reflects filtered nodes and visible edges', () => {
  const all = buildHistoryViewModel({});
  assert.equal(all.overview.totalRecords, all.totalMatched);
  assert.equal(all.overview.totalConnections, all.edges.length);
  assert.ok(all.overview.kindCounts.length > 0);
  assert.ok(all.overview.decadeDensity.length > 0);
  assert.ok(all.overview.decadeDensity.every((entry) => entry.decade.endsWith('s')));
});

test('overview decade density never lists decades after the current calendar decade', () => {
  const view = buildHistoryViewModel({});
  const ceiling = maxDecadeInclusive('2026-07-23');
  assert.equal(view.availableDecades.at(-1), ceiling);
  assert.ok(view.overview.decadeDensity.every((entry) => entry.decade <= ceiling));
  assert.ok(!view.availableDecades.includes('2030s'));
  assert.ok(!view.overview.decadeDensity.some((entry) => entry.decade === '2030s'));
});

test('overview kind counts follow active filters', () => {
  const places = buildHistoryViewModel({ kind: 'place' });
  assert.ok(places.overview.kindCounts.every((entry) => entry.kind === 'place'));
  assert.equal(
    places.overview.kindCounts.reduce((sum, entry) => sum + entry.count, 0),
    places.overview.totalRecords,
  );
});

test('parses shareable URL with status, topic, and connections', () => {
  const view = buildHistoryViewModel({
    decade: '1870s',
    kind: 'school',
    status: 'historic',
    topic: 'education',
    connections: 'with',
    selected: 'ent_dunbar_school_001',
  });
  assert.equal(view.viewState.filters.status, 'historic');
  assert.equal(view.viewState.filters.topic, 'education');
  assert.equal(view.viewState.filters.connections, 'with');
  assert.equal(view.viewState.filters.kind, 'school');
  assert.equal(view.viewState.selected, 'ent_dunbar_school_001');
});
