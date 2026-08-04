/**
 * Network Traversal Discovery tests.
 *
 * Fixture: a cataloged organization (fake local NAACP chapter) with three relationships to
 * persons — one already in the catalog (a proposed_match), two unknown (no_match). No network,
 * no DB: relationships and catalog profiles are inline.
 *
 * Covers: extractRelationshipTargets, resolveUnknownTargets (unknown filtering), candidate
 * construction with embedded relationship context, obscurity attached, and the cannot-publish
 * invariant.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CanonicalEntity } from '../entity.js';
import type { ResolutionProfile } from '../resolution/index.js';
import { assertDiscoveryCannotPublish } from './guard.js';
import { DISCOVERY_CANDIDATE_SCHEMA_VERSION } from './types.js';
import {
  NETWORK_TRAVERSAL_CAMPAIGN_KIND,
  buildNetworkDiscoveryCandidates,
  catalogMatchFnFromProfiles,
  classifyNetworkTargets,
  extractRelationshipTargets,
  networkContextOf,
  resolveUnknownTargets,
  runNetworkTraversalCampaign,
  type NetworkRelationshipRecord,
} from './network-traversal.js';

const FIXED_NOW = '2026-07-24T12:00:00.000Z';
const SEED_ORG_ID = 'entity_org_greenwood_naacp';

function entity(
  id: string,
  kind: CanonicalEntity['kind'],
  displayName: string,
  extra: Partial<CanonicalEntity> = {},
): CanonicalEntity {
  return { id, kind, displayName, createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...extra };
}

/**
 * Three neighbors of the seed org:
 * - Roy Wilkins: already cataloged (matches a profile by name + wikidata id) → proposed_match.
 * - Ada B. Loper: local chapter secretary, not in catalog → no_match.
 * - Silas Freeman: local organizer, not in catalog → no_match.
 */
function seedRelationships(): readonly NetworkRelationshipRecord[] {
  return [
    {
      id: 'rel_1',
      fromEntityId: 'entity_person_roy_wilkins',
      toEntityId: SEED_ORG_ID,
      predicate: 'member_of',
      role: 'national liaison',
      target: {
        entityId: 'entity_person_roy_wilkins',
        name: 'Roy Wilkins',
        kind: 'person',
        identifiers: { wikidata: 'Q311750' },
      },
    },
    {
      id: 'rel_2',
      fromEntityId: SEED_ORG_ID,
      toEntityId: 'entity_person_ada_loper',
      predicate: 'founded',
      role: 'chapter secretary',
      target: {
        entityId: 'entity_person_ada_loper',
        name: 'Ada B. Loper',
        kind: 'person',
        geographicHints: ['Tulsa, OK'],
        year: 1921,
      },
    },
    {
      id: 'rel_3',
      fromEntityId: SEED_ORG_ID,
      toEntityId: 'entity_person_silas_freeman',
      predicate: 'participated_in',
      role: 'local organizer',
      target: {
        entityId: 'entity_person_silas_freeman',
        name: 'Silas Freeman',
        kind: 'person',
        geographicHints: ['US-OK'],
      },
    },
  ];
}

function catalogProfiles(): readonly ResolutionProfile[] {
  return [
    {
      entity: entity('entity_person_roy_wilkins', 'person', 'Roy Wilkins', {
        identifiers: [{ system: 'wikidata', value: 'Q311750' }],
      }),
    },
    {
      entity: entity('entity_org_greenwood_naacp', 'organization', 'Greenwood NAACP Chapter'),
    },
    // High-visibility catalog names, unrelated to the unknown local neighbors.
    { entity: entity('entity_person_rosa_parks', 'person', 'Rosa Parks') },
    { entity: entity('entity_person_mlk', 'person', 'Martin Luther King Jr.') },
  ];
}

const CATALOG_TITLES = [
  'Roy Wilkins',
  'Rosa Parks',
  'Martin Luther King Jr.',
  'Greenwood NAACP Chapter',
  'Buffalo Soldiers',
];

test('extractRelationshipTargets pulls neighbor name, identifiers, predicate, and direction', () => {
  const targets = extractRelationshipTargets(SEED_ORG_ID, seedRelationships());
  assert.equal(targets.length, 3);

  const wilkins = targets.find((t) => t.name === 'Roy Wilkins')!;
  assert.ok(wilkins);
  assert.equal(wilkins.predicate, 'member_of');
  assert.equal(wilkins.direction, 'inbound'); // seed is the `to` side
  assert.equal(wilkins.identifiers.wikidata, 'Q311750');

  const loper = targets.find((t) => t.name === 'Ada B. Loper')!;
  assert.equal(loper.direction, 'outbound'); // seed is the `from` side
  assert.equal(loper.predicate, 'founded');
  assert.deepEqual(loper.geographicHints, ['Tulsa, OK']);
  assert.equal(loper.year, 1921);
});

test('extractRelationshipTargets skips edges not involving the seed and nameless targets', () => {
  const relationships: readonly NetworkRelationshipRecord[] = [
    {
      id: 'rel_other',
      fromEntityId: 'entity_a',
      toEntityId: 'entity_b',
      predicate: 'member_of',
      target: { name: 'Someone Else' },
    },
    {
      id: 'rel_blank',
      fromEntityId: SEED_ORG_ID,
      toEntityId: 'entity_c',
      predicate: 'founded',
      target: { name: '   ' },
    },
  ];
  assert.equal(extractRelationshipTargets(SEED_ORG_ID, relationships).length, 0);
});

