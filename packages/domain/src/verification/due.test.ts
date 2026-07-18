import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRecordDue, deriveVerificationStatus, selectDueVerificationStates } from './due.js';
import type { VerificationState } from './state.js';

test('isRecordDue treats a never-scheduled record as due', () => {
  assert.equal(isRecordDue(undefined, '2026-07-18T00:00:00.000Z'), true);
});

test('isRecordDue compares now against nextReviewAt at monthly/quarterly/annual cadences', () => {
  // Monthly cadence, still within the window.
  assert.equal(isRecordDue('2026-08-01T00:00:00.000Z', '2026-07-18T00:00:00.000Z'), false);
  // Monthly cadence, exactly at the boundary.
  assert.equal(isRecordDue('2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z'), true);
  // Quarterly cadence, past due.
  assert.equal(isRecordDue('2026-04-01T00:00:00.000Z', '2026-07-18T00:00:00.000Z'), true);
  // Annual cadence, not yet due.
  assert.equal(isRecordDue('2027-01-01T00:00:00.000Z', '2026-07-18T00:00:00.000Z'), false);
});

test('isRecordDue rejects invalid ISO input', () => {
  assert.throws(() => isRecordDue('not-a-date', '2026-07-18T00:00:00.000Z'));
  assert.throws(() => isRecordDue('2026-07-18T00:00:00.000Z', 'not-a-date'));
});

test('deriveVerificationStatus: unverified when never scheduled or verified', () => {
  assert.equal(
    deriveVerificationStatus({ now: '2026-07-18T00:00:00.000Z' }),
    'unverified',
  );
});

test('deriveVerificationStatus: current before nextReviewAt', () => {
  assert.equal(
    deriveVerificationStatus({
      nextReviewAt: '2026-08-01T00:00:00.000Z',
      now: '2026-07-18T00:00:00.000Z',
    }),
    'current',
  );
});

test('deriveVerificationStatus: due just after nextReviewAt, within grace window', () => {
  assert.equal(
    deriveVerificationStatus({
      nextReviewAt: '2026-07-01T00:00:00.000Z',
      now: '2026-07-05T00:00:00.000Z',
    }),
    'due',
  );
});

test('deriveVerificationStatus: overdue once past the grace window', () => {
  assert.equal(
    deriveVerificationStatus({
      nextReviewAt: '2026-06-01T00:00:00.000Z',
      now: '2026-07-18T00:00:00.000Z',
    }),
    'overdue',
  );
});

test('deriveVerificationStatus honors a caller-supplied overdueGraceMs', () => {
  const oneDayMs = 24 * 60 * 60 * 1000;
  assert.equal(
    deriveVerificationStatus({
      nextReviewAt: '2026-07-01T00:00:00.000Z',
      now: '2026-07-05T00:00:00.000Z',
      overdueGraceMs: oneDayMs,
    }),
    'overdue',
  );
});

function state(overrides: Partial<VerificationState>): VerificationState {
  return {
    subjectType: 'claim',
    subjectId: 'claim-1',
    verificationStatus: 'unverified',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('selectDueVerificationStates filters an in-memory provider to due/never-scheduled subjects', () => {
  const states: readonly VerificationState[] = [
    state({ subjectId: 'claim-current', nextReviewAt: '2026-08-01T00:00:00.000Z' }),
    state({ subjectId: 'claim-due', nextReviewAt: '2026-07-01T00:00:00.000Z' }),
    state({ subjectId: 'claim-never-scheduled' }),
  ];
  const due = selectDueVerificationStates(() => states, '2026-07-18T00:00:00.000Z');
  assert.deepEqual(
    due.map((s) => s.subjectId).sort(),
    ['claim-due', 'claim-never-scheduled'],
  );
});
