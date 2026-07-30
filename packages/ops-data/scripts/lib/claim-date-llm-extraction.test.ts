/**
 * Unit tests for Stage 2 claim-date LLM extraction helpers and mock provider.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildClaimDateExtractionRequest,
  createMockClaimDateExtractionProvider,
  mockExtractClaimDateFromProse,
  validateClaimDateExtractionResponse,
} from './claim-date-llm-extraction.ts';

const SUBJECT = {
  claimId: 'clm_test',
  claimVersionId: 'cv_test',
  entityId: 'ent_test',
  predicate: 'founded_year',
  object: 'The mutual aid society was founded in 1905 in Philadelphia.',
} as const;

test('mockExtractClaimDateFromProse returns anchored year extraction', () => {
  const extraction = mockExtractClaimDateFromProse(SUBJECT);
  assert.ok(extraction);
  assert.equal(extraction.edtf, '1905');
  assert.equal(extraction.property, 'start');
  assert.equal(extraction.verbatimQuote, '1905');
});

test('validateClaimDateExtractionResponse accepts mock provider output', async () => {
  const provider = createMockClaimDateExtractionProvider();
  const request = buildClaimDateExtractionRequest(SUBJECT);
  const completion = await provider.complete(request);
  const attempt = validateClaimDateExtractionResponse(SUBJECT, completion.content);
  assert.equal(attempt.validation.ok, true);
});

test('validateClaimDateExtractionResponse rejects malformed JSON', () => {
  const attempt = validateClaimDateExtractionResponse(SUBJECT, 'not-json');
  assert.equal(attempt.validation.ok, false);
});
