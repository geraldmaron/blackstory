/**
 * Unit tests for BB-055 correction form shaping and validation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateAbuseReportSubmission,
  validateAppealSubmission,
  validateCorrectionSubmission,
} from './correction-intake';

test('accepts a structured correction and maps it to kind correction', () => {
  const result = validateCorrectionSubmission({
    targetType: 'entity',
    targetRecordId: 'entity-rosewood-school',
    category: 'factual_error',
    statement: 'The opening year on the public record should be 1924, not 1927, per county archives.',
    sourceUrl: 'https://example.org/archives/rosewood',
    privacyConsent: true,
  });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.payload.kind, 'correction');
  assert.equal(result.payload.targetRecordId, 'entity-rosewood-school');
  assert.deepEqual(result.payload.sourceUrls, ['https://example.org/archives/rosewood']);
});

test('rejects corrections without privacy consent or source URL', () => {
  const missingConsent = validateCorrectionSubmission({
    targetType: 'claim',
    targetRecordId: 'claim-1',
    category: 'missing_context',
    statement: 'The record omits the school district consolidation context entirely.',
    sourceUrl: 'https://example.org/context',
    privacyConsent: false,
  });
  assert.equal(missingConsent.valid, false);

  const missingUrl = validateCorrectionSubmission({
    targetType: 'source',
    targetRecordId: 'source-1',
    category: 'source_issue',
    statement: 'The cited newspaper link is broken and points to the wrong edition.',
    privacyConsent: true,
  });
  assert.equal(missingUrl.valid, false);
});

test('marks classification disputes for appeal eligibility metadata', () => {
  const result = validateCorrectionSubmission({
    targetType: 'entity',
    targetRecordId: 'entity-1',
    category: 'classification_dispute',
    statement: 'This institution should be classified as a mutual aid society, not a fraternal order.',
    sourceUrl: 'https://example.org/classification',
    privacyConsent: true,
  });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.metadata.classificationDispute, true);
});

test('validates appeal submissions with supporting HTTPS links', () => {
  const result = validateAppealSubmission({
    receiptCode: 'BB-COR-0123456789ABCDEF',
    statement: 'The reviewer closed this in error — the county record supports my correction.',
    sourceUrl: 'https://example.org/county-record',
    privacyConsent: true,
  });
  assert.equal(result.valid, true);
});

test('accepts abuse reports without a related receipt code', () => {
  const result = validateAbuseReportSubmission({
    statement: 'Someone is flooding duplicate corrections about the same entity from many accounts.',
    privacyConsent: true,
  });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.payload.kind, 'abuse_report');
});
