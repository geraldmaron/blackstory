/**
 * Unit tests for explainable relationship candidate ranking.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { RelationshipCandidate } from '../../../domain/src/graph/relationship-candidates.ts';
import { rankRelationshipCandidates } from './relationship-candidate-ranking.ts';

const ENTITIES = [
  {
    id: 'ent_person',
    kind: 'person',
    geohash: 'dr5regw3',
    locationPrecision: 'address',
    decades: ['1960s'],
  },
  {
    id: 'ent_place',
    kind: 'place',
    geohash: 'dr5regw9',
    locationPrecision: 'institution',
    decades: ['1960s'],
  },
  {
    id: 'ent_place_b',
    kind: 'place',
    geohash: '9q8yyw1',
    locationPrecision: 'county',
    decades: ['1960s'],
  },
] as const;

test('rankRelationshipCandidates boosts mutual mentions to deterministic tier', () => {
  const proposed: RelationshipCandidate[] = [
    {
      fromEntityId: 'ent_person',
      toEntityId: 'ent_place',
      suggestedType: 'located_at',
      reason: 'mutual_mention',
      scoreSignals: ['entities mention each other in catalog metadata'],
    },
  ];

  const ranked = rankRelationshipCandidates({ proposed, entities: ENTITIES });
  assert.equal(ranked[0]?.tier, 'deterministic');
  assert.ok((ranked[0]?.scoreComponents.reason_bonus ?? 0) >= 40);
});

test('rankRelationshipCandidates deprioritizes place+place pairs versus person+place', () => {
  const proposed: RelationshipCandidate[] = [
    {
      fromEntityId: 'ent_place',
      toEntityId: 'ent_place_b',
      suggestedType: 'related_to',
      reason: 'shared_decade_overlap',
      scoreSignals: ['shared decades 1960s'],
    },
    {
      fromEntityId: 'ent_person',
      toEntityId: 'ent_place',
      suggestedType: 'located_at',
      reason: 'shared_geohash_prefix',
      scoreSignals: ['shared geohash prefix "dr5r"'],
    },
  ];

  const ranked = rankRelationshipCandidates({ proposed, entities: ENTITIES });
  assert.equal(ranked[0]?.fromEntityId, 'ent_person');
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});

test('rankRelationshipCandidates marks co-participation as deterministic', () => {
  const ranked = rankRelationshipCandidates({
    proposed: [],
    coParticipation: [
      {
        fromEntityId: 'ent_person',
        toEntityId: 'ent_place',
        eventId: 'ent_march',
        suggestedType: 'related_to',
        reason: 'same_event_co_participation',
      },
    ],
    entities: ENTITIES,
  });

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.tier, 'deterministic');
  assert.equal(ranked[0]?.primaryReason, 'same_event_co_participation');
});
