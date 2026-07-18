/**
 * Tests for repeatable relationship candidate extraction used in research triage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  proposeRelationshipCandidates,
  type RelationshipCandidateEntity,
} from './relationship-candidates.js';

test('proposeRelationshipCandidates proposes shared geohash prefix pairs as located_at', () => {
  const entities: RelationshipCandidateEntity[] = [
    {
      id: 'ent_place_a',
      kind: 'place',
      geohash: 'dr5regw3',
      jurisdictionLabel: 'New York, New York',
    },
    {
      id: 'ent_place_b',
      kind: 'place',
      geohash: 'dr5regw9',
      jurisdictionLabel: 'Brooklyn, New York',
    },
  ];

  const candidates = proposeRelationshipCandidates({ entities });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.suggestedType, 'located_at');
  assert.equal(candidates[0]?.reason, 'shared_geohash_prefix');
  assert.match(candidates[0]?.scoreSignals.join(' '), /shared geohash prefix "dr5r"/);
});

test('proposeRelationshipCandidates proposes shared jurisdiction pairs as related_to', () => {
  const entities: RelationshipCandidateEntity[] = [
    {
      id: 'ent_a',
      jurisdictionLabel: ' Selma, Alabama ',
      geohash: 'aaa11111',
    },
    {
      id: 'ent_b',
      jurisdictionLabel: 'selma, alabama',
      geohash: 'bbb22222',
    },
  ];

  const candidates = proposeRelationshipCandidates({ entities });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.suggestedType, 'related_to');
  assert.equal(candidates[0]?.reason, 'shared_jurisdiction');
});

test('proposeRelationshipCandidates proposes mutual mentions and skips existing relationships', () => {
  const entities: RelationshipCandidateEntity[] = [
    {
      id: 'ent_a',
      mentionedEntityIds: ['ent_b'],
      jurisdictionLabel: 'Montgomery, Alabama',
    },
    {
      id: 'ent_b',
      mentionedEntityIds: ['ent_a'],
      jurisdictionLabel: 'Montgomery, Alabama',
    },
    {
      id: 'ent_c',
      mentionedEntityIds: ['ent_d'],
      jurisdictionLabel: 'Montgomery, Alabama',
    },
    {
      id: 'ent_d',
      jurisdictionLabel: 'Montgomery, Alabama',
    },
  ];

  const candidates = proposeRelationshipCandidates({
    entities,
    existingRelationships: [{ fromEntityId: 'ent_a', toEntityId: 'ent_b', type: 'related_to' }],
  });

  assert.equal(
    candidates.some(
      (candidate) =>
        (candidate.fromEntityId === 'ent_a' && candidate.toEntityId === 'ent_b') ||
        (candidate.fromEntityId === 'ent_b' && candidate.toEntityId === 'ent_a'),
    ),
    false,
  );
  assert.equal(candidates.some((candidate) => candidate.reason === 'mutual_mention'), true);
});

test('proposeRelationshipCandidates prefers occurred_at when an event shares a geohash prefix', () => {
  const entities: RelationshipCandidateEntity[] = [
    {
      id: 'ent_event',
      kind: 'event',
      geohash: 'dr5regw3',
    },
    {
      id: 'ent_place',
      kind: 'place',
      geohash: 'dr5regw9',
    },
  ];

  const candidates = proposeRelationshipCandidates({ entities });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.suggestedType, 'occurred_at');
  assert.equal(candidates[0]?.fromEntityId, 'ent_event');
  assert.equal(candidates[0]?.toEntityId, 'ent_place');
});

test('proposeRelationshipCandidates is deterministic and capped at 200 results', () => {
  const entities: RelationshipCandidateEntity[] = Array.from({ length: 30 }, (_, index) => ({
    id: `ent_${String(index).padStart(3, '0')}`,
    jurisdictionLabel: 'Shared City, State',
    geohash: 'dr5regw3',
  }));

  const first = proposeRelationshipCandidates({ entities });
  const second = proposeRelationshipCandidates({ entities });

  assert.deepEqual(first, second);
  assert.ok(first.length <= 200);
});
