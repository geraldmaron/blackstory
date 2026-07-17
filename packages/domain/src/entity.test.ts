/**
 * Tests for CanonicalEntity's BB-090 ontology extensions: kind-specific status lifecycle,
 * notability basis, sensitivity schema, and the 12th `movement` entity kind.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentEntityStatus, type CanonicalEntity } from './entity.js';
import { ENTITY_KINDS } from './entity-kinds.js';

const NOW = '2026-07-17T00:00:00.000Z';

test('ENTITY_KINDS carries all 12 kinds including the new movement kind', () => {
  assert.equal(ENTITY_KINDS.length, 12);
  assert.ok(ENTITY_KINDS.includes('movement'));
});

test('currentEntityStatus derives place-like status from the open-ended statusHistory record', () => {
  const school: CanonicalEntity = {
    id: 'ent-school-1',
    kind: 'school',
    displayName: 'Freedmen School',
    statusHistory: [
      {
        status: 'active',
        validFrom: '1868',
        validTo: '1954',
        datePrecision: 'year',
        basisClaimIds: ['claim-1'],
      },
      {
        status: 'historic',
        validFrom: '1954',
        datePrecision: 'year',
        basisClaimIds: ['claim-2'],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
  assert.equal(currentEntityStatus(school), 'historic');
});

test('currentEntityStatus derives law status from the law-specific vocabulary', () => {
  const law: CanonicalEntity = {
    id: 'ent-law-1',
    kind: 'law',
    displayName: 'Example Civil Rights Statute',
    statusHistory: [
      { status: 'in_force', validFrom: '1964', datePrecision: 'year', basisClaimIds: ['claim-3'] },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
  assert.equal(currentEntityStatus(law), 'in_force');
});

test('currentEntityStatus derives person status from livingStatus, not a second field', () => {
  const living: CanonicalEntity = {
    id: 'ent-person-1',
    kind: 'person',
    displayName: 'Jane Doe',
    livingStatus: 'living',
    createdAt: NOW,
    updatedAt: NOW,
  };
  const unknown: CanonicalEntity = { ...living, id: 'ent-person-2', livingStatus: 'unknown' };
  const deceased: CanonicalEntity = { ...living, id: 'ent-person-3', livingStatus: 'deceased' };

  assert.equal(currentEntityStatus(living), 'living');
  assert.equal(currentEntityStatus(unknown), 'living');
  assert.equal(currentEntityStatus(deceased), 'deceased');
});

test('currentEntityStatus is undefined for event kind — the when-span is authoritative', () => {
  const event: CanonicalEntity = {
    id: 'ent-event-1',
    kind: 'event',
    displayName: 'Sit-in',
    event: { startAt: '1960-02-01' },
    createdAt: NOW,
    updatedAt: NOW,
  };
  assert.equal(currentEntityStatus(event), undefined);
});

test('movement kind carries its own field bag and active|historic status (no inactive)', () => {
  const movement: CanonicalEntity = {
    id: 'ent-movement-1',
    kind: 'movement',
    displayName: 'Civil Rights Movement',
    movement: {
      startYear: 1954,
      endYear: 1968,
      keyOrganizationIds: ['ent-org-sclc'],
      keyPersonIds: ['ent-person-mlk'],
      regionJurisdictionIds: ['jurisdiction-us-south'],
      summary: 'A decades-long struggle for Black civil rights in the United States.',
    },
    statusHistory: [
      { status: 'historic', validFrom: '1968', datePrecision: 'year', basisClaimIds: ['claim-4'] },
    ],
    notabilityBasis: [
      {
        criterion: 'movement_significance',
        note: 'The defining civil-rights-era movement in the United States.',
        evidenceIds: ['ev-1'],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
  assert.equal(currentEntityStatus(movement), 'historic');
  assert.equal(movement.movement?.endYear, 1968);
  assert.equal(movement.notabilityBasis?.[0]?.criterion, 'movement_significance');
});

test('entity-level sensitivity is schema-only and carries an auditable basis', () => {
  const entity: CanonicalEntity = {
    id: 'ent-sensitive-1',
    kind: 'person',
    displayName: 'Historical Figure',
    livingStatus: 'deceased',
    sensitivity: [
      {
        class: 'enslaver_or_segregationist',
        note: 'Documented enslaver per primary-source estate records.',
        basisClaimIds: ['claim-5'],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
  assert.equal(entity.sensitivity?.[0]?.class, 'enslaver_or_segregationist');
});
