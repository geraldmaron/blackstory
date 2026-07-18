/**
 * Tests for the unified naming/identifier contracts + uniqueness invariant (black-book-8bck).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CanonicalEntity } from './entity.js';
import {
  findIdentifierUniquenessViolations,
  isTrustedIdentifierNamespace,
  migrateEntityIdentifiers,
  migrateEntityNames,
  type EntityIdentifierRecord,
} from './naming.js';

const NOW = '2026-07-17T00:00:00.000Z';

test('isTrustedIdentifierNamespace recognizes external authority-control namespaces only', () => {
  assert.ok(isTrustedIdentifierNamespace('wikidata'));
  assert.ok(isTrustedIdentifierNamespace('NRHP'));
  assert.ok(isTrustedIdentifierNamespace(' Loc '));
  assert.equal(isTrustedIdentifierNamespace('archives'), false);
  assert.equal(isTrustedIdentifierNamespace('internal-accession'), false);
});

test('migrateEntityNames unifies displayName, aliases, school names, and place historicalNames', () => {
  const entity: CanonicalEntity = {
    id: 'ent-school-1',
    kind: 'school',
    displayName: 'Washington Heritage Academy',
    aliases: [{ value: 'WHA', kind: 'aka', primary: false }],
    school: {
      names: [
        { name: 'Booker T. Washington High School', validFrom: '1924', validTo: '1971' },
        { name: 'Washington Heritage Academy', validFrom: '1972', primary: true },
      ],
      campuses: [],
      milestones: [],
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
  const names = migrateEntityNames(entity);
  assert.equal(names.length, 4);
  assert.ok(names.some((name) => name.value === 'Washington Heritage Academy' && name.isPreferred));
  assert.ok(names.some((name) => name.value === 'WHA' && name.nameType === 'aka'));
  assert.ok(
    names.some((name) => name.value === 'Booker T. Washington High School' && name.validTo === '1971'),
  );
  assert.ok(names.every((name) => name.entityId === 'ent-school-1'));
  assert.ok(names.every((name) => name.normalizedValue === name.normalizedValue.toLowerCase()));
});

test('migrateEntityNames folds place.historicalNames in as historical entries', () => {
  const entity: CanonicalEntity = {
    id: 'ent-place-1',
    kind: 'place',
    displayName: 'Current Name',
    place: { historicalNames: ['Old Name One', 'Old Name Two'] },
    createdAt: NOW,
    updatedAt: NOW,
  };
  const names = migrateEntityNames(entity);
  assert.deepEqual(
    names.filter((name) => name.nameType === 'historical').map((name) => name.value),
    ['Old Name One', 'Old Name Two'],
  );
});

test('migrateEntityIdentifiers carries system -> namespace', () => {
  const entity: CanonicalEntity = {
    id: 'ent-org-1',
    kind: 'organization',
    displayName: 'Freedom League',
    identifiers: [{ system: 'wikidata', value: 'Q12345' }],
    createdAt: NOW,
    updatedAt: NOW,
  };
  const identifiers = migrateEntityIdentifiers(entity);
  assert.deepEqual(identifiers, [
    {
      entityId: 'ent-org-1',
      namespace: 'wikidata',
      value: 'Q12345',
      normalizedValue: 'q12345',
      evidenceIds: [],
    },
  ]);
});

test('findIdentifierUniquenessViolations flags a namespace/value pair claimed by 2+ entities', () => {
  const records: readonly EntityIdentifierRecord[] = [
    { entityId: 'ent-a', namespace: 'wikidata', value: 'Q1', normalizedValue: 'q1', evidenceIds: [] },
    { entityId: 'ent-b', namespace: 'wikidata', value: 'Q1', normalizedValue: 'q1', evidenceIds: [] },
    { entityId: 'ent-c', namespace: 'wikidata', value: 'Q2', normalizedValue: 'q2', evidenceIds: [] },
  ];
  const violations = findIdentifierUniquenessViolations(records);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.namespace, 'wikidata');
  assert.equal(violations[0]!.normalizedValue, 'q1');
  assert.deepEqual(new Set(violations[0]!.entityIds), new Set(['ent-a', 'ent-b']));
});

test('findIdentifierUniquenessViolations exempts entities explicitly flagged ambiguous', () => {
  const records: readonly EntityIdentifierRecord[] = [
    { entityId: 'ent-a', namespace: 'wikidata', value: 'Q1', normalizedValue: 'q1', evidenceIds: [] },
    { entityId: 'ent-b', namespace: 'wikidata', value: 'Q1', normalizedValue: 'q1', evidenceIds: [] },
  ];
  const violations = findIdentifierUniquenessViolations(records, {
    ambiguousEntityIds: new Set(['ent-b']),
  });
  assert.equal(violations.length, 0);
});
