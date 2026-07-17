/**
 * Acceptance tests for BB-032 promotion stages, evidence controls, approvals, and previews.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advancePromotionRecord,
  buildReleaseClaimPreview,
  collapseSupportingEvidence,
  detectDuplicateAndCoordinatedEvidence,
  evaluatePromotionGate,
  routePromotionReview,
  type PromotionClaim,
  type PromotionEvidence,
} from './promotion/index.js';

const NOW = '2026-07-17T04:00:00.000Z';

function evidence(
  id: string,
  lineageRootId: string,
  overrides: Partial<PromotionEvidence> = {},
): PromotionEvidence {
  return {
    evidenceId: id,
    sourceId: `source-${id}`,
    sourceOrganizationId: `organization-${id}`,
    lineageRootId,
    independenceGroupId: `independent-${lineageRootId}`,
    role: 'supporting',
    credible: true,
    reputation: 'authoritative',
    quality: 0.9,
    contentFingerprint: `fingerprint-${id}`,
    ...overrides,
  };
}

function claim(overrides: Partial<PromotionClaim> = {}): PromotionClaim {
  return {
    claimId: 'claim-1',
    claimVersionId: 'claim-1-v1',
    entityId: 'entity-1',
    claimClass: 'standard',
    confidence: 0.9,
    proposerId: 'researcher-1',
    evidence: [evidence('one', 'lineage-one'), evidence('two', 'lineage-two')],
    contradictionSearch: {
      completed: true,
      searchedAt: NOW,
      querySummary: 'Searched registered sources for contradictory values.',
      reviewerId: 'researcher-2',
    },
    ...overrides,
  };
}

test('pipeline permits only the explicit ordered promotion stages', () => {
  const initial = {
    id: 'promotion-1',
    stage: 'submission_discovery' as const,
    submissionOrDiscoveryId: 'submission-1',
    updatedAt: NOW,
  };
  const research = advancePromotionRecord(initial, 'research_case', {
    now: NOW,
    researchCaseId: 'research-1',
  });
  const proposed = advancePromotionRecord(research, 'proposed_claim', {
    now: NOW,
    claimId: 'claim-1',
  });
  const accepted = advancePromotionRecord(proposed, 'accepted_claim', { now: NOW });
  const candidate = advancePromotionRecord(accepted, 'publication_candidate', {
    now: NOW,
    releaseCandidateId: 'candidate-1',
  });
  const released = advancePromotionRecord(candidate, 'release', {
    now: NOW,
    releaseId: 'release-1',
  });

  assert.equal(released.stage, 'release');
  assert.throws(
    () =>
      advancePromotionRecord(initial, 'accepted_claim', {
        now: NOW,
        claimId: 'claim-1',
      }),
    /cannot transition/,
  );
});

test('submission volume and copied pages from one lineage count once', () => {
  const copies = Array.from({ length: 20 }, (_, index) =>
    evidence(`copy-${index}`, 'same-original', {
      sourceId: `mirror-${index}`,
      sourceOrganizationId: `mirror-org-${index}`,
      independenceGroupId: `mirror-${index}`,
    }),
  );
  const result = evaluatePromotionGate({
    claim: claim({ confidence: 0.99, evidence: copies }),
    approverId: 'approver-1',
  });

  assert.equal(result.rawSupportingEvidenceCount, 20);
  assert.equal(result.independentLineageCount, 1);
  assert.equal(result.approved, false);
  assert.ok(result.reasons.includes('insufficient_independent_lineages'));
});

test('coordinated sources collapse to one independent contribution', () => {
  const coordinated = [
    evidence('campaign-a', 'lineage-a', {
      independenceGroupId: 'publisher-a',
      coordinatedGroupId: 'campaign-1',
    }),
    evidence('campaign-b', 'lineage-b', {
      independenceGroupId: 'publisher-b',
      coordinatedGroupId: 'campaign-1',
    }),
  ];
  const detection = detectDuplicateAndCoordinatedEvidence(coordinated);

  assert.deepEqual(detection.coordinatedEvidenceIds, ['campaign-a', 'campaign-b']);
  assert.equal(collapseSupportingEvidence(coordinated).length, 1);
});

test('duplicate content is detected independently of its URL or source id', () => {
  const duplicates = [
    evidence('original', 'lineage-a', { contentFingerprint: 'same-content' }),
    evidence('copy', 'lineage-b', { contentFingerprint: 'same-content' }),
  ];

  assert.deepEqual(detectDuplicateAndCoordinatedEvidence(duplicates).duplicateEvidenceIds, ['copy']);
  assert.equal(collapseSupportingEvidence(duplicates).length, 1);
});

test('a source cannot corroborate a claim about itself through repetition', () => {
  const selfEvidence = [
    evidence('self-a', 'lineage-a', { sourceSubjectEntityIds: ['entity-1'] }),
    evidence('self-b', 'lineage-b', { sourceSubjectEntityIds: ['entity-1'] }),
  ];
  const result = evaluatePromotionGate({
    claim: claim({ evidence: selfEvidence }),
    approverId: 'approver-1',
  });

  assert.equal(result.approved, false);
  assert.ok(result.reasons.includes('self_approval_by_repetition'));
});

test('high-impact claims require more independent and strong evidence', () => {
  const result = evaluatePromotionGate({
    claim: claim({
      claimClass: 'high_impact',
      confidence: 0.9,
      evidence: [
        evidence('one', 'one', { reputation: 'authoritative' }),
        evidence('two', 'two', { reputation: 'limited' }),
      ],
    }),
    approverId: 'approver-1',
  });

  assert.equal(result.queue, 'critical');
  assert.ok(result.reasons.includes('insufficient_independent_lineages'));
  assert.ok(result.reasons.includes('insufficient_strong_evidence'));
});

test('approval is deterministic and separates proposer from approver', () => {
  const conflict = evaluatePromotionGate({
    claim: claim(),
    approverId: 'researcher-1',
  });
  const approved = evaluatePromotionGate({
    claim: claim(),
    approverId: 'approver-1',
  });

  assert.equal(conflict.approved, false);
  assert.ok(conflict.reasons.includes('proposer_approver_conflict'));
  assert.equal(approved.approved, true);
  assert.equal(approved.deterministic, true);
  assert.deepEqual(
    evaluatePromotionGate({ claim: claim(), approverId: 'approver-1' }),
    approved,
  );
});

test('contradiction search and unresolved credible contradictions fail closed', () => {
  const incomplete = evaluatePromotionGate({
    claim: claim({ contradictionSearch: { completed: false } }),
    approverId: 'approver-1',
  });
  const contradicted = evaluatePromotionGate({
    claim: claim({
      evidence: [
        ...claim().evidence,
        evidence('contra', 'lineage-contra', { role: 'contradicting' }),
      ],
    }),
    approverId: 'approver-1',
  });

  assert.ok(incomplete.reasons.includes('contradiction_search_incomplete'));
  assert.ok(contradicted.reasons.includes('credible_contradiction_unresolved'));
});

test('review queues combine impact with confidence', () => {
  assert.equal(routePromotionReview('high_impact', 0.99), 'critical');
  assert.equal(routePromotionReview('standard', 0.69), 'critical');
  assert.equal(routePromotionReview('standard', 0.75), 'elevated');
  assert.equal(routePromotionReview('standard', 0.9), 'standard');
});

test('release preview reports added, changed, and removed claims', () => {
  const base = {
    entityId: 'entity-1',
    predicate: 'status',
    proceduralStatus: 'documented',
  };
  const preview = buildReleaseClaimPreview(
    [
      { ...base, claimId: 'removed', claimVersionId: 'v1', object: 'old' },
      { ...base, claimId: 'changed', claimVersionId: 'v1', object: 'before' },
      { ...base, claimId: 'same', claimVersionId: 'v1', object: 'same' },
    ],
    [
      { ...base, claimId: 'added', claimVersionId: 'v1', object: 'new' },
      { ...base, claimId: 'changed', claimVersionId: 'v2', object: 'after' },
      { ...base, claimId: 'same', claimVersionId: 'v1', object: 'same' },
    ],
  );

  assert.deepEqual(preview.counts, { added: 1, changed: 1, removed: 1, unchanged: 1 });
  assert.equal(preview.added[0]?.claimId, 'added');
  assert.equal(preview.changed[0]?.before.object, 'before');
  assert.equal(preview.changed[0]?.after.object, 'after');
  assert.equal(preview.removed[0]?.claimId, 'removed');
});
