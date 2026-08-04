/**
 * Rules a bulk edit obeys before any SQL runs (repo-gyq6.6).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_BULK_ENTITIES,
  bulkBeforeStatement,
  bulkUpdateStatement,
  bulkVerbFor,
  checkBulkIds,
  describeBulkEdit,
  parseBulkEdit,
} from './entity-bulk-edit';
import { entityClassForKind } from './entity-vocabulary';

const SENSITIVITY = ['contested_legacy', 'perpetrator_associated'];

test('a kind change carries its derived class — the form never posts the pair', () => {
  const parsed = parseBulkEdit('kind', 'institution', SENSITIVITY);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ok && parsed.edit, {
    field: 'kind',
    kind: 'institution',
    entityClass: 'organization',
  });
  assert.equal(parsed.ok && parsed.edit.field === 'kind' && parsed.edit.entityClass,
    entityClassForKind('institution'));
});

test('the classless kind stays classless rather than being given an invented class', () => {
  const parsed = parseBulkEdit('kind', 'other', SENSITIVITY);
  assert.equal(parsed.ok && parsed.edit.field === 'kind' && parsed.edit.entityClass, null);
});

test('values outside the vocabulary are refused', () => {
  assert.equal(parseBulkEdit('kind', 'wizard', SENSITIVITY).ok, false);
  assert.equal(parseBulkEdit('livingStatus', 'undead', SENSITIVITY).ok, false);
  assert.equal(parseBulkEdit('displayName', 'x', SENSITIVITY).ok, false);
  assert.equal(parseBulkEdit('sensitivity', '', SENSITIVITY, ['made_up']).ok, false);
});

test('sensitivity replaces the whole set, including with nothing', () => {
  const cleared = parseBulkEdit('sensitivity', '', SENSITIVITY, []);
  assert.deepEqual(cleared.ok && cleared.edit, { field: 'sensitivity', classes: [] });
  assert.equal(describeBulkEdit({ field: 'sensitivity', classes: [] }), 'sensitivity to none');
});

test('the id set is deduped, trimmed, and bounded', () => {
  const ok = checkBulkIds([' ent_a ', 'ent_a', 'ent_b', '', '   ']);
  assert.deepEqual(ok.ok && ok.ids, ['ent_a', 'ent_b']);

  assert.equal(checkBulkIds([]).ok, false);
  assert.equal(
    checkBulkIds(Array.from({ length: MAX_BULK_ENTITIES + 1 }, (_, i) => `ent_${i}`)).ok,
    false,
  );
  assert.equal(
    checkBulkIds(Array.from({ length: MAX_BULK_ENTITIES }, (_, i) => `ent_${i}`)).ok,
    true,
  );
});

test('a kind update moves entity_class in the same statement', () => {
  // Splitting these would leave every touched row filed under its old class facet permanently.
  const statement = bulkUpdateStatement(['ent_a'], {
    field: 'kind',
    kind: 'school',
    entityClass: 'organization',
  });
  assert.match(statement.sql, /SET kind = \$2, entity_class = \$3/);
  assert.deepEqual(statement.params, [['ent_a'], 'school', 'organization']);
});

test('every bulk statement skips absorbed records', () => {
  const edits = [
    { field: 'kind', kind: 'person', entityClass: 'person' },
    { field: 'livingStatus', livingStatus: 'deceased' },
    { field: 'sensitivity', classes: ['contested_legacy'] },
  ] as const;
  for (const edit of edits) {
    assert.match(
      bulkUpdateStatement(['ent_a'], edit).sql,
      /IS DISTINCT FROM 'absorbed'/,
      `${edit.field} would edit merge tombstones`,
    );
  }
  assert.match(bulkBeforeStatement(['ent_a'], 'kind').sql, /IS DISTINCT FROM 'absorbed'/);
});

test('sensitivity is written as the schema stores it — objects with a class key', () => {
  const statement = bulkUpdateStatement(['ent_a'], {
    field: 'sensitivity',
    classes: ['contested_legacy'],
  });
  assert.deepEqual(JSON.parse(String(statement.params[1])), [{ class: 'contested_legacy' }]);
});

test('the before-read groups by prior value rather than listing a row each', () => {
  const statement = bulkBeforeStatement(['ent_a', 'ent_b'], 'kind');
  assert.match(statement.sql, /array_agg\(id ORDER BY id\)/);
  assert.match(statement.sql, /GROUP BY 1/);
});

test('kind reassignment reads as its own verb in the audit log', () => {
  assert.equal(bulkVerbFor('kind'), 'entity.bulk_kind_reassign');
  assert.equal(bulkVerbFor('livingStatus'), 'entity.bulk_field_edit');
  assert.equal(bulkVerbFor('sensitivity'), 'entity.bulk_field_edit');
});
