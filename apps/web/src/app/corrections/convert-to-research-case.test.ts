/**
 * Unit tests for admin research-case conversion hook.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuarantinedSubmission } from '@black-book/security';
import { prepareCorrectionResearchCaseConversion } from './convert-to-research-case';
import { buildStoredCorrection, createCorrectionSubmissionStore } from './store';

const PEPPER = 'test-pepper';

function seedCorrection(moderationState?: 'coordinated_campaign') {
  const result = createQuarantinedSubmission(
    {
      kind: 'correction',
      title: 'Correction: Factual error',
      statement: 'The published opening year should be corrected to 1924 based on county records.',
      sourceUrls: ['https://example.org/archives'],
      targetRecordId: 'entity-1',
    },
    { privacyPepper: PEPPER, receivedAtMs: 0 },
  );
  assert.equal(result.accepted, true);
  if (!result.accepted) return undefined;
  const record =
    moderationState !== undefined
      ? { ...result.record, moderationState }
      : result.record;
  const store = createCorrectionSubmissionStore();
  const stored = buildStoredCorrection({
    record,
    pepper: PEPPER,
    targetType: 'entity',
    category: 'factual_error',
    classificationDispute: false,
  });
  store.save(stored);
  return { store, stored };
}

test('converts a quarantined correction into a draft research case for moderators', () => {
  const seeded = seedCorrection();
  assert.ok(seeded);
  const outcome = prepareCorrectionResearchCaseConversion(seeded.stored.record.id, seeded.store, {
    actor: { actorId: 'moderator-1', role: 'moderator' },
    privacyPepper: PEPPER,
    now: '2026-07-17T12:00:00.000Z',
  });
  assert.equal('error' in outcome, false);
  if ('error' in outcome) return;
  assert.equal(outcome.researchCase.state, 'candidate');
  assert.equal(outcome.researchCase.candidateId, seeded.stored.record.id);
});

test('blocks conversion for coordinated campaign submissions', () => {
  const seeded = seedCorrection('coordinated_campaign');
  assert.ok(seeded);
  const outcome = prepareCorrectionResearchCaseConversion(seeded.stored.record.id, seeded.store, {
    actor: { actorId: 'admin-1', role: 'admin' },
    privacyPepper: PEPPER,
  });
  assert.deepEqual(outcome, {
    error: 'not_eligible',
    reason: 'Coordinated campaign submissions require manual triage before research conversion.',
  });
});
