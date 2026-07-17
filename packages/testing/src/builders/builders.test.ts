
/**
 * Unit tests for domain fixture builders used across test layers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ClaimBuilder,
  EntityBuilder,
  EvidenceBuilder,
  PublicationReleaseBuilder,
  SourceBuilder,
  SubmissionBuilder,
  buildClaim,
  buildEntity,
  buildEvidence,
  buildPublicationRelease,
  buildSource,
  buildSubmission,
} from './index.ts';
import { createIdFactory } from '../ids.ts';
import { fixedClock, steppingClock } from '../utilities.ts';

test('builders share deterministic clocks and identifiers', () => {
  const clock = fixedClock('2026-07-16T12:00:00.000Z');
  const entity = new EntityBuilder({
    ids: createIdFactory('ent'),
    clock,
  })
    .withKind('person')
    .withName('Sample Person')
    .withLivingStatus('unknown')
    .build();
  const source = new SourceBuilder({ ids: createIdFactory('src'), clock })
    .withTitle('Archive')
    .withAuthority('primary')
    .build();
  const claim = new ClaimBuilder({ ids: createIdFactory('clm'), clock })
    .withEntityId(entity.id)
    .withStatus('accepted')
    .withConfidence(0.9)
    .build();
  const evidence = new EvidenceBuilder({ ids: createIdFactory('evd'), clock })
    .withClaimId(claim.id)
    .withSourceId(source.id)
    .build();
  const release = new PublicationReleaseBuilder({
    ids: createIdFactory('rel'),
    snapshotIds: createIdFactory('snp'),
    clock,
  })
    .withStatus('released')
    .withVersion('2026.07.16')
    .build();
  const submission = new SubmissionBuilder({ ids: createIdFactory('sub'), clock })
    .withEntityId(entity.id)
    .withStatus('quarantined')
    .build();

  assert.equal(entity.id, 'ent_0001');
  assert.equal(entity.createdAt, '2026-07-16T12:00:00.000Z');
  assert.equal(source.id, 'src_0001');
  assert.equal(claim.entityId, entity.id);
  assert.equal(evidence.claimId, claim.id);
  assert.equal(evidence.sourceId, source.id);
  assert.equal(evidence.sourceItemId, 'sitm_0001');
  assert.equal(source.adapterEnabled, true);
  assert.ok(source.stableIdentifier);
  assert.equal(release.snapshotId, 'snp_0001');
  assert.equal(release.releasedAt, '2026-07-16T12:00:00.000Z');
  assert.equal(submission.status, 'quarantined');
});

test('convenience builders accept overrides', () => {
  assert.equal(buildEntity({ id: 'ent_custom', name: 'Custom' }).name, 'Custom');
  assert.equal(buildSource({ id: 'src_custom' }).id, 'src_custom');
  assert.equal(buildClaim({ confidence: 0.2 }).confidence, 0.2);
  assert.equal(buildEvidence({ excerpt: 'note' }).excerpt, 'note');
  assert.equal(buildPublicationRelease({ status: 'draft' }).releasedAt, null);
  assert.equal(buildSubmission({ kind: 'contribution' }).kind, 'contribution');
});

test('steppingClock yields distinct reproducible timestamps for builders', () => {
  const clock = steppingClock('2026-01-01T00:00:00.000Z', 60_000);
  const first = new EntityBuilder({ clock }).build();
  const second = new EntityBuilder({ clock }).build();
  assert.equal(first.createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(second.createdAt, '2026-01-01T00:01:00.000Z');
});
