import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertCandidateUpdateValid,
  createCandidateUpdateFromVerificationRun,
} from './candidate-update.js';
import { resolveVerificationPolicy, type VerificationPolicy } from './policy.js';
import { isRecordDue } from './due.js';
import type { CanonicalClaim } from '../claims/claim.js';

test('createCandidateUpdateFromVerificationRun proposes a change when observed differs from previous', () => {
  const candidate = createCandidateUpdateFromVerificationRun({
    id: 'cand-1',
    subjectType: 'claim',
    subjectId: 'claim-1',
    predicate: 'vital_status',
    previousValue: 'living',
    observedValue: 'deceased',
    verificationRunId: 'run-1',
    now: '2026-07-18T00:00:00.000Z',
  });
  assert.equal(candidate.status, 'pending_review');
  assert.equal(candidate.proposedValue, 'deceased');
  assert.equal(candidate.previousValue, 'living');
  assertCandidateUpdateValid(candidate);
});

test('createCandidateUpdateFromVerificationRun records a confirming run without a proposed value', () => {
  const candidate = createCandidateUpdateFromVerificationRun({
    id: 'cand-2',
    subjectType: 'claim',
    subjectId: 'claim-1',
    predicate: 'vital_status',
    previousValue: 'living',
    observedValue: 'living',
    verificationRunId: 'run-2',
    now: '2026-07-18T00:00:00.000Z',
  });
  assert.equal(candidate.status, 'pending_review');
  assert.equal('proposedValue' in candidate, false);
});

test('assertCandidateUpdateValid rejects missing ids and unknown status', () => {
  const base = createCandidateUpdateFromVerificationRun({
    id: 'cand-3',
    subjectType: 'claim',
    subjectId: 'claim-1',
    verificationRunId: 'run-3',
    now: '2026-07-18T00:00:00.000Z',
  });
  assert.throws(() => assertCandidateUpdateValid({ ...base, id: '' }));
  assert.throws(() => assertCandidateUpdateValid({ ...base, status: 'weird' as never }));
});

/**
 * End-to-end: policy -> due-record check -> candidate update creation -> the original claim is
 * NEVER touched. This is the critical invariant the bead calls out: a refresh must never
 * directly overwrite public truth.
 *
 * The claim object is deep-frozen. If `createCandidateUpdateFromVerificationRun` (or anything
 * else in this flow) ever attempted to write to it, that write would throw a TypeError under
 * strict mode (all ESM modules run strict) rather than silently succeeding — this test would
 * fail loudly, not just via a stale-looking assertion.
 */
test('verification flow never mutates the claim it is checking, only produces a CandidateUpdate', () => {
  const originalClaim: CanonicalClaim = Object.freeze({
    id: 'claim-42',
    entityId: 'entity-1',
    predicate: 'vital_status',
    currentVersionId: 'version-1',
    claimClass: 'standard',
    workflowStatus: 'accepted',
    publicationStatus: 'published',
    proceduralStatus: 'final',
    preservedValues: Object.freeze([]),
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    lastVerifiedAt: '2025-01-01T00:00:00.000Z',
    lastVerifiedVersionId: 'version-1',
  });
  const claimSnapshotBeforeRun = JSON.parse(JSON.stringify(originalClaim));

  const policy: VerificationPolicy = {
    id: 'person-vital-status-monthly',
    appliesToEntityClasses: ['person'],
    appliesToPredicates: ['vital_status'],
    volatilityClass: 'high',
    defaultReviewInterval: { unit: 'month', count: 1 },
    authoritativeSourceIds: ['source-ssdi'],
    contradictionSearchRequired: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  // 1. Policy matching.
  const resolvedPolicy = resolveVerificationPolicy([policy], {
    entityClass: 'person',
    predicate: originalClaim.predicate,
  });
  assert.equal(resolvedPolicy?.id, 'person-vital-status-monthly');

  // 2. Due-record check: this claim was last verified 2025-01-01 under a monthly cadence, so by
  // 2026-07-18 it is well past due.
  const now = '2026-07-18T00:00:00.000Z';
  assert.equal(isRecordDue(originalClaim.lastVerifiedAt, now), true);

  // 3. A verification run observes a new value for the governed predicate. Only primitive
  // fields are read off `originalClaim` here (no live reference passed through).
  const candidate = createCandidateUpdateFromVerificationRun({
    id: 'cand-e2e-1',
    subjectType: 'claim',
    subjectId: originalClaim.id,
    predicate: originalClaim.predicate,
    previousValue: 'living',
    observedValue: 'deceased',
    verificationRunId: 'run-e2e-1',
    now,
  });

  // 4. Candidate is produced, pending review; nothing was applied to public truth directly.
  assert.equal(candidate.subjectId, originalClaim.id);
  assert.equal(candidate.status, 'pending_review');
  assert.equal(candidate.proposedValue, 'deceased');

  // 5. The claim itself is byte-for-byte unchanged. Attempting to mutate the frozen object
  // would have thrown already; this confirms nothing was silently applied to it either.
  assert.deepEqual(JSON.parse(JSON.stringify(originalClaim)), claimSnapshotBeforeRun);
  assert.equal(originalClaim.workflowStatus, 'accepted');
  assert.equal(originalClaim.publicationStatus, 'published');
});
