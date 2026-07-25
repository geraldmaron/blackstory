import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateCasePromotionGate,
  validateCanonicalPromotionRecord,
  type CanonicalPromotionRecord,
} from './case-promotion.ts';

test('evaluateCasePromotionGate refuses self-approval', () => {
  const result = evaluateCasePromotionGate({
    caseState: 'substantial_enrichment',
    proposerId: 'operator-a',
    approverId: 'operator-a',
  });
  assert.equal(result.approved, false);
  assert.ok(result.reasons.includes('proposer_approver_conflict'));
});

test('evaluateCasePromotionGate refuses a case that is not substantial_enrichment', () => {
  const result = evaluateCasePromotionGate({
    caseState: 'relevance_confirmed',
    proposerId: 'operator-a',
    approverId: 'operator-b',
  });
  assert.equal(result.approved, false);
  assert.ok(result.reasons.includes('case_not_ready'));
});

test('evaluateCasePromotionGate approves a ready case with distinct proposer/approver', () => {
  const result = evaluateCasePromotionGate({
    caseState: 'substantial_enrichment',
    proposerId: 'operator-a',
    approverId: 'operator-b',
  });
  assert.deepEqual(result, { approved: true, reasons: [] });
});

test('evaluateCasePromotionGate refuses blank identities', () => {
  const result = evaluateCasePromotionGate({
    caseState: 'substantial_enrichment',
    proposerId: '',
    approverId: 'operator-b',
  });
  assert.ok(result.reasons.includes('missing_identity'));
});

const VALID_RECORD: CanonicalPromotionRecord = {
  entityId: 'ent_test_1',
  displayName: 'Test Hall',
  summary:
    'Built in 1889, Test Hall served as a lodge, school, house of worship, and social hall for the local African American community for decades.',
  jurisdiction: 'Testville, Maryland',
  topicIds: ['reconstruction'],
  topicTags: ['mutual-aid'],
  eraBuckets: ['1880s', '2000s'],
  location: { lat: 39.06, lng: -76.87, label: 'Test Hall', precision: 'block', matchMethod: 'test' },
  sources: [
    {
      title: 'Source A',
      url: 'https://a.example.gov/test-hall',
      excerpt: 'A' .repeat(80),
      fitness: 'authoritative',
    },
    {
      title: 'Source B',
      url: 'https://b.example.org/test-hall',
      excerpt: 'B'.repeat(80),
      fitness: 'strong',
    },
  ],
};

test('validateCanonicalPromotionRecord accepts a well-formed record', () => {
  const result = validateCanonicalPromotionRecord(VALID_RECORD);
  assert.deepEqual(result, { valid: true, reasons: [] });
});

test('validateCanonicalPromotionRecord rejects a too-short summary', () => {
  const result = validateCanonicalPromotionRecord({ ...VALID_RECORD, summary: 'Too short.' });
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('name_or_summary_invalid'));
});

test('validateCanonicalPromotionRecord rejects fewer than two independent source hosts', () => {
  const result = validateCanonicalPromotionRecord({
    ...VALID_RECORD,
    sources: [VALID_RECORD.sources[0]!],
  });
  assert.ok(result.reasons.includes('insufficient_independent_source_hosts'));
});

test('validateCanonicalPromotionRecord rejects two sources from the same host', () => {
  const result = validateCanonicalPromotionRecord({
    ...VALID_RECORD,
    sources: [
      VALID_RECORD.sources[0]!,
      { ...VALID_RECORD.sources[0]!, title: 'Source A2', excerpt: 'C'.repeat(80) },
    ],
  });
  assert.ok(result.reasons.includes('insufficient_independent_source_hosts'));
});

test('validateCanonicalPromotionRecord rejects a non-https source', () => {
  const result = validateCanonicalPromotionRecord({
    ...VALID_RECORD,
    sources: [{ ...VALID_RECORD.sources[0]!, url: 'http://a.example.gov/test-hall' }, VALID_RECORD.sources[1]!],
  });
  assert.ok(result.reasons.includes('invalid_source'));
});

test('validateCanonicalPromotionRecord rejects a too-short excerpt', () => {
  const result = validateCanonicalPromotionRecord({
    ...VALID_RECORD,
    sources: [{ ...VALID_RECORD.sources[0]!, excerpt: 'short' }, VALID_RECORD.sources[1]!],
  });
  assert.ok(result.reasons.includes('invalid_source'));
});

test('validateCanonicalPromotionRecord rejects coordinates outside US bounds', () => {
  const result = validateCanonicalPromotionRecord({
    ...VALID_RECORD,
    location: { ...VALID_RECORD.location, lat: 5, lng: 5 },
  });
  assert.ok(result.reasons.includes('coordinates_outside_us_bounds'));
});

test('validateCanonicalPromotionRecord rejects a malformed decade bucket', () => {
  const result = validateCanonicalPromotionRecord({ ...VALID_RECORD, eraBuckets: ['1885'] });
  assert.ok(result.reasons.includes('invalid_decade_bucket'));
});

test('validateCanonicalPromotionRecord ignores location-only sources for the independence check', () => {
  const result = validateCanonicalPromotionRecord({
    ...VALID_RECORD,
    sources: [
      VALID_RECORD.sources[0]!,
      VALID_RECORD.sources[1]!,
      { title: 'Map', url: 'https://maps.example.net/pin', excerpt: 'D'.repeat(80), fitness: 'weak', locationOnly: true },
    ],
  });
  assert.deepEqual(result, { valid: true, reasons: [] });
});
