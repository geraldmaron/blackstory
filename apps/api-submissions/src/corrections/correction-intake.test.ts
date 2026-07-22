/**
 * Correction submission body validation/shaping tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCorrectionSubmission } from './correction-intake.ts';

const VALID_INPUT = {
  targetType: 'entity',
  targetRecordId: 'record-123',
  category: 'factual_error',
  statement: 'The public archive states an incorrect opening year for this location.',
  sourceUrl: 'https://archive.example.org/records/1954',
  privacyConsent: true,
  contact: 'private@example.org',
} as const;

test('accepts a well-formed submission and shapes it into a quarantine SubmissionInput', () => {
  const result = validateCorrectionSubmission(VALID_INPUT);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.payload.kind, 'correction');
  assert.equal(result.payload.targetRecordId, 'record-123');
  assert.deepEqual(result.payload.sourceUrls, ['https://archive.example.org/records/1954']);
  assert.equal(result.payload.submitterContact, 'private@example.org');
  assert.match(result.payload.statement, /The public archive states an incorrect opening year/);
  assert.equal(result.metadata.classificationDispute, false);
});

test('omits submitterContact when contact is absent', () => {
  const { contact: _contact, ...rest } = VALID_INPUT;
  const result = validateCorrectionSubmission(rest);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal('submitterContact' in result.payload, false);
});

test('flags classificationDispute metadata for that category', () => {
  const result = validateCorrectionSubmission({ ...VALID_INPUT, category: 'classification_dispute' });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.metadata.classificationDispute, true);
});

test('rejects an unknown targetType/category rather than passing it through', () => {
  const result = validateCorrectionSubmission({ ...VALID_INPUT, targetType: 'admin-console' });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.issues.some((issue) => issue.field === 'targetType'));
});

test('rejects a too-short statement', () => {
  const result = validateCorrectionSubmission({ ...VALID_INPUT, statement: 'too short' });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.issues.some((issue) => issue.field === 'statement'));
});

test('rejects missing privacy consent and missing source URL together', () => {
  const result = validateCorrectionSubmission({
    ...VALID_INPUT,
    privacyConsent: false,
    sourceUrl: '',
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  const fields = result.issues.map((issue) => issue.field);
  assert.ok(fields.includes('privacyConsent'));
  assert.ok(fields.includes('sourceUrl'));
});

test('ADVERSARIAL: an oversized statement/contact is rejected before reaching the quarantine service', () => {
  const result = validateCorrectionSubmission({
    ...VALID_INPUT,
    statement: 'x'.repeat(4_001),
    contact: 'y'.repeat(321),
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  const fields = result.issues.map((issue) => issue.field);
  assert.ok(fields.includes('statement'));
  assert.ok(fields.includes('contact'));
});

test('ADVERSARIAL: non-string / wrong-type fields are rejected defensively, not coerced', () => {
  const result = validateCorrectionSubmission({
    targetType: { evil: true },
    targetRecordId: 12345,
    category: ['factual_error'],
    statement: null,
    sourceUrl: undefined,
    privacyConsent: 'true',
    contact: 9,
  } as never);
  assert.equal(result.valid, false);
});
