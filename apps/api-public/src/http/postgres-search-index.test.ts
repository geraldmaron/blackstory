/**
 * Search readers prefer the complete facets document over denormalized scalar columns. A status
 * correction must update both representations to reach public readers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapPostgresSearchIndexRow } from './postgres-search-index.ts';

/** A full search document — has displayName, nameLower, kind, recordMaturity, researchCoverage. */
function fullDocRow(
  overrides: Record<string, unknown> = {},
  facetOverrides: Record<string, unknown> = {},
) {
  const { facets: _ignored, ...rowOverrides } = overrides;
  return {
    id: 'idx_1',
    release_id: 'rel_1',
    entity_id: 'ent_denmark_vesey_001',
    name: 'Denmark Vesey',
    name_lower: 'denmark vesey',
    aliases: [],
    topics: [],
    kind: 'person',
    status: 'deceased',
    geohash: null,
    related_count: 0,
    claim_count: 3,
    facets: {
      id: 'idx_1',
      releaseId: 'rel_1',
      entityId: 'ent_denmark_vesey_001',
      kind: 'person',
      displayName: 'Denmark Vesey',
      nameLower: 'denmark vesey',
      recordMaturity: 'minimum_record',
      researchCoverage: 'minimal',
      status: 'deceased',
      aliases: [],
      topicTags: [],
      topicIds: [],
      keywords: [],
      campaignIds: [],
      eraBuckets: [],
      mentionedEntityIds: [],
      notabilityBasis: [],
      notabilityLabels: [],
      claimCount: 3,
      relatedCount: 0,
      ...facetOverrides,
    },
    ...rowOverrides,
  };
}

describe('mapPostgresSearchIndexRow status provenance', () => {
  it('serves the status carried in the facets document', () => {
    const doc = mapPostgresSearchIndexRow(fullDocRow() as never);
    assert.equal(doc?.status, 'deceased');
  });

  it('IGNORES the status column when the facets blob is a full document', () => {
    // A corrected scalar column cannot override a stale status in the facets document.
    const doc = mapPostgresSearchIndexRow(
      fullDocRow({ status: 'deceased' }, { status: 'living' }) as never,
    );
    assert.equal(
      doc?.status,
      'living',
      'the facets blob is authoritative for a full doc — any status fix must write it',
    );
  });

  it('falls back to the status column when the blob is only a fragment', () => {
    const row = fullDocRow();
    // Strip a required field so isFullSearchIndexDoc() rejects it and the column path is used.
    const fragment = { ...row, facets: { displayName: 'Denmark Vesey' } };
    const doc = mapPostgresSearchIndexRow(fragment as never);
    assert.equal(doc?.status, 'deceased');
  });
});
