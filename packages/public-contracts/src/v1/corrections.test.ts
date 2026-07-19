import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from '../testing/load-fixture.js';
import { correctionStatusV1Schema, correctionSubmissionRequestV1Schema } from './corrections.js';

test('round-trips a valid correction submission request', () => {
  const fixture = loadFixture<Record<string, unknown>>('correction-submission.v1.current.json');
  assert.deepEqual(correctionSubmissionRequestV1Schema.parse(fixture), fixture);
});

test('requires privacyConsent to be literally true (never omitted, never false-and-accepted)', () => {
  const fixture = loadFixture<Record<string, unknown>>('correction-submission.v1.current.json');
  assert.throws(() => correctionSubmissionRequestV1Schema.parse({ ...fixture, privacyConsent: false }));
  const { privacyConsent: _privacyConsent, ...withoutConsent } = fixture;
  assert.throws(() => correctionSubmissionRequestV1Schema.parse(withoutConsent));
});

test('rejects a statement shorter than the minimum length (adversarial: empty/near-empty submission)', () => {
  const fixture = loadFixture<Record<string, unknown>>('correction-submission.v1.current.json');
  assert.throws(() => correctionSubmissionRequestV1Schema.parse({ ...fixture, statement: 'too short' }));
});

test('rejects an unknown category (adversarial: unknown enum value)', () => {
  const fixture = loadFixture<Record<string, unknown>>('correction-submission.v1.current.json');
  assert.throws(() => correctionSubmissionRequestV1Schema.parse({ ...fixture, category: 'something_else' }));
});

test('drops moderation-internal fields (spamScore/campaignId/duplicateOf/moderatorNotes) on parse (sensitive-field negative snapshot)', () => {
  const fixture = loadFixture<Record<string, unknown>>('correction-status.v1.sensitive-leak.json');
  const parsed = correctionStatusV1Schema.parse(fixture);
  assert.equal(parsed.receiptCode, fixture.receiptCode);
  for (const forbiddenKey of ['spamScore', 'campaignId', 'duplicateOfReceiptCode', 'moderatorNotes']) {
    assert.ok(!(forbiddenKey in parsed), `${forbiddenKey} must not survive parsing`);
  }
});
