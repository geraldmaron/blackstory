/**
 * Unit tests for graph publish audit (edge retention + decade coverage).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { auditGraphReleaseArtifact, graphPublishAuditPasses } from './publish-audit.js';
import { buildGraphReleaseArtifact } from './build.js';
import type { EntityRelationship } from '../relationship.js';

function rel(id: string, from: string, to: string): EntityRelationship {
  return {
    id,
    fromEntityId: from,
    toEntityId: to,
    type: 'related_to',
    evidenceIds: ['ev-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('auditGraphReleaseArtifact reports full retention when endpoints are in release', () => {
  const relationships = [rel('r1', 'a', 'b'), rel('r2', 'b', 'c')];
  const artifact = buildGraphReleaseArtifact({
    releaseId: 'rel_test',
    generatedAt: '2026-07-01T00:00:00.000Z',
    entityIds: ['a', 'b', 'c'],
    entities: [
      {
        entityId: 'a',
        activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
      },
      {
        entityId: 'b',
        activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
      },
      {
        entityId: 'c',
        activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
      },
    ],
    relationships,
  });

  const report = auditGraphReleaseArtifact({
    artifact,
    relationships,
    releaseEntityIds: ['a', 'b', 'c'],
    decadeEntities:
      artifact.decadeViews.length > 0
        ? [
            {
              entityId: 'a',
              activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
            },
            {
              entityId: 'b',
              activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
            },
            {
              entityId: 'c',
              activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
            },
          ]
        : [],
  });

  assert.equal(report.unexplainedAllTimeDrops, 0);
  assert.equal(report.allTimeEdgeCount, 2);
  assert.ok(graphPublishAuditPasses(report, { minDecadeCoveragePct: 90 }));
});

test('auditGraphReleaseArtifact flags endpoint_not_in_release drops', () => {
  const relationships = [rel('r1', 'a', 'missing')];
  const artifact = buildGraphReleaseArtifact({
    releaseId: 'rel_test',
    generatedAt: '2026-07-01T00:00:00.000Z',
    entityIds: ['a'],
    entities: [
      {
        entityId: 'a',
        activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
      },
    ],
    relationships,
  });

  const report = auditGraphReleaseArtifact({
    artifact,
    relationships,
    releaseEntityIds: ['a'],
    decadeEntities: [
      {
        entityId: 'a',
        activeSpans: [{ validFrom: '1960', validTo: '1970', datePrecision: 'year' }],
      },
    ],
  });

  assert.equal(report.droppedFromAllTime.length, 1);
  assert.equal(report.droppedFromAllTime[0]?.reason, 'endpoint_not_in_release');
});
