/**
 * Unit tests for release graph publish builder.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDecadeEntitiesForGraph, buildReleaseGraphArtifact } from './release-graph-publish.ts';

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
