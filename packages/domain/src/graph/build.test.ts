/**
 * Tests for the derived graph release artifact (per-entity
 * adjacency, per-decade views, all-time union) is deterministic, cycle-safe, bounded-depth, and
 * re-runnable plus path-shape convention and
 * public related-entry projection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertGraphReleaseArtifactReproducible,
  buildGraphReleaseArtifact,
  publicGraphAdjacencyPath,
  publicGraphAllTimePath,
  publicGraphDecadePath,
  publicRelatedEntriesByEntityId,
  type GraphReleaseArtifactInput,
} from './build.js';
import { GRAPH_GOLD_FIXTURES } from './fixtures.js';

function sampleInput(): GraphReleaseArtifactInput {
  return {
    releaseId: 'release-2026-07-17',
    generatedAt: '2026',
    entityIds: [
      'gg-person-organizer',
      'gg-event-rally',
      'gg-org-league',
      'gg-publication-address',
      'gg-case-appeal',
      'gg-law-restriction',
      'gg-place-modern-city',
      'gg-policy-exclusionary-lending',
      'gg-place-disinvested-district',
    ],
    entities: [
      GRAPH_GOLD_FIXTURES.decadeBucketing.stillActiveOrg,
      GRAPH_GOLD_FIXTURES.decadeBucketing.singleDecadeEvent,
    ],
    relationships: GRAPH_GOLD_FIXTURES.causationVocabulary,
  };
}

test('buildGraphReleaseArtifact produces adjacency, decade views, all-time view, and a content hash', () => {
  const artifact = buildGraphReleaseArtifact(sampleInput());
  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.releaseId, 'release-2026-07-17');
  assert.ok(artifact.adjacencyByEntityId.size > 0);
  assert.ok(artifact.decadeViews.length > 0);
  assert.ok(artifact.allTimeView.nodeIds.length > 0);
  assert.match(artifact.contentHash.digest, /^[a-f0-9]{64}$/);
  assert.equal(artifact.contentHash.algorithm, 'sha256');
});

test('DETERMINISTIC: re-running the build against identical input yields a byte-identical content hash', () => {
  assert.doesNotThrow(() => assertGraphReleaseArtifactReproducible(sampleInput()));

  const first = buildGraphReleaseArtifact(sampleInput());
  const second = buildGraphReleaseArtifact(sampleInput());
  assert.equal(first.contentHash.digest, second.contentHash.digest);
  assert.deepEqual([...first.decadeViews], [...second.decadeViews]);
});

test('RE-RUNNABLE: building twice in sequence (simulating a publication-worker retry) never throws and stays reproducible', () => {
  const input = sampleInput();
  const runs = [buildGraphReleaseArtifact(input), buildGraphReleaseArtifact(input), buildGraphReleaseArtifact(input)];
  const digests = new Set(runs.map((r) => r.contentHash.digest));
  assert.equal(digests.size, 1, 'every rebuild must hash identically');
});

test('CYCLE-SAFE / BOUNDED-DEPTH: a build over cyclic containment fixtures still terminates and produces output', () => {
  // The graph-view build itself doesn't traverse containment (that's ./containment.ts's job,
  // independently proven cycle-safe in containment.test.ts); this proves the overall build
  // pipeline tolerates a relationship set that happens to contain a cycle without hanging.
  const input: GraphReleaseArtifactInput = {
    releaseId: 'release-cycle-check',
    generatedAt: '2026',
    entityIds: ['gg-place-cycle-a', 'gg-place-cycle-b'],
    entities: [],
    relationships: GRAPH_GOLD_FIXTURES.containmentCycle.relationships,
  };
  const artifact = buildGraphReleaseArtifact(input);
  assert.ok(artifact.adjacencyByEntityId.get('gg-place-cycle-a')!.entries.length >= 1);
});

test('acceptance criterion 4 path shape: publicReleases/{releaseId}/graph/... mirrors the BB-019 entity-projection path convention', () => {
  assert.equal(
    publicGraphAdjacencyPath('release-1', 'ent-a'),
    'publicReleases/release-1/graph/adjacency/ent-a',
  );
  assert.equal(publicGraphDecadePath('release-1', '1960s'), 'publicReleases/release-1/graph/decades/1960s');
  assert.equal(publicGraphAllTimePath('release-1'), 'publicReleases/release-1/graph/all-time');
});

test('publicGraphAdjacencyPath rejects unsafe path segments (fail-closed, same discipline as publication/index.ts)', () => {
  assert.throws(() => publicGraphAdjacencyPath('../escape', 'ent-a'));
  assert.throws(() => publicGraphAdjacencyPath('release-1', '..'));
});

test('publicRelatedEntriesByEntityId produces the {id, type, direction, timespan} public shape for every entity', () => {
  const artifact = buildGraphReleaseArtifact(sampleInput());
  const publicEntries = publicRelatedEntriesByEntityId(artifact);
  const organizerEntries = publicEntries.get('gg-person-organizer');
  assert.ok(organizerEntries && organizerEntries.length > 0);
  for (const entry of organizerEntries!) {
    assert.ok('id' in entry && 'type' in entry && 'direction' in entry);
    assert.ok(!('evidenceCount' in entry), 'evidenceCount must not leak into the public shape');
  }
});
