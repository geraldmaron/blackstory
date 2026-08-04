/**
 * Proves what an operator may write to a canonical record, and that a field edit can only ever
 * touch the one entity it names.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  afterValueFor,
  beforeValueFor,
  buildEditStatements,
  parseEntityFieldEdit,
  type EditFormValues,
  type EntityFieldEdit,
} from './entity-edit';
import { entityClassForKind } from './entity-vocabulary';

function values(record: Readonly<Record<string, string | readonly string[]>>): EditFormValues {
  return {
    get: (name) => {
      const value = record[name];
      return typeof value === 'string' ? value : null;
    },
    getAll: (name) => {
      const value = record[name];
      if (Array.isArray(value)) return value;
      return typeof value === 'string' ? [value] : [];
    },
  };
}

const OPTIONS = { newId: 'new-uuid' };

test('an unknown field is refused rather than guessed at', () => {
  const parsed = parseEntityFieldEdit(values({ field: 'ownerEmail', value: 'x' }));
  assert.equal(parsed.ok, false);
});

test('display name is trimmed and collapsed, and cannot be emptied', () => {
  const parsed = parseEntityFieldEdit(values({ field: 'displayName', value: '  Ida  B.  Wells ' }));
  assert.deepEqual(parsed, { ok: true, edit: { field: 'displayName', value: 'Ida B. Wells' } });

  assert.equal(parseEntityFieldEdit(values({ field: 'displayName', value: '   ' })).ok, false);
});

test('kind must come from the vocabulary', () => {
  assert.equal(parseEntityFieldEdit(values({ field: 'kind', value: 'person' })).ok, true);
  assert.equal(parseEntityFieldEdit(values({ field: 'kind', value: 'Person' })).ok, false);
  assert.equal(parseEntityFieldEdit(values({ field: 'kind', value: 'monument' })).ok, false);
});

test('a kind change moves entity_class with it in the same statement', () => {
  const statements = buildEditStatements('ent-1', { field: 'kind', value: 'school' }, OPTIONS);

  assert.equal(statements.length, 1);
  assert.match(statements[0]!.sql, /SET kind = \$2, entity_class = \$3/);
  assert.deepEqual(statements[0]!.params, ['ent-1', 'school', 'organization']);
  assert.equal(entityClassForKind('school'), 'organization');
});

test('the `other` kind keeps a null class rather than inventing one', () => {
  const statements = buildEditStatements('ent-1', { field: 'kind', value: 'other' }, OPTIONS);
  assert.deepEqual(statements[0]!.params, ['ent-1', 'other', null]);
});

test('living status accepts not_applicable, the value 88% of rows carry', () => {
  assert.equal(
    parseEntityFieldEdit(values({ field: 'livingStatus', value: 'not_applicable' })).ok,
    true,
  );
  assert.equal(parseEntityFieldEdit(values({ field: 'livingStatus', value: 'alive' })).ok, false);
});

test('aliases split on newlines only, so a comma inside a name survives', () => {
  const parsed = parseEntityFieldEdit(
    values({ field: 'aliases', value: 'Chicago, Illinois\n  Chi-Town  \n\nChicago, Illinois\n' }),
  );

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ok && parsed.edit.value, ['Chicago, Illinois', 'Chi-Town']);
});

test('aliases are capped so a paste cannot balloon the row', () => {
  const many = Array.from({ length: 60 }, (_, index) => `alias ${index}`).join('\n');
  assert.equal(parseEntityFieldEdit(values({ field: 'aliases', value: many })).ok, false);
});

test('sensitivity accepts only the domain vocabulary and replaces the whole set', () => {
  const parsed = parseEntityFieldEdit(
    values({ field: 'sensitivity', sensitivity: ['violence_associated', 'violence_associated'] }),
  );
  assert.deepEqual(parsed.ok && parsed.edit.value, ['violence_associated']);

  assert.equal(
    parseEntityFieldEdit(values({ field: 'sensitivity', sensitivity: ['spicy'] })).ok,
    false,
  );

  // No boxes checked is a real edit — it clears every class.
  const cleared = parseEntityFieldEdit(values({ field: 'sensitivity' }));
  assert.deepEqual(cleared.ok && cleared.edit.value, []);
});

test('sensitivity writes the {class} shape the column actually stores', () => {
  const statements = buildEditStatements(
    'ent-1',
    { field: 'sensitivity', value: ['violence_associated'] },
    OPTIONS,
  );
  assert.deepEqual(JSON.parse(String(statements[0]!.params[1])), [{ class: 'violence_associated' }]);
});

test('adding an identifier already owned by another entity is refused, not moved', () => {
  const statements = buildEditStatements(
    'ent-1',
    { field: 'identifierAdd', value: { namespace: 'wikidata', value: 'Q1', trusted: true } },
    OPTIONS,
  );

  // UNIQUE(namespace, value) is global, so the upsert is scoped to this entity and must match a
  // row; zero rows means another entity owns it.
  assert.match(statements[0]!.sql, /ON CONFLICT \(namespace, value\)/);
  assert.match(statements[0]!.sql, /WHERE bb_canonical\.entity_identifiers\.entity_id = \$1/);
  assert.match(String(statements[0]!.requireRowsElse), /already belongs to a different entity/);
});

test('removing an identifier is scoped to the entity, not the id alone', () => {
  const statements = buildEditStatements(
    'ent-1',
    { field: 'identifierRemove', value: { id: 'ident-9' } },
    OPTIONS,
  );

  assert.match(statements[0]!.sql, /DELETE FROM bb_canonical\.entity_identifiers WHERE id = \$2 AND entity_id = \$1/);
  assert.deepEqual(statements[0]!.params, ['ent-1', 'ident-9']);
});

test('every statement binds the entity id and can never widen past one row', () => {
  const edits: readonly EntityFieldEdit[] = [
    { field: 'displayName', value: 'A' },
    { field: 'kind', value: 'person' },
    { field: 'livingStatus', value: 'deceased' },
    { field: 'aliases', value: ['A'] },
    { field: 'sensitivity', value: [] },
    { field: 'identifierAdd', value: { namespace: 'ns', value: 'v', trusted: false } },
    { field: 'identifierRemove', value: { id: 'i' } },
  ];

  for (const edit of edits) {
    for (const statement of buildEditStatements('ent-1', edit, OPTIONS)) {
      assert.match(statement.sql, /\$1/, `${edit.field} must bind the entity id`);
      assert.equal(statement.params[0], 'ent-1');
      // No value is ever interpolated into the SQL text.
      assert.doesNotMatch(statement.sql, /'A'|deceased|ident-9/);
    }
  }
});

test('every edit produces a before/after pair for the audit record', () => {
  const current = {
    displayName: 'Old Name',
    kind: 'institution',
    entityClass: 'organization',
    livingStatus: 'not_applicable',
    aliases: ['Old'],
    sensitivity: [{ class: 'violence_associated' }],
    identifiers: [{ id: 'i-1', namespace: 'wikidata', value: 'Q1' }],
  };

  assert.equal(beforeValueFor({ field: 'displayName', value: 'New' }, current), 'Old Name');
  assert.equal(afterValueFor({ field: 'displayName', value: 'New' }), 'New');

  assert.deepEqual(beforeValueFor({ field: 'kind', value: 'school' }, current), {
    kind: 'institution',
    entityClass: 'organization',
  });
  assert.deepEqual(afterValueFor({ field: 'kind', value: 'school' }), {
    kind: 'school',
    entityClass: 'organization',
  });

  assert.deepEqual(beforeValueFor({ field: 'sensitivity', value: [] }, current), [
    'violence_associated',
  ]);
  assert.equal(
    beforeValueFor({ field: 'identifierRemove', value: { id: 'i-1' } }, current),
    'wikidata:Q1',
  );
});
