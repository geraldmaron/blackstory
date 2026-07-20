/**
 * Tests for catalog-grounded search recommendations.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSearchRecommendations } from './recommendations.js';
import type { PublicSearchIndexDoc } from './types.js';

function doc(
  overrides: Partial<PublicSearchIndexDoc> & Pick<PublicSearchIndexDoc, 'id' | 'displayName'>,
): PublicSearchIndexDoc {
  return {
    kind: 'place',
    nameLower: overrides.displayName.toLowerCase(),
    aliases: [],
    topicTags: [],
    eraBuckets: [],
    notabilityBasis: [{ criterion: 'documented_site', note: 'n', evidenceIds: ['e1'] }],
    notabilityLabels: [],
    recordMaturity: 'minimum_record',
    researchCoverage: 'minimal',
    relatedCount: overrides.relatedCount ?? 0,
    claimCount: 0,
    releaseId: 'test',
    ...overrides,
  };
}

test('buildSearchRecommendations ranks name matches from the index', () => {
  const index = [
    doc({ id: 'a', displayName: 'Sweet Auburn', relatedCount: 1 }),
    doc({ id: 'b', displayName: 'Harlem', relatedCount: 5 }),
    doc({ id: 'c', displayName: 'Studio Museum in Harlem', relatedCount: 2 }),
  ];
  const recs = buildSearchRecommendations({ query: 'harlem', index, limit: 5 });
  assert.equal(recs[0]?.id, 'b');
  assert.ok(recs.some((r) => r.id === 'c'));
  assert.ok(!recs.some((r) => r.id === 'a'));
});

test('buildSearchRecommendations browse mode uses connection strength', () => {
  const index = [
    doc({ id: 'low', displayName: 'Alpha', relatedCount: 1 }),
    doc({ id: 'high', displayName: 'Beta', relatedCount: 9 }),
  ];
  const recs = buildSearchRecommendations({ query: '', index, limit: 2, allowBrowse: true });
  assert.equal(recs[0]?.id, 'high');
});
