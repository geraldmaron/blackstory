/**
 * Tests for coarse entity classification (black-book-9mox).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTITY_KINDS } from './entity-kinds.js';
import {
  ENTITY_CLASSES,
  ENTITY_TYPES_BY_CLASS,
  deriveEntityClassification,
  isControlledEntityType,
  isEntityClass,
} from './entity-class.js';

test('isEntityClass recognizes the 7 coarse classes only', () => {
  for (const value of ENTITY_CLASSES) assert.ok(isEntityClass(value));
  assert.equal(isEntityClass('school'), false);
  assert.equal(isEntityClass('institution'), false);
});

test('deriveEntityClassification maps every current kind except other', () => {
  for (const kind of ENTITY_KINDS) {
    const classification = deriveEntityClassification(kind);
    if (kind === 'other') {
      assert.equal(classification, undefined, '"other" is intentionally unclassified');
      continue;
    }
    assert.ok(classification, `expected a classification for kind "${kind}"`);
    assert.ok(isEntityClass(classification!.entityClass));
    assert.ok(classification!.entityTypes.length > 0);
  }
});

test('ambiguous kinds (school, institution) coarsen into organization, not their own class', () => {
  assert.deepEqual(deriveEntityClassification('school'), {
    entityClass: 'organization',
    entityTypes: ['school'],
  });
  assert.deepEqual(deriveEntityClassification('institution'), {
    entityClass: 'organization',
    entityTypes: ['institution'],
  });
  assert.deepEqual(deriveEntityClassification('organization'), {
    entityClass: 'organization',
    entityTypes: ['organization'],
  });
});

test('law and case land in legal; publication and artifact land in work', () => {
  assert.equal(deriveEntityClassification('law')!.entityClass, 'legal');
  assert.equal(deriveEntityClassification('case')!.entityClass, 'legal');
  assert.equal(deriveEntityClassification('publication')!.entityClass, 'work');
  assert.equal(deriveEntityClassification('artifact')!.entityClass, 'work');
});

test('isControlledEntityType validates against the per-class registry', () => {
  assert.ok(isControlledEntityType('organization', 'church'));
  assert.equal(isControlledEntityType('organization', 'spaceship'), false);
  for (const entityClass of ENTITY_CLASSES) {
    assert.ok(ENTITY_TYPES_BY_CLASS[entityClass].length > 0);
  }
});
