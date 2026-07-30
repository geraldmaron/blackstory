/**
 * Stage 2 LLM claim-date extraction validator tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  edtfYearsGroundedInQuote,
  findVerbatimQuoteSpan,
  isYearBearingProseClaimObject,
  validateLlmClaimDateExtraction,
  type LlmClaimDateExtraction,
} from './claim-date-llm-validation.js';

test('isYearBearingProseClaimObject accepts prose with years and rejects clean date objects', () => {
  assert.equal(isYearBearingProseClaimObject('Founded in 1905 by community leaders'), true);
  assert.equal(isYearBearingProseClaimObject('1905'), false);
  assert.equal(isYearBearingProseClaimObject('No temporal signal here'), false);
});

test('findVerbatimQuoteSpan locates the first exact occurrence', () => {
  const object = 'The church opened in 1920 after years of planning.';
  assert.deepEqual(findVerbatimQuoteSpan(object, 'opened in 1920'), { start: 11, end: 25 });
  assert.equal(findVerbatimQuoteSpan(object, '1921'), null);
});

test('validateLlmClaimDateExtraction accepts good quote and edtf', () => {
  const claimObject = 'The congregation was organized in 1905 near the river.';
  const extraction: LlmClaimDateExtraction = {
    edtf: '1905',
    property: 'start',
    verbatimQuote: '1905',
    charOffsets: { start: 34, end: 38 },
  };
  const result = validateLlmClaimDateExtraction(claimObject, extraction);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.parsed.edtf, '1905');
    assert.equal(result.parsed.precision, 'year');
  }
});

test('validateLlmClaimDateExtraction rejects bad quote', () => {
  const claimObject = 'The congregation was organized in 1905 near the river.';
  const extraction: LlmClaimDateExtraction = {
    edtf: '1905',
    property: 'start',
    verbatimQuote: 'founded in 1906',
    charOffsets: { start: 0, end: 15 },
  };
  const result = validateLlmClaimDateExtraction(claimObject, extraction);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes('verbatim_quote')));
  }
});

test('validateLlmClaimDateExtraction rejects bad edtf', () => {
  const claimObject = 'The strike began in 1934 and lasted months.';
  const extraction: LlmClaimDateExtraction = {
    edtf: 'not-a-date',
    property: 'point_in_time',
    verbatimQuote: 'began in 1934',
    charOffsets: { start: 11, end: 24 },
  };
  const result = validateLlmClaimDateExtraction(claimObject, extraction);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes('parseEdtfLevel1')));
  }
});

test('validateLlmClaimDateExtraction rejects invented years', () => {
  const claimObject = 'Activity peaked in the 1880s before decline.';
  const extraction: LlmClaimDateExtraction = {
    edtf: '1890',
    property: 'point_in_time',
    verbatimQuote: 'peaked in the 1880s',
    charOffsets: { start: 9, end: 28 },
  };
  assert.equal(edtfYearsGroundedInQuote('1890', 'peaked in the 1880s'), false);
  const result = validateLlmClaimDateExtraction(claimObject, extraction);
  assert.equal(result.ok, false);
});
