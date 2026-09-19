/**
 * Row-mapping coverage for the source-library reads: `mapSourceLibraryListRow`,
 * `mapSourceLibraryEntryRow`, `mapSourceLibraryFitnessRow`, `mapSourceEntityRow`, and
 * `mapUnmappedHostRow` are pure functions over a literal Postgres row, so they are testable
 * without a database connection — the query builders themselves need one.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mapSourceEntityRow,
  mapSourceLibraryEntryRow,
  mapSourceLibraryFitnessRow,
  mapSourceLibraryListRow,
  mapUnmappedHostRow,
} from './postgres-sources.js';

test('maps a well-populated tier1 publisher row (NPS NPGallery)', () => {
  const item = mapSourceLibraryListRow({
    organization_id: 'org_nps',
    name: 'National Park Service — NPGallery',
    homepage: 'https://npgallery.nps.gov',
    parent_organization_id: 'org_nps_root',
    publisher_kind: 'government_archive',
    tier: 'tier1',
    summary: 'The digital asset repository for National Register nominations.',
    relevance: 'Primary source for National Register documentation.',
    limitations: null,
    profile_sources: ['https://npgallery.nps.gov/about'],
    profile_reviewed_at: '2026-08-01T00:00:00.000Z',
    profile_reviewed_by: 'staff-review-team',
    hosts: ['npgallery.nps.gov'],
    published_entities: 1987,
    published_claims: 5421,
    canonical_entities: 2001,
    evidence_sources: 1987,
    source_items: 2200,
    merged_organization_ids: [],
  });

  assert.equal(item.organizationId, 'org_nps');
  assert.equal(item.name, 'National Park Service — NPGallery');
  assert.equal(item.publisherKind, 'government_archive');
  assert.equal(item.tier, 'tier1');
  assert.equal(item.publishedEntities, 1987);
  assert.equal(item.publishedClaims, 5421);
  assert.equal(item.canonicalEntities, 2001);
  assert.equal(item.profileReviewedAt, '2026-08-01T00:00:00.000Z');
  assert.equal(item.profileReviewedBy, 'staff-review-team');
});

test('maps a tier3 publisher with a recorded limitation (Wikipedia)', () => {
  const entry = mapSourceLibraryEntryRow({
    organization_id: 'org_wikipedia',
    name: 'Wikipedia',
    homepage: 'https://en.wikipedia.org',
    parent_organization_id: null,
    publisher_kind: 'wiki_crowd',
    tier: 'tier3',
    summary: 'A crowd-edited encyclopedia used for leads, not standalone confirmation.',
    relevance: 'Useful for discovery; never cited alone for a contested claim.',
    limitations: ['Crowd-edited; verify every claim against a primary or tier1/2 source.'],
    profile_sources: [],
    profile_reviewed_at: null,
    profile_reviewed_by: null,
    hosts: ['en.wikipedia.org'],
    published_entities: 412,
    published_claims: 890,
    canonical_entities: 420,
    evidence_sources: 412,
    source_items: 500,
    merged_organization_ids: [],
  });

  assert.equal(entry.tier, 'tier3');
  assert.equal(entry.publisherKind, 'wiki_crowd');
  assert.deepEqual(entry.limitations, [
    'Crowd-edited; verify every claim against a primary or tier1/2 source.',
  ]);
  assert.equal(entry.profileReviewedAt, undefined);
  assert.equal(entry.profileReviewedBy, undefined);
});

test('maps an organization with no profile yet — every optional field is undefined, not blank strings', () => {
  const entry = mapSourceLibraryEntryRow({
    organization_id: 'org_no_profile',
    name: 'Unreviewed County Historical Society',
    homepage: null,
    parent_organization_id: null,
    publisher_kind: null,
    tier: null,
    summary: null,
    relevance: null,
    limitations: null,
    profile_sources: null,
    profile_reviewed_at: null,
    profile_reviewed_by: null,
    hosts: null,
    published_entities: 0,
    published_claims: 0,
    canonical_entities: 0,
    evidence_sources: 0,
    source_items: 0,
    merged_organization_ids: null,
  });

  assert.equal(entry.publisherKind, undefined);
  assert.equal(entry.tier, undefined);
  assert.equal(entry.summary, undefined);
  assert.equal(entry.relevance, undefined);
  assert.equal(entry.homepage, undefined);
  assert.deepEqual(entry.limitations, []);
  assert.deepEqual(entry.profileSources, []);
  assert.deepEqual(entry.hosts, []);
  assert.equal(entry.profileReviewedAt, undefined);
  assert.equal(entry.publishedEntities, 0);
});

test('rejects a publisher_kind outside the contract rather than guessing', () => {
  const item = mapSourceLibraryListRow({
    organization_id: 'org_x',
    name: 'X',
    homepage: null,
    parent_organization_id: null,
    publisher_kind: 'not_a_real_kind',
    tier: 'not_a_real_tier',
    summary: null,
    relevance: null,
    limitations: null,
    profile_sources: null,
    profile_reviewed_at: null,
    profile_reviewed_by: null,
    hosts: null,
    published_entities: null,
    published_claims: null,
    canonical_entities: null,
    evidence_sources: null,
    source_items: null,
    merged_organization_ids: null,
  });
  assert.equal(item.publisherKind, undefined);
  assert.equal(item.tier, undefined);
});

test('numeric counts arrive as strings from Postgres aggregates and coerce cleanly', () => {
  const item = mapSourceLibraryListRow({
    organization_id: 'org_y',
    name: 'Y',
    homepage: null,
    parent_organization_id: null,
    publisher_kind: null,
    tier: null,
    summary: null,
    relevance: null,
    limitations: null,
    profile_sources: null,
    profile_reviewed_at: null,
    profile_reviewed_by: null,
    hosts: null,
    published_entities: '1987',
    published_claims: '5421',
    canonical_entities: '2001',
    evidence_sources: '1987',
    source_items: '2200',
    merged_organization_ids: null,
  });
  assert.equal(item.publishedEntities, 1987);
  assert.equal(item.publishedClaims, 5421);
});

test('maps a fitness row', () => {
  const row = mapSourceLibraryFitnessRow({
    policy_id: 'policy_core_biography',
    evidence_use: 'primary_biographical_fact',
    fitness: 'authoritative',
    limitations: ['Scope limited to National Register-listed properties.'],
  });
  assert.equal(row.policyId, 'policy_core_biography');
  assert.equal(row.fitness, 'authoritative');
  assert.deepEqual(row.limitations, ['Scope limited to National Register-listed properties.']);
});

test('maps an entity row from published_citations, coercing the grouped claim count', () => {
  const row = mapSourceEntityRow({
    entity_id: 'ent_place_dunbar',
    entity_kind: 'place',
    entity_display_name: 'Dunbar High School',
    claim_count: '3',
    sample_citation_href: 'https://npgallery.nps.gov/GetAsset/abc123',
  });
  assert.equal(row.entityId, 'ent_place_dunbar');
  assert.equal(row.claimCount, 3);
  assert.equal(row.sampleCitationHref, 'https://npgallery.nps.gov/GetAsset/abc123');
});

test('maps an unmapped host row', () => {
  const row = mapUnmappedHostRow({
    host: 'loc.gov',
    published_entities: 12,
    published_claims: 30,
    sample_href: 'https://loc.gov/item/example',
  });
  assert.equal(row.host, 'loc.gov');
  assert.equal(row.publishedEntities, 12);
  assert.equal(row.sampleHref, 'https://loc.gov/item/example');
});
