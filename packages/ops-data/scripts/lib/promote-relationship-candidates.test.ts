/**
 * Unit tests for relationship candidate promotion helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAbsorbedToSurvivorMap, DEFAULT_HUB_MERGE_PAIRS } from './entity-hub-merge.ts';
import {
  buildExistingEdgeKeySet,
  edgeExistsEitherDirection,
  inferredRelationshipId,
  planRelationshipPromotion,
  remapCandidateEndpoints,
  requiresLivingPersonReview,
  shouldPromoteDeterministicCandidate,
} from './promote-relationship-candidates.ts';

const MERGE_MAP = buildAbsorbedToSurvivorMap(DEFAULT_HUB_MERGE_PAIRS);

test('shouldPromoteDeterministicCandidate accepts missing tier and deterministic only', () => {
  assert.equal(shouldPromoteDeterministicCandidate({ tier: 'deterministic' }), true);
  assert.equal(shouldPromoteDeterministicCandidate({}), true);
  assert.equal(shouldPromoteDeterministicCandidate({ tier: 'inferred' }), false);
});

test('requiresLivingPersonReview blocks living and unknown persons only', () => {
  const profiles = new Map([
    ['p-living', { id: 'p-living', kind: 'person', livingStatus: 'living' }],
    ['p-unknown', { id: 'p-unknown', kind: 'person', livingStatus: 'unknown' }],
    ['p-deceased', { id: 'p-deceased', kind: 'person', livingStatus: 'deceased' }],
    ['org-1', { id: 'org-1', kind: 'organization', livingStatus: 'unknown' }],
  ]);
  assert.equal(requiresLivingPersonReview('p-living', 'org-1', profiles), true);
  assert.equal(requiresLivingPersonReview('p-unknown', 'p-deceased', profiles), true);
  assert.equal(requiresLivingPersonReview('p-deceased', 'org-1', profiles), false);
  assert.equal(requiresLivingPersonReview('org-1', 'org-2', profiles), false);
});

test('edgeExistsEitherDirection matches reverse endpoints', () => {
  const existing = buildExistingEdgeKeySet([
    { fromEntityId: 'a', toEntityId: 'b', relationshipType: 'related_to' },
  ]);
  assert.equal(edgeExistsEitherDirection('b', 'a', 'related_to', existing), true);
  assert.equal(edgeExistsEitherDirection('a', 'c', 'related_to', existing), false);
});

test('remapCandidateEndpoints applies hub merge survivors', () => {
  const remapped = remapCandidateEndpoints(
    {
      candidateId: 'c1',
      fromEntityId: 'ent_sncc_001',
      toEntityId: 'ent_place_1',
      relationshipType: 'related_to',
      primaryReason: 'mutual_mention',
      tier: 'deterministic',
      score: 90,
    },
    MERGE_MAP,
  );
  assert.equal(remapped.fromEntityId, 'ent_sncc_org_001');
});

test('planRelationshipPromotion inserts safe edges and skips living review', () => {
  const profiles = new Map([
    [
      'ent_sncc_org_001',
      { id: 'ent_sncc_org_001', kind: 'organization', livingStatus: 'not_applicable' },
    ],
    ['ent_place_1', { id: 'ent_place_1', kind: 'place', livingStatus: 'not_applicable' }],
    ['p-living', { id: 'p-living', kind: 'person', livingStatus: 'living' }],
    ['p-deceased', { id: 'p-deceased', kind: 'person', livingStatus: 'deceased' }],
  ]);
  const existing = buildExistingEdgeKeySet([]);
  const decisions = planRelationshipPromotion(
    [
      {
        id: 'ok',
        status: 'pending',
        lane: 'relationship-inference',
        payload: {
          from_entity_id: 'ent_sncc_001',
          to_entity_id: 'ent_place_1',
          relationship_type: 'related_to',
          tier: 'deterministic',
          primary_reason: 'mutual_mention',
          score: 80,
        },
      },
      {
        id: 'living-skip',
        status: 'pending',
        lane: 'relationship-inference',
        payload: {
          from_entity_id: 'p-living',
          to_entity_id: 'ent_place_1',
          relationship_type: 'located_at',
          tier: 'deterministic',
        },
      },
      {
        id: 'deceased-ok',
        status: 'pending',
        lane: 'relationship-inference',
        payload: {
          from_entity_id: 'p-deceased',
          to_entity_id: 'ent_place_1',
          relationship_type: 'located_at',
          tier: 'deterministic',
        },
      },
      {
        id: 'inferred-skip',
        status: 'pending',
        lane: 'relationship-inference',
        payload: {
          from_entity_id: 'a',
          to_entity_id: 'b',
          relationship_type: 'related_to',
          tier: 'inferred',
        },
      },
    ],
    profiles,
    existing,
    MERGE_MAP,
  );

  const byId = new Map(
    decisions.map((d) => [d.action === 'insert' ? d.candidate.candidateId : d.candidateId, d]),
  );
  assert.equal(byId.get('ok')?.action, 'insert');
  assert.equal(byId.get('living-skip')?.action, 'skip');
  assert.equal(byId.get('living-skip')?.reason, 'SKIP_LIVING_REVIEW');
  assert.equal(byId.get('deceased-ok')?.action, 'insert');
  assert.equal(byId.get('inferred-skip')?.reason, 'NOT_DETERMINISTIC');
});

test('inferredRelationshipId is stable', () => {
  const id = inferredRelationshipId('a', 'related_to', 'b');
  assert.match(id, /^rel_inf_[a-f0-9]{24}$/);
  assert.equal(id, inferredRelationshipId('a', 'related_to', 'b'));
});
