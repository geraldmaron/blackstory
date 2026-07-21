/**
 * Unit tests for Postgres search-index row mapping into Firestore-shaped docs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPostgresSearchIndexRow } from './map-postgres-search-index';

test('mapPostgresSearchIndexRow builds a valid doc from denormalized columns', () => {
  const doc = mapPostgresSearchIndexRow({
    id: 'ent_example_001',
    release_id: 'rel_live_001',
    entity_id: 'ent_example_001',
    name: 'Example Place',
    name_lower: 'example place',
    aliases: ['alias one'],
    topics: ['civil-rights'],
    kind: 'place',
    status: 'active',
    geohash: 'dr5r',
    related_count: 2,
    claim_count: 3,
    facets: {
      eraBuckets: ['1960s'],
      recordMaturity: 'minimum_record',
      researchCoverage: 'partial',
      notabilityBasis: [],
      notabilityLabels: ['Landmark'],
    },
  });
  assert.ok(doc);
  assert.equal(doc!.id, 'ent_example_001');
  assert.equal(doc!.displayName, 'Example Place');
  assert.equal(doc!.relatedCount, 2);
  assert.equal(doc!.claimCount, 3);
  assert.deepEqual(doc!.topicTags, ['civil-rights']);
});

test('mapPostgresSearchIndexRow prefers facets payload when it is a full doc', () => {
  const doc = mapPostgresSearchIndexRow({
    id: 'ent_full_001',
    release_id: 'rel_live_001',
    entity_id: 'ent_full_001',
    name: 'Ignored Name',
    name_lower: 'ignored',
    aliases: [],
    topics: [],
    kind: 'place',
    status: null,
    geohash: null,
    related_count: 0,
    claim_count: 0,
    facets: {
      id: 'ent_full_001',
      releaseId: 'rel_live_001',
      kind: 'place',
      displayName: 'Full Facet Doc',
      nameLower: 'full facet doc',
      aliases: [],
      topicTags: [],
      topicIds: [],
      mentionedEntityIds: [],
      keywords: [],
      campaignIds: [],
      eraBuckets: [],
      notabilityBasis: [],
      notabilityLabels: [],
      recordMaturity: 'partial_enrichment',
      researchCoverage: 'substantial',
      relatedCount: 1,
      claimCount: 1,
    },
  });
  assert.ok(doc);
  assert.equal(doc!.displayName, 'Full Facet Doc');
  assert.equal(doc!.researchCoverage, 'substantial');
});
