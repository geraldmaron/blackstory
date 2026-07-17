/**
 * Tests for embedding text construction and pre-filter derivation (BB-071).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEntityEmbeddingText,
  deriveEntityFilters,
  deriveEraBucket,
  resolveEntityYearSpan,
  type EntityEmbeddingSource,
} from './text.js';

test('buildEntityEmbeddingText folds title, summary, place, and era into one string', () => {
  const entity: EntityEmbeddingSource = {
    kind: 'person',
    displayName: 'Ada Example',
    person: {
      livingStatus: 'deceased',
      birthYear: 1920,
      deathYear: 1990,
      biographySummary: 'Organized the local sit-in movement.',
    },
  };

  const text = buildEntityEmbeddingText(entity, { placeLabel: 'Greensboro, NC' });
  assert.match(text, /Ada Example/);
  assert.match(text, /Organized the local sit-in movement\./);
  assert.match(text, /Place: Greensboro, NC/);
  assert.match(text, /Era: 1920–1990/);
});

test('buildEntityEmbeddingText includes aliases when present', () => {
  const entity: EntityEmbeddingSource = {
    kind: 'school',
    displayName: 'Central High',
    aliases: [{ value: 'Central Colored High' }, { value: 'CHS' }],
  };
  const text = buildEntityEmbeddingText(entity);
  assert.match(text, /Also known as: Central Colored High, CHS/);
});

test('buildEntityEmbeddingText omits empty sections without leaving blank lines', () => {
  const entity: EntityEmbeddingSource = { kind: 'other', displayName: 'Bare Entity' };
  const text = buildEntityEmbeddingText(entity);
  assert.equal(text, 'Bare Entity');
});

test('resolveEntityYearSpan reads kind-specific temporal fields', () => {
  assert.deepEqual(
    resolveEntityYearSpan({
      kind: 'organization',
      displayName: 'x',
      organization: { foundedYear: 1955, dissolvedYear: 1970 },
    }),
    { startYear: 1955, endYear: 1970 },
  );

  assert.deepEqual(
    resolveEntityYearSpan({
      kind: 'event',
      displayName: 'x',
      event: { startAt: '1960-02-01', endAt: null },
    }),
    { startYear: 1960 },
  );

  assert.deepEqual(resolveEntityYearSpan({ kind: 'place', displayName: 'x' }), {});
});

test('deriveEraBucket buckets by decade and is undefined without any temporal anchor', () => {
  assert.equal(
    deriveEraBucket({
      kind: 'person',
      displayName: 'x',
      person: { livingStatus: 'deceased', birthYear: 1957, deathYear: null },
    }),
    '1950s',
  );
  assert.equal(deriveEraBucket({ kind: 'place', displayName: 'x' }), undefined);
});

test('deriveEntityFilters combines kind, resolved state, and eraBucket', () => {
  const entity: EntityEmbeddingSource = {
    kind: 'event',
    displayName: 'Sit-in',
    event: { startAt: '1960-02-01' },
  };
  assert.deepEqual(deriveEntityFilters(entity, { state: 'nc' }), {
    kind: 'event',
    state: 'NC',
    eraBucket: '1960s',
  });
  assert.deepEqual(deriveEntityFilters({ kind: 'place', displayName: 'x' }), { kind: 'place' });
});
