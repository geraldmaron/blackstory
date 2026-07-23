/**
 * Tests for history graph helpers: decade scrubber labels and release-artifact decade axes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGraphReleaseArtifact, maxDecadeInclusive } from '@repo/domain';
import { decadeLabelsFromArtifact } from './build-history-graph';

const REFERENCE = '2026-07-23';

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
