/**
 * Tests for national-catalog related-entry extraction and public adjacency projection.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { resolveReleaseClaimId } from '../publication/release-builder.js';
import {
  extractCatalogRelationships,
  relatedEntriesFromRelationships,
  type CatalogEntityForRelationships,
} from './catalog-related.js';

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../firebase/fixtures/national-catalog',
);

function loadFixtureEntities(filename: string): CatalogEntityForRelationships[] {
  const raw = readFileSync(join(fixtureRoot, filename), 'utf8');
  return JSON.parse(raw) as CatalogEntityForRelationships[];
}

function findEntity(
  entities: readonly CatalogEntityForRelationships[],
  id: string,
): CatalogEntityForRelationships {
  const entity = entities.find((entry) => entry.id === id);
  assert.ok(entity, `expected fixture entity ${id}`);
  return entity;
}

const generatedAt = '2026-07-18T00:00:00.000Z';

test('extractCatalogRelationships dedups Rosa Parks museum and arrest site located_at pair', () => {
  const institutions = loadFixtureEntities('institutions.json');
  const civilRights = loadFixtureEntities('civil-rights.json');
  const museum = findEntity(institutions, 'ent_rosa_parks_museum_001');
  const arrestSite = findEntity(civilRights, 'ent_rosa_parks_arrest_site_001');
  const trimmedArrestSite: CatalogEntityForRelationships = {
    ...arrestSite,
    related: (arrestSite.related ?? []).filter((entry) => entry.id === museum.id),
  };

  const { relationships, skipped } = extractCatalogRelationships([museum, trimmedArrestSite], {
    generatedAt,
  });

  assert.equal(skipped.length, 0);
  assert.equal(relationships.length, 1);

  const [relationship] = relationships;
  assert.equal(relationship?.id, 'rel_ent_rosa_parks_museum_001_located_at_ent_rosa_parks_arrest_site_001');
  assert.equal(relationship?.fromEntityId, 'ent_rosa_parks_museum_001');
  assert.equal(relationship?.toEntityId, 'ent_rosa_parks_arrest_site_001');
  assert.equal(relationship?.type, 'located_at');
  assert.equal(relationship?.workflowStatus, 'accepted');
  assert.equal(relationship?.publicationStatus, 'published');
  assert.equal(relationship?.resolutionState, 'resolved');
  assert.equal(relationship?.createdAt, generatedAt);
  assert.equal(relationship?.updatedAt, generatedAt);

  const museumClaimIds = (museum.claims ?? []).map((claim, index) =>
    resolveReleaseClaimId(museum, claim, index),
  );
  const arrestSiteClaimIds = (trimmedArrestSite.claims ?? []).map((claim, index) =>
    resolveReleaseClaimId(trimmedArrestSite, claim, index),
  );
  assert.deepEqual(relationship?.evidenceIds, [...museumClaimIds, ...arrestSiteClaimIds]);
});

test('extractCatalogRelationships dedups Edmund Pettus Bridge and Selma marches occurred_at pair', () => {
  const civilRights = loadFixtureEntities('civil-rights.json');
  const bridge = findEntity(civilRights, 'ent_edmund_pettus_bridge_001');
  const marches = findEntity(civilRights, 'ent_selma_to_montgomery_marches_001');
  const trimmedMarches: CatalogEntityForRelationships = {
    ...marches,
    related: (marches.related ?? []).filter((entry) => entry.id === bridge.id),
  };

  const { relationships, skipped } = extractCatalogRelationships([bridge, trimmedMarches], {
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
      claims: [{ predicate: 'p', object: 'o', confidenceLevel: 'high', citationSource: 'src', citationLabel: 'lbl' }],
      related: [{ id: 'ent_b', type: 'related_to', direction: 'outgoing' }],
    },
    {
      id: 'ent_b',
      claims: [{ predicate: 'p', object: 'o', confidenceLevel: 'high', citationSource: 'src', citationLabel: 'lbl' }],
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
  const institutions = loadFixtureEntities('institutions.json');
  const civilRights = loadFixtureEntities('civil-rights.json');
  const museum = findEntity(institutions, 'ent_rosa_parks_museum_001');
  const arrestSite = findEntity(civilRights, 'ent_rosa_parks_arrest_site_001');
  const bridge = findEntity(civilRights, 'ent_edmund_pettus_bridge_001');
  const marches = findEntity(civilRights, 'ent_selma_to_montgomery_marches_001');
  const trimmedArrestSite: CatalogEntityForRelationships = {
    ...arrestSite,
    related: (arrestSite.related ?? []).filter((entry) => entry.id === museum.id),
  };
  const trimmedMarches: CatalogEntityForRelationships = {
    ...marches,
    related: (marches.related ?? []).filter((entry) => entry.id === bridge.id),
  };

  const { relationships } = extractCatalogRelationships(
    [museum, trimmedArrestSite, bridge, trimmedMarches],
    { generatedAt },
  );
  const relatedByEntity = relatedEntriesFromRelationships(
    [museum.id, arrestSite.id, bridge.id, marches.id],
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

const sampleClaim = {
  predicate: 'p',
  object: 'o',
  confidenceLevel: 'high' as const,
  citationSource: 'src',
  citationLabel: 'lbl',
};

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
