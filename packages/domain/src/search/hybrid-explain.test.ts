/**
 * Tests for hybrid match explanations no numeric scores in public affordances.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertHybridExplanationHasNoNumericScore, buildWhyThisResult } from './hybrid-explain.js';
import type { SearchableEntityRecord } from './types.js';

const REC: SearchableEntityRecord = {
  id: 'e1',
  kind: 'school',
  displayName: 'Freedom School',
  nameLower: 'freedom school',
  aliases: ['colored school'],
  topicTags: ['education'],
  eraBuckets: ['1860s'],
  jurisdictionState: 'NC',
  notabilityBasis: [{ criterion: 'community_anchor', note: 'basis', evidenceIds: ['ev-1'] }],
  notabilityLabels: ['A community anchor institution.'],
  recordMaturity: 'minimum_record',
  researchCoverage: 'minimal',
  relatedCount: 1,
  claimCount: 0,
};

test('buildWhyThisResult includes structured and era reasons', () => {
  const reasons = buildWhyThisResult(
    REC,
    { record: REC, matchedOn: 'displayName', matchedText: REC.displayName },
    'freedom',
    {
      fromStructuredLane: true,
      fromVectorLane: false,
      placeAnchored: false,
      eraPreFilter: '1860s',
    },
  );
  assert.ok(reasons.some((r) => r.includes('Matched on name')));
  assert.ok(reasons.some((r) => r.includes('1860s')));
  assert.ok(reasons.some((r) => r.includes('Sparse record')));
});

test('vector-only match explains semantic recall', () => {
  const reasons = buildWhyThisResult(REC, undefined, 'oral histories chapel', {
    fromStructuredLane: false,
    fromVectorLane: true,
    placeAnchored: false,
  });
  assert.ok(reasons.some((r) => r.includes('Semantic recall')));
});

test('assertHybridExplanationHasNoNumericScore rejects score leaks', () => {
  assert.throws(
    () => assertHybridExplanationHasNoNumericScore(['distance: 0.85']),
    /numeric scores/,
  );
});
