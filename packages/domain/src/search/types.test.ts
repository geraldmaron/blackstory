/**
 * Type-level guarantees for search types: a `PublicSearchIndexDoc` is a structural superset
 * of `SearchableEntityRecord` (so it flows through the pure ranking/filter helpers without a cast),
 * and `SearchResultView` carries no numeric ranking field.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicSearchIndexDoc, SearchResultView, SearchableEntityRecord } from './types.js';

test('a PublicSearchIndexDoc is assignable to a SearchableEntityRecord', () => {
  const doc: PublicSearchIndexDoc = {
    id: 'e1',
    kind: 'school',
    displayName: 'Freedom School',
    nameLower: 'freedom school',
    aliases: ['colored school no. 1'],
    topicTags: ['education'],
    eraBuckets: ['1860s'],
    notabilityBasis: [{ criterion: 'community_anchor', note: 'basis', evidenceIds: ['ev-1'] }],
    notabilityLabels: ['A community anchor institution.'],
    recordMaturity: 'minimum_record',
    researchCoverage: 'partial',
    relatedCount: 3,
    claimCount: 2,
    releaseId: 'rel-1',
  };
  // Compile-time proof of the superset relationship; the runtime assert just anchors the test.
  const asRecord: SearchableEntityRecord = doc;
  assert.equal(asRecord.id, 'e1');
  assert.equal(doc.releaseId, 'rel-1');
});

test('SearchResultView exposes only display-safe fields (no numeric ranking signal)', () => {
  const view: SearchResultView = {
    id: 'e1',
    kind: 'school',
    displayName: 'Freedom School',
    matchedOn: 'displayName',
    matchedText: 'Freedom School',
    explanation: 'Matched on name.',
    eraBuckets: ['1860s'],
    notabilityLabels: ['A community anchor institution.'],
  };
  assert.ok(!('relatedCount' in view));
  assert.ok(!('claimCount' in view));
});
