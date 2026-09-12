/**
 * Parity between the TypeScript relationship vocabulary and the database CHECK constraint.
 *
 * The constraint is the thing that decides which rows exist; this list is the thing that decides
 * which rows the read side can render. When the two disagree the disagreement shows up as records
 * that 404. The constraint text is parsed out of the migration and compared as an exact set, so
 * widening one side without the other fails here instead of in production.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DB_RELATIONSHIP_TYPES,
  LEGACY_DB_RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPES,
  relationshipTypeSchema,
} from './relationship-vocabulary.ts';

const MIGRATION_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations/20260908120000_invention_kind_and_contribution_predicates.sql',
);

/**
 * Pulls the quoted values out of `CHECK (relationship_type IN ( ... ))`, walking parentheses to
 * find the end of the list and dropping `--` comments so the commentary inside the constraint
 * cannot be mistaken for values.
 */
function parseRelationshipTypeCheckValues(sql: string): string[] {
  const marker = 'CHECK (relationship_type IN (';
  const markerIndex = sql.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'migration has no relationship_type CHECK constraint');

  const listStart = markerIndex + marker.length;
  let depth = 1;
  let cursor = listStart;
  while (cursor < sql.length && depth > 0) {
    const character = sql[cursor];
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    cursor += 1;
  }
  assert.equal(depth, 0, 'relationship_type CHECK constraint has unbalanced parentheses');

  const body = sql.slice(listStart, cursor - 1).replace(/--[^\n]*/g, '');
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

const constraintValues = parseRelationshipTypeCheckValues(readFileSync(MIGRATION_PATH, 'utf8'));

test('the migration CHECK constraint parses into a duplicate-free list', () => {
  assert.ok(constraintValues.length > 0, 'parsed no values out of the CHECK constraint');
  assert.equal(
    new Set(constraintValues).size,
    constraintValues.length,
    'the CHECK constraint lists a value twice',
  );
});

test('DB_RELATIONSHIP_TYPES equals the CHECK constraint exactly', () => {
  assert.deepEqual(
    [...DB_RELATIONSHIP_TYPES].sort(),
    [...constraintValues].sort(),
    'the TypeScript vocabulary and the database CHECK constraint have drifted apart; add the ' +
      'missing value to RELATIONSHIP_TYPES (with a RELATIONSHIP_TYPE_SEMANTICS entry) or to ' +
      'LEGACY_DB_RELATIONSHIP_TYPES, or widen the constraint in a new migration',
  );
});

test('the write-side list plus the documented legacy values makes up the whole constraint', () => {
  assert.deepEqual(
    [...DB_RELATIONSHIP_TYPES],
    [...RELATIONSHIP_TYPES, ...LEGACY_DB_RELATIONSHIP_TYPES],
    'DB_RELATIONSHIP_TYPES must stay the concatenation of the two lists',
  );
  assert.equal(RELATIONSHIP_TYPES.length, 36);
  assert.equal(LEGACY_DB_RELATIONSHIP_TYPES.length, 5);
  assert.equal(constraintValues.length, 41);
});

test('the legacy values are database-only and never in the write-side vocabulary', () => {
  for (const legacyType of LEGACY_DB_RELATIONSHIP_TYPES) {
    assert.ok(
      !(RELATIONSHIP_TYPES as readonly string[]).includes(legacyType),
      `"${legacyType}" has no documented edge semantics and must not be a write-side type`,
    );
    assert.ok(
      constraintValues.includes(legacyType),
      `"${legacyType}" is listed as legacy but the constraint no longer admits it`,
    );
  }
});

test('every constraint value parses to itself', () => {
  for (const value of constraintValues) {
    assert.equal(relationshipTypeSchema.parse(value), value);
  }
});

test('an unknown relationship type degrades to other and warns with the value', () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    assert.equal(relationshipTypeSchema.parse('teleported_to'), 'other');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0] as string, /teleported_to/);
  assert.match(warnings[0] as string, /unknown relationship type/);
});
