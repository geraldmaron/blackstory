/**
 * Unit tests for entity page adapters that map public claim views into evidence inputs.
 * Covers `toEvidenceClaimInputs` source-lineage mapping from explicit scored counts only
 * (citation-based record rollup lives in EntityEvidencePanel / resolveRecordSourceLineage).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicClaimView } from '../../data/public-seed';
import { toEvidenceClaimInputs } from './[id]/adapters';

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
