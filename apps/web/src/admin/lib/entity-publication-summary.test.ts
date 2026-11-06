/**
 * Proves the public-state summary reads untrusted JSONB defensively and labels enum values.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatEnumLabel, parseEntityPublicationSummary } from './entity-publication-summary';

const FULL_ROW = {
  name: 'Greenwood',
  claim_count: 7,
  related_count: '3',
  has_coordinates: true,
  facets: {
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    evidenceInputs: { strongestClaimLevel: 'primary', evidenceLineageKeys: ['a', 'b', 'c'] },
    jurisdictionState: 'OK',
    eraBuckets: ['1920s', '1930s'],
  },
};

test('a full row yields every published field', () => {
  assert.deepEqual(parseEntityPublicationSummary('rel_1', FULL_ROW), {
    status: 'published',
    releaseId: 'rel_1',
    publicName: 'Greenwood',
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    strongestClaimLevel: 'primary',
    evidenceSourceCount: 3,
    jurisdictionState: 'OK',
    eraBuckets: ['1920s', '1930s'],
    relatedCount: 3,
    claimCount: 7,
    hasCoordinates: true,
  });
});

test('a missing row is not published', () => {
  assert.deepEqual(parseEntityPublicationSummary('rel_1', undefined), {
    status: 'not_published',
    releaseId: 'rel_1',
  });
});

test('malformed facets fall back to null and empty rather than throwing', () => {
  const result = parseEntityPublicationSummary('rel_1', {
    name: 42,
    claim_count: 'many',
    related_count: null,
    has_coordinates: 'yes',
    facets: {
      recordMaturity: 5,
      researchCoverage: ['partial'],
      evidenceInputs: 'none',
      jurisdictionState: {},
      eraBuckets: '1920s',
    },
  });
  assert.equal(result.status, 'published');
  if (result.status !== 'published') return;
  assert.equal(result.publicName, '');
  assert.equal(result.recordMaturity, null);
  assert.equal(result.researchCoverage, null);
  assert.equal(result.strongestClaimLevel, null);
  assert.equal(result.evidenceSourceCount, 0);
  assert.equal(result.jurisdictionState, null);
  assert.deepEqual(result.eraBuckets, []);
  assert.equal(result.claimCount, 0);
  assert.equal(result.relatedCount, 0);
  assert.equal(result.hasCoordinates, false);
});

test('facets that are not an object are tolerated', () => {
  const result = parseEntityPublicationSummary('rel_1', { ...FULL_ROW, facets: null });
  assert.equal(result.status, 'published');
  if (result.status !== 'published') return;
  assert.equal(result.recordMaturity, null);
  assert.deepEqual(result.eraBuckets, []);
});

test('an absent jurisdictionState is null', () => {
  const { jurisdictionState: _omit, ...facets } = FULL_ROW.facets;
  const result = parseEntityPublicationSummary('rel_1', { ...FULL_ROW, facets });
  assert.equal(result.status, 'published');
  if (result.status !== 'published') return;
  assert.equal(result.jurisdictionState, null);
});

test('empty lineage keys count zero sources and non-string keys are ignored', () => {
  const empty = parseEntityPublicationSummary('rel_1', {
    ...FULL_ROW,
    facets: { ...FULL_ROW.facets, evidenceInputs: { evidenceLineageKeys: [] } },
  });
  const mixed = parseEntityPublicationSummary('rel_1', {
    ...FULL_ROW,
    facets: { ...FULL_ROW.facets, evidenceInputs: { evidenceLineageKeys: ['a', 1, null, ''] } },
  });
  assert.equal(empty.status === 'published' && empty.evidenceSourceCount, 0);
  assert.equal(mixed.status === 'published' && mixed.evidenceSourceCount, 1);
});

test('enum labels replace underscores and capitalize only the first letter', () => {
  assert.equal(formatEnumLabel('minimum_record'), 'Minimum record');
  assert.equal(formatEnumLabel('partial'), 'Partial');
  assert.equal(formatEnumLabel('A_b_C'), 'A b C');
  assert.equal(formatEnumLabel(null), 'Not recorded');
  assert.equal(formatEnumLabel(''), 'Not recorded');
});
