/**
 * Unit tests for entity page adapters that map public claim views into evidence inputs.
 * Covers `toEvidenceClaimInputs` source-lineage mapping from explicit scored counts only
 * (citation-based record rollup lives in EntityEvidencePanel / resolveRecordSourceLineage).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicClaimView } from '../../data/public-seed';
import { toEvidenceClaimInputs, withoutSummaryEchoClaims } from './[id]/adapters';

const BASE_CLAIM: PublicClaimView = {
  id: 'claim_test_01',
  predicate: 'founded_year',
  object: '1900',
  confidenceScore: 0.85,
  confidenceLevel: 'high',
  citationSource: 'Example Source',
  citationLabel: 'Example Citation',
};

test('toEvidenceClaimInputs maps explicit independentLineageCount when greater than zero', () => {
  const [mapped] = toEvidenceClaimInputs([{ ...BASE_CLAIM, independentLineageCount: 3 }]);
  assert.deepEqual(mapped!.sourceLineage, { independentLineageCount: 3 });
});

test('toEvidenceClaimInputs omits sourceLineage when count is absent (panel uses citation proxy)', () => {
  const [mapped] = toEvidenceClaimInputs([BASE_CLAIM]);
  assert.equal(mapped!.sourceLineage, undefined);
});

test('toEvidenceClaimInputs omits sourceLineage when count is zero', () => {
  const [mapped] = toEvidenceClaimInputs([{ ...BASE_CLAIM, independentLineageCount: 0 }]);
  assert.equal(mapped!.sourceLineage, undefined);
});

const SUMMARY =
  'Bethel Literary and Historical Society met at Metropolitan AME Church, where Black ' +
  'Washingtonians debated the questions of the day for more than forty years.';

test('withoutSummaryEchoClaims drops a claim whose object restates the summary', () => {
  const echo: PublicClaimView = { ...BASE_CLAIM, predicate: 'documented_site', object: SUMMARY };
  assert.deepEqual(withoutSummaryEchoClaims([echo], SUMMARY), []);
});

test('withoutSummaryEchoClaims ignores case, spacing, and a trailing period when matching', () => {
  const echo: PublicClaimView = {
    ...BASE_CLAIM,
    object: `  ${SUMMARY.toUpperCase().replace(' met ', '   met   ')}  `,
  };
  assert.deepEqual(withoutSummaryEchoClaims([echo], SUMMARY), []);
});

test('withoutSummaryEchoClaims keeps claims that say something the summary does not', () => {
  const listing: PublicClaimView = {
    ...BASE_CLAIM,
    predicate: 'listing',
    object: 'Listed on the National Register of Historic Places, ref #71000836.',
  };
  const echo: PublicClaimView = { ...BASE_CLAIM, id: 'claim_test_02', object: SUMMARY };
  assert.deepEqual(withoutSummaryEchoClaims([listing, echo], SUMMARY), [listing]);
});

test('withoutSummaryEchoClaims leaves every claim in place when the summary is empty', () => {
  // An empty summary would otherwise normalize to '' and match any claim that is also blank.
  assert.deepEqual(withoutSummaryEchoClaims([BASE_CLAIM], '   '), [BASE_CLAIM]);
});
