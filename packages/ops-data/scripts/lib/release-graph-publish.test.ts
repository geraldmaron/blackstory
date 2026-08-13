/**
 * Unit tests for release graph publish builder.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertReleaseGraphAuditOrThrow,
  buildDecadeEntitiesForGraph,
  buildReleaseGraphArtifact,
} from './release-graph-publish.ts';

/** A passing audit; individual tests bend the one field they are about. */
function audit(over: Record<string, unknown> = {}) {
  return {
    canonicalEdgeCount: 10,
    allTimeEdgeCount: 10,
    uniqueDecadeEdgeCount: 5,
    entitiesInRelease: 4092,
    entitiesWithDecadeBuckets: 4000,
    decadeCoveragePct: 97.8,
    adjacencyCapHits: [],
    droppedFromAllTime: [],
    unexplainedAllTimeDrops: 0,
    contentHash: 'abc',
    ...over,
  } as Parameters<typeof assertReleaseGraphAuditOrThrow>[0];
}

test('an unexplained edge drop is a build failure and says so', () => {
  assert.throws(
    () => assertReleaseGraphAuditOrThrow(audit({ unexplainedAllTimeDrops: 3 })),
    /release graph integrity.*must not be waived/s,
  );
});

/**
 * Coverage below the floor must not read like a corrupted build. Withdrawing designation dates
 * that were never eras took real coverage to 49.4%, and the old combined message made that
 * indistinguishable from the integrity failure above.
 */
test('coverage below the floor fails as completeness, not as a broken build', () => {
  assert.throws(
    () => assertReleaseGraphAuditOrThrow(audit({ decadeCoveragePct: 49.4, entitiesWithDecadeBuckets: 2022 })),
    (error: Error) => {
      assert.match(error.message, /decade coverage 49\.4% is below the acknowledged floor 90%/);
      assert.match(error.message, /not whether the build is sound/);
      assert.doesNotMatch(error.message, /integrity/);
      return true;
    },
  );
});

test('the floor defaults to 90 so nothing weakens by omission', () => {
  assert.throws(() => assertReleaseGraphAuditOrThrow(audit({ decadeCoveragePct: 89.9 })), /floor 90%/);
  assert.doesNotThrow(() => assertReleaseGraphAuditOrThrow(audit({ decadeCoveragePct: 90 })));
});

test('an acknowledged floor permits a lower coverage but still fails below it', () => {
  const low = audit({ decadeCoveragePct: 49.4, entitiesWithDecadeBuckets: 2022 });
  assert.doesNotThrow(() => assertReleaseGraphAuditOrThrow(low, { minDecadeCoveragePct: 45 }));
  assert.throws(
    () => assertReleaseGraphAuditOrThrow(low, { minDecadeCoveragePct: 55 }),
    /below the acknowledged floor 55%/,
  );
});

test('an acknowledged floor never waives an integrity failure', () => {
  assert.throws(
    () =>
      assertReleaseGraphAuditOrThrow(audit({ unexplainedAllTimeDrops: 1, decadeCoveragePct: 10 }), {
        minDecadeCoveragePct: 0,
        enforceCoverage: false,
      }),
    /release graph integrity/,
  );
});

test('buildDecadeEntitiesForGraph unions projection eraBuckets and canonical status_history', () => {
  const decadeEntities = buildDecadeEntitiesForGraph({
    releaseRows: [
      {
        entity_id: 'ent-place-1',
        kind: 'place',
        projection: {
          eraBuckets: ['1900s'],
          statusHistory: [
            {
              status: 'active',
              validFrom: '1905-01-01',
              datePrecision: 'year',
              basisClaimIds: [],
            },
          ],
        },
      },
    ],
    canonicalById: new Map(),
  });
  assert.equal(decadeEntities.length, 1);
  assert.ok(decadeEntities[0]!.activeSpans.length >= 1);
});

test('buildReleaseGraphArtifact retains canonical edges between released entities', () => {
  const built = buildReleaseGraphArtifact({
    releaseId: 'rel_test',
    generatedAt: '2026-07-01T00:00:00.000Z',
    releaseRows: [
      { entity_id: 'a', kind: 'place', projection: { eraBuckets: ['1960s'] } },
      { entity_id: 'b', kind: 'place', projection: { eraBuckets: ['1960s'] } },
    ],
    canonicalById: new Map(),
    relationshipRows: [
      {
        id: 'rel-ab',
        from_entity_id: 'a',
        to_entity_id: 'b',
        relationship_type: 'related_to',
        valid_from: null,
        valid_to: null,
        valid_from_edtf: null,
        valid_to_edtf: null,
        evidence_ids: ['ev-1'],
      },
    ],
  });
  assert.equal(built.audit.unexplainedAllTimeDrops, 0);
  assert.ok(built.artifact.allTimeView.edgeIds.includes('rel-ab'));
});
