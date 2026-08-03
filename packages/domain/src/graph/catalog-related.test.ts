/**
 * Tests for national-catalog related-entry extraction and public adjacency projection.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveReleaseClaimId } from '../publication/release-builder.js';
import {
  extractCatalogRelationships,
  relatedEntriesFromRelationships,
  type CatalogEntityForRelationships,
} from './catalog-related.js';

const generatedAt = '2026-07-18T00:00:00.000Z';

const sampleClaim = {
  predicate: 'p',
  object: 'o',
  confidenceLevel: 'high' as const,
  citationSource: 'src',
  citationLabel: 'lbl',
};

/*
 * These three cases used to read packages/ops-data/fixtures/national-catalog/*.json. Those
 * fixtures were retired in f8c81a06 when Supabase became the only entity store, and because this
 * file was not on @repo/domain's hardcoded test list it kept "passing" by never running. The
 * entities are built inline now, which is how the rest of this file already works, and the
 * assertions are unchanged: the pair still dedups to one canonical edge with both sides'
 * claim evidence, and the public projection still reports the direction each end sees.
 */
const museumFixture: CatalogEntityForRelationships = {
  id: 'ent_rosa_parks_museum_001',
  claims: [sampleClaim],
  related: [{ id: 'ent_rosa_parks_arrest_site_001', type: 'located_at', direction: 'outgoing' }],
};

const arrestSiteFixture: CatalogEntityForRelationships = {
  id: 'ent_rosa_parks_arrest_site_001',
  claims: [sampleClaim],
  related: [{ id: 'ent_rosa_parks_museum_001', type: 'located_at', direction: 'incoming' }],
};

const bridgeFixture: CatalogEntityForRelationships = {
  id: 'ent_edmund_pettus_bridge_001',
  claims: [sampleClaim],
  related: [
    { id: 'ent_selma_to_montgomery_marches_001', type: 'occurred_at', direction: 'incoming' },
  ],
};

const marchesFixture: CatalogEntityForRelationships = {
  id: 'ent_selma_to_montgomery_marches_001',
  claims: [sampleClaim],
  related: [{ id: 'ent_edmund_pettus_bridge_001', type: 'occurred_at', direction: 'outgoing' }],
};

test('extractCatalogRelationships dedups Rosa Parks museum and arrest site located_at pair', () => {
  const { relationships, skipped } = extractCatalogRelationships(
    [museumFixture, arrestSiteFixture],
    { generatedAt },
  );

  assert.equal(skipped.length, 0);
  assert.equal(relationships.length, 1);

  const [relationship] = relationships;
  assert.equal(
    relationship?.id,
    'rel_ent_rosa_parks_museum_001_located_at_ent_rosa_parks_arrest_site_001',
  );
  assert.equal(relationship?.fromEntityId, 'ent_rosa_parks_museum_001');
  assert.equal(relationship?.toEntityId, 'ent_rosa_parks_arrest_site_001');
  assert.equal(relationship?.type, 'located_at');
  assert.equal(relationship?.workflowStatus, 'accepted');
  assert.equal(relationship?.publicationStatus, 'published');
  assert.equal(relationship?.resolutionState, 'resolved');
  assert.equal(relationship?.createdAt, generatedAt);
  assert.equal(relationship?.updatedAt, generatedAt);

  // Both ends contribute their claim evidence, museum first.
  const museumClaimIds = (museumFixture.claims ?? []).map((claim, index) =>
    resolveReleaseClaimId(museumFixture, claim, index),
  );
  const arrestSiteClaimIds = (arrestSiteFixture.claims ?? []).map((claim, index) =>
    resolveReleaseClaimId(arrestSiteFixture, claim, index),
  );
  assert.deepEqual(relationship?.evidenceIds, [...museumClaimIds, ...arrestSiteClaimIds]);
});

test('extractCatalogRelationships dedups Edmund Pettus Bridge and Selma marches occurred_at pair', () => {
  const { relationships, skipped } = extractCatalogRelationships([bridgeFixture, marchesFixture], {
    generatedAt,
  });

  assert.equal(skipped.length, 0);
  assert.equal(relationships.length, 1);

  const [relationship] = relationships;
  assert.equal(
    relationship?.id,
    'rel_ent_selma_to_montgomery_marches_001_occurred_at_ent_edmund_pettus_bridge_001',
  );
  assert.equal(relationship?.fromEntityId, 'ent_selma_to_montgomery_marches_001');
  assert.equal(relationship?.toEntityId, 'ent_edmund_pettus_bridge_001');
  assert.equal(relationship?.type, 'occurred_at');
});

