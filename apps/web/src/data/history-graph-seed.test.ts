/**
 * Regression tests for the graph release artifact seed used by `/history`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHistoryGraphReleaseArtifact,
  getHistoryGraphReleaseArtifact,
  HISTORY_GRAPH_RELEASE_ID,
  resetHistoryGraphReleaseArtifactForTests,
} from './history-graph-seed';
import { listPublicEntities, type PublicEntityView } from './public-seed';

test.beforeEach(() => {
  resetHistoryGraphReleaseArtifactForTests();
});

function undatedFixture(): PublicEntityView {
  return {
    id: 'ent_undated_fixture_001',
    kind: 'place',
    displayName: 'Undated Place Fixture',
    summary: 'A published record with no temporal spans for decade bucketing.',
    era: 'undated',
    notabilityLabels: [],
    topicTags: ['fixture'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'city',
    locationLabel: 'Washington, D.C. (city-level pin)',
    relevanceExplanation: 'Fixture for all-time undated coverage.',
    historicalContext: 'Fixture only.',
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    mapPin: { x: 50, y: 50 },
    claims: [],
    revision: {
      releaseId: 'seed-snapshot',
      generatedAt: '2026-07-17T00:00:00.000Z',
      recordUpdatedAt: '2026-07-01T00:00:00.000Z',
    },
    relatedIds: [],
    related: [],
    timeline: [],
  };
}

test('builds a deterministic graph release artifact from public seed fixtures', () => {
  const first = getHistoryGraphReleaseArtifact();
  const second = getHistoryGraphReleaseArtifact();
  assert.equal(first.releaseId, HISTORY_GRAPH_RELEASE_ID);
  assert.equal(first.contentHash.digest, second.contentHash.digest);
  assert.ok(first.decadeViews.length > 0);
  assert.ok(first.allTimeView.nodeIds.length >= 4);
});

test('all-time node count matches injected catalog including an undated entity', () => {
  const catalog = [...listPublicEntities(), undatedFixture()];
  const artifact = buildHistoryGraphReleaseArtifact(catalog);
  assert.equal(artifact.allTimeView.nodeIds.length, catalog.length);
  assert.ok(artifact.allTimeView.nodeIds.includes('ent_undated_fixture_001'));
});

test('live and seed catalogs do not share memoized artifacts', () => {
  const seedArtifact = getHistoryGraphReleaseArtifact(listPublicEntities());
  const extendedArtifact = getHistoryGraphReleaseArtifact([...listPublicEntities(), undatedFixture()]);
  assert.notEqual(seedArtifact.contentHash.digest, extendedArtifact.contentHash.digest);
  assert.equal(seedArtifact.allTimeView.nodeIds.length, listPublicEntities().length);
  assert.equal(extendedArtifact.allTimeView.nodeIds.length, listPublicEntities().length + 1);
});

test('still-active entities appear in decades after their founding decade', () => {
  const artifact = getHistoryGraphReleaseArtifact();
  // The Dunbar Alumni Federation was founded in 2002 (the "2000s" decade); it must still appear
  // in a LATER decade too, proving the open-ended statusHistory record propagates forward rather
  // than being truncated at its founding decade.
  const twentyTwenties = artifact.decadeViews.find((view) => view.decade === '2020s');
  assert.ok(twentyTwenties);
  assert.ok(twentyTwenties!.nodeIds.includes('ent_dunbar_alumni_federation_001'));
});
