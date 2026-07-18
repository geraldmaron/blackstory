/**
 * Verifies quarantine-only API intake, security prerequisites, moderation, and blocking.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfaceCapabilityError } from '@repo/config';
import {
  createInMemorySubmissionQuarantineRepository,
  createSubmissionQuarantineService,
} from './quarantine.ts';

const PAYLOAD = {
  kind: 'correction',
  title: 'Correct the listed opening year',
  statement: 'The public archive states that this location opened during 1954.',
  sourceUrls: ['https://archive.example.org/records/1954'],
  targetRecordId: 'record-123',
  submitterContact: 'private@example.org',
} as const;

const ALLOWED_SECURITY = {
  appCheckAllowed: true,
  quotaAllowed: true,
  submitterToken: 'subject-hash-a',
  networkToken: 'network-hash-a',
} as const;

test('requires App Check and quota guards before quarantine storage', () => {
  const repository = createInMemorySubmissionQuarantineRepository();
  const service = createSubmissionQuarantineService({
    repository,
    privacyPepper: 'test-only-pepper',
  });

  const appCheckDenied = service.intake({
    payload: PAYLOAD,
    security: { ...ALLOWED_SECURITY, appCheckAllowed: false },
  });
  const quotaDenied = service.intake({
    payload: PAYLOAD,
    security: { ...ALLOWED_SECURITY, quotaAllowed: false },
  });

  assert.deepEqual(appCheckDenied, {
    accepted: false,
    status: 403,
    reason: 'app_check_denied',
  });
  assert.deepEqual(quotaDenied, {
    accepted: false,
    status: 429,
    reason: 'quota_denied',
  });
  assert.equal(repository.list().length, 0);
});

test('stores only restricted quarantine records and never exposes contact in response', () => {
  const repository = createInMemorySubmissionQuarantineRepository();
  let id = 0;
  const service = createSubmissionQuarantineService({
    repository,
    privacyPepper: 'test-only-pepper',
    now: () => Date.parse('2026-07-17T01:00:00.000Z'),
    idFactory: () => `audit-${++id}`,
  });

  const response = service.intake({ payload: PAYLOAD, security: ALLOWED_SECURITY });
  assert.equal(response.accepted, true);
  assert.equal(JSON.stringify(response).includes(PAYLOAD.submitterContact), false);
  if (!response.accepted) return;

  const stored = repository.get(response.submissionId);
  assert.ok(stored);
  assert.equal(stored.destination, 'submission_quarantine');
  assert.equal(stored.canonicalWriteAllowed, false);
  assert.equal(stored.privacy.accessClass, 'restricted_submission');
  assert.equal(repository.auditFor(stored.id)[0]?.originalContentHash, stored.original.contentHash);
  assert.throws(() => service.assertPublicationUnavailable(), SurfaceCapabilityError);
  assert.equal('publish' in service, false);
});

test('preserves the immutable original across separate moderation-state transitions', () => {
  const repository = createInMemorySubmissionQuarantineRepository();
  const service = createSubmissionQuarantineService({
    repository,
    privacyPepper: 'test-only-pepper',
  });
  const response = service.intake({ payload: PAYLOAD, security: ALLOWED_SECURITY });
  assert.equal(response.accepted, true);
  if (!response.accepted) return;

  const before = repository.get(response.submissionId);
  assert.ok(before);
  const after = service.moderate(
    { actorId: 'moderator-1', role: 'moderator' },
    response.submissionId,
    'resolved',
    'review_complete',
  );

  assert.equal(after.inboxState, 'accepted');
  assert.equal(after.moderationState, 'resolved');
  assert.strictEqual(after.original, before.original);
  assert.equal(after.original.contentHash, before.original.contentHash);
  const events = repository.auditFor(response.submissionId);
  assert.deepEqual(
    events.map((event) => event.action),
    ['intake_accepted', 'moderation_transition'],
  );
});

test('moderator blocks abusive subject and abuse reports remain quarantined', () => {
  const repository = createInMemorySubmissionQuarantineRepository();
  const service = createSubmissionQuarantineService({
    repository,
    privacyPepper: 'test-only-pepper',
  });
  service.blockSubject(
    { actorId: 'admin-1', role: 'admin' },
    ALLOWED_SECURITY.submitterToken,
    'confirmed_abuse',
  );

  const blocked = service.intake({ payload: PAYLOAD, security: ALLOWED_SECURITY });
  assert.deepEqual(blocked, {
    accepted: false,
    status: 403,
    reason: 'subject_blocked',
  });

  const abuseReport = service.reportAbuse(
    { ...ALLOWED_SECURITY, submitterToken: 'reporter-hash' },
    {
      title: 'Report coordinated submission abuse',
      statement: 'Several submissions appear to contain the same misleading source claims.',
      sourceUrls: ['https://archive.example.org/suspicious-campaign'],
      targetRecordId: 'record-123',
    },
  );
  assert.equal(abuseReport.accepted, true);
  if (!abuseReport.accepted) return;
  assert.equal(repository.get(abuseReport.submissionId)?.normalized.kind, 'abuse_report');
});

test('malformed and link-abuse content is rejected before repository append', () => {
  const repository = createInMemorySubmissionQuarantineRepository();
  const service = createSubmissionQuarantineService({
    repository,
    privacyPepper: 'test-only-pepper',
  });
  const result = service.intake({
    payload: {
      ...PAYLOAD,
      statement: 'Too short https://a.example https://b.example',
      sourceUrls: Array.from({ length: 20 }, (_, index) => `http://bad.example/${index}`),
    },
    security: ALLOWED_SECURITY,
  });
  assert.equal(result.accepted, false);
  if (result.accepted) return;
  assert.equal(result.reason, 'validation_failed');
  assert.equal(repository.list().length, 0);
});
