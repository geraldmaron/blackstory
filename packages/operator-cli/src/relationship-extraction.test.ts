/**
 * Tests for the claims-mining relationship extraction engine: kind-pair matrix enforcement,
 * temporal-context gating for causal types, and evidence-id attachment on staged rows.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractCandidate,
  extractCandidates,
  isKindPairValid,
  findEntityMention,
  stageRelationshipCandidates,
  type ClaimEntity,
  type ClaimRow,
  type RelationshipCandidateRow,
} from './relationship-extraction.ts';

const person: ClaimEntity = { id: 'p1', kind: 'person', displayName: 'Timothy Thomas Fortune' };
const org: ClaimEntity = { id: 'o1', kind: 'organization', displayName: 'National Urban League' };
const pub: ClaimEntity = { id: 'pub1', kind: 'publication', displayName: 'The New York Age' };
const law: ClaimEntity = { id: 'law1', kind: 'law', displayName: 'Thirteenth Amendment' };
const allEntities = [person, org, pub, law];

test('findEntityMention: finds a mentioned entity by display name, excluding the claim subject', () => {
  const found = findEntityMention('was employed by National Urban League', allEntities, person.id);
  assert.equal(found?.id, org.id);
});

test('findEntityMention: returns undefined when no known entity is named', () => {
  const found = findEntityMention('was a prominent journalist', allEntities, person.id);
  assert.equal(found, undefined);
});

test('findEntityMention: never matches the excluded entity itself', () => {
  const found = findEntityMention(
    'Timothy Thomas Fortune was born in Florida',
    allEntities,
    person.id,
  );
  assert.equal(found, undefined);
});

test('findEntityMention: prefers the longer of two overlapping name matches', () => {
  const short: ClaimEntity = { id: 's1', kind: 'organization', displayName: 'Age' };
  const found = findEntityMention('wrote for The New York Age', [pub, short], person.id);
  assert.equal(found?.id, pub.id);
});

test('kind-pair matrix: accepts a documented pair', () => {
  assert.equal(isKindPairValid('person', 'organization', 'founded'), true);
});

test('kind-pair matrix: rejects an undocumented pair', () => {
  assert.equal(isKindPairValid('place', 'person', 'founded'), false);
});

test('kind-pair matrix: rejects a candidate whose kind pair is not in the matrix', () => {
  const place: ClaimEntity = { id: 'pl1', kind: 'place', displayName: 'Selma, Alabama' };
  const claim: ClaimRow = {
    claimId: 'c1',
    entity: place,
    predicate: 'founded',
    object: 'National Urban League in 1910',
  };
  const result = extractCandidate(claim, [place, org]);
  assert.equal('reason' in result && result.reason, 'kind_pair_not_in_matrix');
});

test('kind-pair matrix: accepts a well-formed person-founded-organization claim', () => {
  const claim: ClaimRow = {
    claimId: 'c2',
    entity: person,
    predicate: 'founded',
    object: 'the National Urban League in 1910',
  };
  const result = extractCandidate(claim, allEntities);
  assert.equal('reason' in result, false);
  if (!('reason' in result)) {
    assert.equal(result.relationshipType, 'founded');
    assert.equal(result.fromEntityId, person.id);
    assert.equal(result.toEntityId, org.id);
  }
});

const lawEntity: ClaimEntity = { id: 'law2', kind: 'law', displayName: 'HOLC redlining maps' };
const placeEntity: ClaimEntity = { id: 'pl2', kind: 'place', displayName: 'Sweet Auburn' };

test('temporal gate: skips a caused-type candidate with no identifiable year', () => {
  const claim: ClaimRow = {
    claimId: 'c3',
    entity: lawEntity,
    predicate: 'caused',
    object: 'disinvestment in Sweet Auburn',
  };
  const result = extractCandidate(claim, [lawEntity, placeEntity]);
  assert.equal('reason' in result && result.reason, 'needs_temporal_context');
});

test('temporal gate: stages a caused-type candidate when a year is present', () => {
  const claim: ClaimRow = {
    claimId: 'c4',
    entity: lawEntity,
    predicate: 'caused',
    object: 'measurable disinvestment in Sweet Auburn starting in 1937',
  };
  const result = extractCandidate(claim, [lawEntity, placeEntity]);
  assert.equal('reason' in result, false);
  if (!('reason' in result)) {
    assert.equal(result.temporalContext?.validFrom, '1937-01-01');
  }
});

test('temporal gate: does not require temporal context for non-causal types', () => {
  const claim: ClaimRow = {
    claimId: 'c5',
    entity: person,
    predicate: 'was employed by',
    object: 'National Urban League',
  };
  const result = extractCandidate(claim, allEntities);
  assert.equal('reason' in result, false);
});

test('temporal gate: gates all hard-required causal types (enabled, influenced, overturned)', () => {
  const movement: ClaimEntity = {
    id: 'mv1',
    kind: 'movement',
    displayName: 'Civil Rights Movement',
  };
  const laterCase: ClaimEntity = {
    id: 'case1',
    kind: 'case',
    displayName: 'Brown v. Board of Education',
  };
  const earlierCase: ClaimEntity = { id: 'case2', kind: 'case', displayName: 'Plessy v. Ferguson' };
  const fixtures: Array<[ClaimEntity, string, ClaimEntity]> = [
    [lawEntity, 'enabled', movement],
    [person, 'influenced', movement],
    [laterCase, 'overturned', earlierCase],
  ];
  for (const [entity, predicate, target] of fixtures) {
    const claim: ClaimRow = {
      claimId: `c-${predicate}`,
      entity,
      predicate,
      object: target.displayName,
    };
    const result = extractCandidate(claim, [entity, target]);
    assert.equal(
      'reason' in result && result.reason,
      'needs_temporal_context',
      `predicate=${predicate}`,
    );
  }
});

test('rejects a claim whose predicate matches no known pattern', () => {
  const claim: ClaimRow = {
    claimId: 'c6',
    entity: person,
    predicate: 'is remembered as',
    object: 'a pioneering editor',
  };
  const result = extractCandidate(claim, allEntities);
  assert.equal('reason' in result && result.reason, 'no_pattern_match');
});

test('rejects a claim with a matched pattern but no named second entity', () => {
  const claim: ClaimRow = {
    claimId: 'c7',
    entity: person,
    predicate: 'founded',
    object: 'a small local newspaper',
  };
  const result = extractCandidate(claim, allEntities);
  assert.equal('reason' in result && result.reason, 'no_entity_mention');
});

test('extractCandidates: splits results into candidates and rejected', () => {
  const claims: ClaimRow[] = [
    {
      claimId: 'c8',
      entity: person,
      predicate: 'founded',
      object: 'National Urban League in 1910',
    },
    { claimId: 'c9', entity: person, predicate: 'is remembered as', object: 'a pioneer' },
  ];
  const { candidates, rejected } = extractCandidates(claims, allEntities);
  assert.equal(candidates.length, 1);
  assert.equal(rejected.length, 1);
});

test('evidence attachment: attaches the source claim id as evidence on every staged row', async () => {
  const claim: ClaimRow = {
    claimId: 'claim_abc_01',
    entity: person,
    predicate: 'founded',
    object: 'National Urban League in 1910',
  };
  const result = extractCandidate(claim, allEntities);
  assert.equal('reason' in result, false);
  if ('reason' in result) return;

  let staged: readonly RelationshipCandidateRow[] = [];
  await stageRelationshipCandidates(
    [result],
    'run_test_1',
    async (rows) => {
      staged = rows;
    },
    () => '2026-07-24T00:00:00.000Z',
  );

  assert.equal(staged.length, 1);
  assert.deepEqual(staged[0]?.provenance.claim_ids, ['claim_abc_01']);
  assert.equal(staged[0]?.lane, 'claims-relationship');
  assert.equal(staged[0]?.status, 'pending');
  assert.equal(staged[0]?.payload.from_entity_id, person.id);
  assert.equal(staged[0]?.payload.to_entity_id, org.id);
});

test('evidence attachment: never stages a row with zero evidence ids', async () => {
  const claim: ClaimRow = {
    claimId: 'claim_xyz_01',
    entity: person,
    predicate: 'employed by',
    object: 'National Urban League',
  };
  const result = extractCandidate(claim, allEntities);
  assert.equal('reason' in result, false);
  if ('reason' in result) return;

  let staged: readonly RelationshipCandidateRow[] = [];
  await stageRelationshipCandidates([result], 'run_test_2', async (rows) => {
    staged = rows;
  });
  assert.ok((staged[0]?.provenance.claim_ids.length ?? 0) > 0);
});