test('extractCatalogRelationships collapses bidirectional duplicates into one canonical edge', () => {
  const entities: CatalogEntityForRelationships[] = [
    {
      id: 'ent_a',
      claims: [
        {
          predicate: 'p',
          object: 'o',
          confidenceLevel: 'high',
          citationSource: 'src',
          citationLabel: 'lbl',
        },
      ],
      related: [{ id: 'ent_b', type: 'related_to', direction: 'outgoing' }],
    },
    {
      id: 'ent_b',
      claims: [
        {
          predicate: 'p',
          object: 'o',
          confidenceLevel: 'high',
          citationSource: 'src',
          citationLabel: 'lbl',
        },
      ],
      related: [{ id: 'ent_a', type: 'related_to', direction: 'incoming' }],
    },
  ];

  const { relationships, skipped } = extractCatalogRelationships(entities, { generatedAt });

  assert.equal(skipped.length, 0);
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0]?.fromEntityId, 'ent_a');
  assert.equal(relationships[0]?.toEntityId, 'ent_b');
});

test('extractCatalogRelationships skips pairs with no resolvable claim evidence', () => {
  const entities: CatalogEntityForRelationships[] = [
    {
      id: 'ent_a',
      related: [{ id: 'ent_b', type: 'related_to', direction: 'outgoing' }],
    },
    {
      id: 'ent_b',
      related: [{ id: 'ent_a', type: 'related_to', direction: 'incoming' }],
    },
  ];

  const { relationships, skipped } = extractCatalogRelationships(entities, { generatedAt });

  assert.equal(relationships.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0] ?? '', /no resolvable claim evidence/);
});

test('relatedEntriesFromRelationships returns public related entries for museum and bridge', () => {
  const { relationships } = extractCatalogRelationships(
    [museumFixture, arrestSiteFixture, bridgeFixture, marchesFixture],
    { generatedAt },
  );
  const relatedByEntity = relatedEntriesFromRelationships(
    [museumFixture.id, arrestSiteFixture.id, bridgeFixture.id, marchesFixture.id],
    relationships,
  );

  assert.deepEqual(relatedByEntity.get('ent_rosa_parks_museum_001'), [
    {
      id: 'ent_rosa_parks_arrest_site_001',
      type: 'located_at',
      direction: 'outgoing',
    },
  ]);
  assert.deepEqual(relatedByEntity.get('ent_edmund_pettus_bridge_001'), [
    {
      id: 'ent_selma_to_montgomery_marches_001',
      type: 'occurred_at',
      direction: 'incoming',
    },
  ]);
});

// ---------------------------------------------------------------------------
// WS6 — `mentionedEntityIds` wire-forward (see ./mention-resolver.ts).
// ---------------------------------------------------------------------------

test('extractCatalogRelationships emits a related_to edge for a resolved mention', () => {
  const entities: CatalogEntityForRelationships[] = [
    { id: 'ent_a', displayName: 'Alpha Org', claims: [sampleClaim] },
    {
      id: 'ent_b',
      displayName: 'Beta Group',
      claims: [sampleClaim],
      mentionedEntityIds: ['ent_a'],
    },
  ];

  const { relationships, skipped } = extractCatalogRelationships(entities, { generatedAt });

  assert.equal(skipped.length, 0);
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0]?.fromEntityId, 'ent_b');
  assert.equal(relationships[0]?.toEntityId, 'ent_a');
  assert.equal(relationships[0]?.type, 'related_to');
  assert.equal(relationships[0]?.workflowStatus, 'accepted');
});

test('extractCatalogRelationships silently skips an unresolved mention (never guesses)', () => {
  const entities: CatalogEntityForRelationships[] = [
    { id: 'ent_a', displayName: 'Alpha Org', claims: [sampleClaim] },
    {
      id: 'ent_b',
      displayName: 'Beta Group',
      claims: [sampleClaim],
      mentionedEntityIds: ['totally-unrecognized-slug'],
    },
  ];

  const { relationships, skipped } = extractCatalogRelationships(entities, { generatedAt });

  assert.equal(relationships.length, 0);
  assert.equal(skipped.length, 0);
});

test('extractCatalogRelationships does not duplicate an explicit related[] edge with a resolved mention of the same pair', () => {
  const entities: CatalogEntityForRelationships[] = [
    {
      id: 'ent_a',
      displayName: 'Alpha Org',
      claims: [sampleClaim],
      related: [{ id: 'ent_b', type: 'founded', direction: 'outgoing' }],
      mentionedEntityIds: ['ent_b'],
    },
    { id: 'ent_b', displayName: 'Beta Group', claims: [sampleClaim] },
  ];

  const { relationships, skipped } = extractCatalogRelationships(entities, { generatedAt });

  assert.equal(skipped.length, 0);
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0]?.type, 'founded');
  assert.equal(relationships[0]?.fromEntityId, 'ent_a');
  assert.equal(relationships[0]?.toEntityId, 'ent_b');
});

test('extractCatalogRelationships mentions are still subject to the evidence requirement', () => {
  const entities: CatalogEntityForRelationships[] = [
    { id: 'ent_a', displayName: 'Alpha Org' },
    { id: 'ent_b', displayName: 'Beta Group', mentionedEntityIds: ['ent_a'] },
  ];

  const { relationships, skipped } = extractCatalogRelationships(entities, { generatedAt });

  assert.equal(relationships.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0] ?? '', /no resolvable claim evidence/);
});
