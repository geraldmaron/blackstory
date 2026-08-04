/**
 * Tests for history graph helpers: decade scrubber labels, release-artifact decade axes, and
 * point-in-time status. The Atlas's edge rendering reads decade status through this module
 * (explore-view-model, explore-edge-catalog, build-history-edge-lines), which is why the
 * point-in-time assertion below lives here rather than in the now-deleted /history/api's
 * view-model chain (repo-92n2.36).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGraphReleaseArtifact, maxDecadeInclusive } from '@repo/domain';
import { getPublicEntity } from '../../data/public-seed';
import { decadeLabelsFromArtifact } from './build-history-graph';
import { resolveDecadeStatusLabel } from './decade-status';

const REFERENCE = '2026-07-23';

test('decade status uses status-as-of that decade, never present-day status', () => {
  const entity = getPublicEntity('ent_dunbar_school_001');
  assert.ok(entity?.statusHistory);
  const result = resolveDecadeStatusLabel(entity, '1880s');
  assert.equal(result.kind, 'status');
  assert.equal(result.label, 'Historic');
  assert.notEqual(result.label, entity.status);
});

test('decadeLabelsFromArtifact never lists a decade after the current calendar decade', () => {
  const artifact = buildGraphReleaseArtifact({
    releaseId: 'fixture-future-span',
    generatedAt: `${REFERENCE}T00:00:00.000Z`,
    entityIds: ['ent-future-span'],
    entities: [
      {
        entityId: 'ent-future-span',
        activeSpans: [{ validFrom: '2020', validTo: '2055', datePrecision: 'year' }],
      },
    ],
    relationships: [],
  });

  const labels = decadeLabelsFromArtifact(artifact, REFERENCE);
  assert.ok(labels.length > 0);
  assert.equal(labels.at(-1), maxDecadeInclusive(REFERENCE));
  assert.ok(!labels.includes('2030s'));
  assert.ok(!labels.includes('2040s'));
  assert.ok(!labels.includes('2050s'));
});
