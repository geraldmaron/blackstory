
/**
 * Verifies that lead/source/evidence proposals land in the real quarantine pipeline
 * and, for leads, open a real draft research case never a canonical or promoted record.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  prepareEvidenceAttachmentIntake,
  prepareLeadIntake,
  prepareOperatorIntake,
  prepareSourceRegistrationIntake,
  type OperatorIntakeContext,
} from './intake.ts';

const IDENTITY = {
  operatorId: 'operator-gerald',
  sessionId: 'session-2026-07-17-01',
  source: 'claude_session' as const,
};

function context(overrides: Partial<OperatorIntakeContext> = {}): OperatorIntakeContext {
  return {
    identity: IDENTITY,
    privacyPepper: 'test-only-pepper',
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
    ...overrides,
  };
}

test('submitting a lead lands a real quarantine record and opens a real draft research case', () => {
  const outcome = prepareLeadIntake(
    {
      description:
        'A 1962 newspaper photo shows the Douglass Avenue mutual-aid office with a plaque naming its founders.',
      url: 'https://archive.example.org/douglass-ave-1962',
      location: 'Douglass Avenue, unspecified city',
      era: '1960s',
    },
    context(),
  );

  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) return;
  assert.equal(outcome.proposalKind, 'lead');
  assert.equal(outcome.submission.destination, 'submission_quarantine');
  assert.equal(outcome.submission.canonicalWriteAllowed, false);
  assert.ok(outcome.researchCase, 'lead proposals open a draft research case');
  assert.equal(outcome.researchCase?.state, 'candidate');
  assert.equal(outcome.researchCase?.candidateId, outcome.submission.id);

  // Mutations only ever target submissionInbox and researchCases never a canonical/public path.
  assert.equal(outcome.mutations.length, 2);
  for (const mutation of outcome.mutations) {
    assert.ok(
      mutation.path.startsWith('submissionInbox/') || mutation.path.startsWith('researchCases/'),
      `unexpected mutation path: ${mutation.path}`,
    );
    assert.equal(mutation.operation, 'create');
  }

  // Operator identity and session id are stamped into the audit event and the submission payload.
  assert.equal(outcome.auditEvent.actor.id, IDENTITY.operatorId);
  assert.equal(outcome.auditEvent.actor.type, 'user');
  assert.equal(outcome.operator.sessionId, IDENTITY.sessionId);
  const submissionMutation = outcome.mutations.find((m) => m.path.startsWith('submissionInbox/'));
  const payload = submissionMutation?.data.payload as { operator?: unknown };
  assert.deepEqual(payload?.operator, outcome.operator);
});

test('a lead without a source URL is rejected by the real BB-029 validation, not by this package', () => {
  const outcome = prepareLeadIntake(
    { description: 'A lead with no citation at all, which should fail validation cleanly.' },
    context(),
  );
  assert.equal(outcome.accepted, false);
  if (outcome.accepted) return;
  assert.ok(outcome.rejection.issues.some((issue) => issue.reason === 'source_url_invalid'));
});

test('registering a source proposes into quarantine and never opens a draft research case', () => {
  const outcome = prepareSourceRegistrationIntake(
    {
      organizationName: 'Greenwood Historical Society',
      homepageUrl: 'https://greenwoodhistory.example.org',
      notes: 'Local archive with digitized newspaper runs 1920-1970.',
    },
    context(),
  );
  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) return;
  assert.equal(outcome.proposalKind, 'source_registration');
  assert.equal(outcome.researchCase, undefined);
  assert.equal(outcome.mutations.length, 1);
  assert.equal(outcome.auditEvent.action, 'source.registered');
});

test('attaching evidence targets the research case id and never opens a second draft case', () => {
  const outcome = prepareEvidenceAttachmentIntake(
    {
      researchCaseId: 'case-340',
      description: 'City directory entry corroborating the 1962 address.',
      sourceUrls: ['https://directories.example.org/1962/entry-88'],
    },
    context(),
  );
  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) return;
  assert.equal(outcome.researchCase, undefined);
  assert.equal(outcome.submission.normalized.targetRecordId, 'case-340');
  assert.equal(outcome.mutations.length, 1);
});

test('prepareOperatorIntake never produces a mutation touching canonical, publication, or promotion state', () => {
  const outcome = prepareOperatorIntake(
    'lead',
    {
      kind: 'contribution',
      title: 'Directly constructed submission',
      statement: 'A directly constructed contribution submission for boundary testing purposes.',
      sourceUrls: ['https://example.org/evidence'],
    },
    context(),
  );
  assert.equal(outcome.accepted, true);
  if (!outcome.accepted) return;
  const forbiddenPrefixes = [
    'canonicalEntities/',
    'canonicalClaims/',
    'publicationReleases/',
    'publicReleases/',
    'publicMeta/',
    'auditEvents/',
    'outboxMessages/',
  ];
  for (const mutation of outcome.mutations) {
    for (const prefix of forbiddenPrefixes) {
      assert.equal(mutation.path.startsWith(prefix), false, `mutation touched ${prefix}`);
    }
  }
});