test('resolveUnknownTargets keeps only no_match neighbors (2 of 3)', () => {
  const targets = extractRelationshipTargets(SEED_ORG_ID, seedRelationships());
  const matchFn = catalogMatchFnFromProfiles(catalogProfiles());

  const classifications = classifyNetworkTargets(targets, matchFn);
  const wilkins = classifications.find((c) => c.target.name === 'Roy Wilkins')!;
  assert.equal(wilkins.outcome, 'proposed_match');

  const unknown = resolveUnknownTargets(targets, matchFn);
  assert.equal(unknown.length, 2);
  const names = unknown.map((t) => t.name).sort();
  assert.deepEqual(names, ['Ada B. Loper', 'Silas Freeman']);
});

test('buildNetworkDiscoveryCandidates embeds relationship context and stays private schema', () => {
  const targets = extractRelationshipTargets(SEED_ORG_ID, seedRelationships());
  const matchFn = catalogMatchFnFromProfiles(catalogProfiles());
  const unknown = resolveUnknownTargets(targets, matchFn);

  const candidates = buildNetworkDiscoveryCandidates(unknown, {
    runId: 'run_network_1',
    capturedAt: FIXED_NOW,
  });
  assert.equal(candidates.length, 2);

  for (const candidate of candidates) {
    assert.equal(candidate.schemaVersion, DISCOVERY_CANDIDATE_SCHEMA_VERSION);
    assert.equal(candidate.status, 'pending');
    const context = networkContextOf(candidate);
    assert.ok(context, 'expected embedded networkContext');
    assert.equal(context!.methodology, NETWORK_TRAVERSAL_CAMPAIGN_KIND);
    assert.equal(context!.seedEntityId, SEED_ORG_ID);
    assert.ok(context!.predicate.length > 0);
    // Identity + provenance derived from the synthetic adapter record.
    assert.ok(candidate.identity.contentHash.digest.length > 0);
    assert.equal(candidate.adapterRecord.provenance.adapterId, 'network-traversal');
  }

  const loper = candidates.find((c) => c.adapterRecord.title === 'Ada B. Loper')!;
  assert.equal(networkContextOf(loper)!.predicate, 'founded');
  assert.equal(networkContextOf(loper)!.direction, 'outbound');
});

test('runNetworkTraversalCampaign attaches obscurity and reports match counts', () => {
  const result = runNetworkTraversalCampaign({
    seedEntityId: SEED_ORG_ID,
    relationships: seedRelationships(),
    catalogProfiles: catalogProfiles(),
    catalogTitles: CATALOG_TITLES,
    runId: 'run_network_campaign',
    capturedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });

  assert.equal(result.kind, NETWORK_TRAVERSAL_CAMPAIGN_KIND);
  assert.equal(result.relationshipsRead, 3);
  assert.equal(result.targetsExtracted, 3);
  assert.equal(result.proposedMatchCount, 1); // Roy Wilkins
  assert.equal(result.unknownCount, 2);
  assert.equal(result.candidates.length, 2);

  // Obscurity attached to every ranked lead, carrying the methodology disclaimer.
  assert.equal(result.ranked.length, 2);
  for (const lead of result.ranked) {
    assert.equal(lead.obscurity.candidateId, lead.candidateId);
    assert.equal(lead.obscurity.disclaimerId, result.disclaimer.id);
    assert.ok(lead.obscurity.score >= 0 && lead.obscurity.score <= 1);
    assert.ok(lead.predicate.length > 0);
  }

  // Unknown local neighbors (no catalog match, no trusted id) should read as obscure.
  const scores = result.ranked.map((lead) => lead.obscurity.score);
  assert.ok(
    Math.max(...scores) >= 0.55,
    `expected an obscure lead, got scores ${scores.join(', ')}`,
  );
});

test('injected readRelationships is honored over inline relationships', () => {
  let readFor = '';
  const result = runNetworkTraversalCampaign({
    seedEntityId: SEED_ORG_ID,
    readRelationships: (id) => {
      readFor = id;
      return seedRelationships();
    },
    relationships: [], // should be ignored
    catalogProfiles: catalogProfiles(),
    catalogTitles: CATALOG_TITLES,
    runId: 'run_reader',
    capturedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
  assert.equal(readFor, SEED_ORG_ID);
  assert.equal(result.unknownCount, 2);
});

test('maxCandidates bounds fan-out without changing unknownCount', () => {
  const result = runNetworkTraversalCampaign({
    seedEntityId: SEED_ORG_ID,
    relationships: seedRelationships(),
    catalogProfiles: catalogProfiles(),
    catalogTitles: CATALOG_TITLES,
    runId: 'run_capped',
    capturedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
    maxCandidates: 1,
  });
  assert.equal(result.unknownCount, 2);
  assert.equal(result.candidates.length, 1);
});

test('cannot-publish invariant holds: forbidden ops throw; campaign emits private candidates only', () => {
  // The guard the campaign relies on rejects publication side effects.
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'write_public_projection' }),
    /Discovery cannot publish/,
  );
  assert.throws(
    () => assertDiscoveryCannotPublish({ operation: 'create_public_entity' }),
    /Discovery cannot publish/,
  );

  const result = runNetworkTraversalCampaign({
    seedEntityId: SEED_ORG_ID,
    relationships: seedRelationships(),
    catalogProfiles: catalogProfiles(),
    catalogTitles: CATALOG_TITLES,
    runId: 'run_guard',
    capturedAt: FIXED_NOW,
    completedAt: FIXED_NOW,
  });
  // Every emitted record is a private discovery candidate — never a public projection.
  for (const candidate of result.candidates) {
    assert.equal(candidate.schemaVersion, DISCOVERY_CANDIDATE_SCHEMA_VERSION);
  }
});
