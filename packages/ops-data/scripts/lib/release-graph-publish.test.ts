/**
 * Unit tests for release graph publish builder.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import {
  assertReleaseGraphAuditOrThrow,
  buildDecadeEntitiesForGraph,
  buildReleaseGraphArtifact,
  mapCanonicalRelationshipRow,
  persistReleaseGraphArtifact,
  CANONICAL_RELATIONSHIPS_SQL,
} from './release-graph-publish.ts';

test('caller-managed graph persistence leaves rollback to the outer transaction', async () => {
  const statements: string[] = [];
  const client = {
    async query(statement: string) {
      statements.push(statement);
      if (statement.startsWith('DELETE')) throw new Error('write failed');
      return { rows: [] };
    },
  };
  await assert.rejects(
    persistReleaseGraphArtifact(client as never, 'release-1', {} as never, {
      manageTransaction: false,
    }),
    /write failed/u,
  );
  assert.ok(!statements.includes('BEGIN'));
  assert.ok(!statements.includes('COMMIT'));
  assert.ok(!statements.includes('ROLLBACK'));
});

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
    () =>
      assertReleaseGraphAuditOrThrow(
        audit({ decadeCoveragePct: 49.4, entitiesWithDecadeBuckets: 2022 }),
      ),
    (error: Error) => {
      assert.match(error.message, /decade coverage 49\.4% is below the acknowledged floor 90%/);
      assert.match(error.message, /not whether the build is sound/);
      assert.doesNotMatch(error.message, /integrity/);
      return true;
    },
  );
});

test('the floor defaults to 90 so nothing weakens by omission', () => {
  assert.throws(
    () => assertReleaseGraphAuditOrThrow(audit({ decadeCoveragePct: 89.9 })),
    /floor 90%/,
  );
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

test('release graph requires explicit publication, acceptance and relationship evidence', () => {
  assert.match(CANONICAL_RELATIONSHIPS_SQL, /r.publication_status = 'published'/);
  assert.match(CANONICAL_RELATIONSHIPS_SQL, /r.workflow_status = 'accepted'/);
  assert.match(CANONICAL_RELATIONSHIPS_SQL, /EXISTS.*entity_relationship_evidence/);
  assert.throws(
    () =>
      mapCanonicalRelationshipRow({
        id: 'unproved',
        from_entity_id: 'a',
        to_entity_id: 'b',
        relationship_type: 'founded',
        valid_from: null,
        valid_to: null,
        valid_from_edtf: null,
        valid_to_edtf: null,
        evidence_ids: [],
      }),
    /no explicit evidence/,
  );
});

test(
  'live release query excludes unpublished, unreviewed and unsupported canonical edges',
  { skip: !process.env.RESEARCH_TEST_DATABASE_URL },
  async () => {
    const connectionString = process.env.RESEARCH_TEST_DATABASE_URL!;
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname));
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO canonical.entities (id,kind,entity_class,display_name)
        VALUES ('graph-proof-a','person','person','Researcher'),('graph-proof-b','organization','organization','Association');
        INSERT INTO evidence.evidence_sources (id,display_name) VALUES ('graph-proof-source','Archive');
        INSERT INTO evidence.source_items (id,source_id,stable_identifier,url)
        VALUES ('graph-proof-item','graph-proof-source','entry','https://archive.example.org/entry');
        INSERT INTO evidence.evidence_records (id,source_item_id,excerpt)
        VALUES ('graph-proof-evidence','graph-proof-item','The researcher founded the association.');
        INSERT INTO canonical.entity_relationships (id,from_entity_id,to_entity_id,relationship_type,workflow_status,publication_status)
        VALUES ('graph-proof-valid','graph-proof-a','graph-proof-b','founded','accepted','published'),
               ('graph-proof-draft','graph-proof-a','graph-proof-b','founded','accepted','unpublished'),
               ('graph-proof-unreviewed','graph-proof-a','graph-proof-b','founded',NULL,'published'),
               ('graph-proof-unsupported','graph-proof-a','graph-proof-b','founded','accepted','published');
        INSERT INTO canonical.entity_relationship_evidence (relationship_id,evidence_id)
        VALUES ('graph-proof-valid','graph-proof-evidence'),('graph-proof-draft','graph-proof-evidence'),('graph-proof-unreviewed','graph-proof-evidence');
      `);
      const result = await client.query(CANONICAL_RELATIONSHIPS_SQL, [
        ['graph-proof-a', 'graph-proof-b'],
      ]);
      assert.deepEqual(
        result.rows.map((row) => row.id),
        ['graph-proof-valid'],
      );
      assert.deepEqual(result.rows[0]?.evidence_ids, ['graph-proof-evidence']);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  },
);
