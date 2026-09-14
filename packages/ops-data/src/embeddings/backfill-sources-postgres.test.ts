/**
 * Unit tests for the Postgres embedding backfill source, fully in-memory: no real database, a
 * fake `PostgresQueryExecutor` stands in for `bb_public.release_entities`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPostgresCanonicalEntitySource,
  type PostgresQueryExecutor,
} from './backfill-sources-postgres.js';

function makeQuery(rows: readonly Record<string, unknown>[]): PostgresQueryExecutor {
  return async () => rows as readonly never[];
}

test('createPostgresCanonicalEntitySource resolves state from jurisdictionLabel', async () => {
  const source = createPostgresCanonicalEntitySource(
    makeQuery([
      {
        entity_id: 'ent_key_west_001',
        display_name: 'Key West',
        kind: 'place',
        summary: 'A city in Florida.',
        jurisdiction_label: 'Key West, Florida',
      },
      {
        entity_id: 'ent_calvert_001',
        display_name: 'Calvert',
        kind: 'place',
        summary: null,
        jurisdiction_label: 'Calvert, Texas',
      },
    ]),
  );

  const page = await source.listPage(undefined);
  assert.equal(page.items.length, 2);

  const keyWest = page.items[0]!;
  assert.equal(keyWest.entityId, 'ent_key_west_001');
  assert.equal(keyWest.entity.displayName, 'Key West');
  assert.equal(keyWest.entity.summary, 'A city in Florida.');
  assert.equal(keyWest.location?.state, 'FL');
  assert.equal(keyWest.location?.placeLabel, 'Key West, Florida');

  const calvert = page.items[1]!;
  assert.equal(calvert.location?.state, 'TX');
  assert.equal(calvert.location?.placeLabel, 'Calvert, Texas');
  assert.equal(calvert.entity.summary, undefined);
});

test('createPostgresCanonicalEntitySource resolves D.C. and leaves unparseable labels state-less', async () => {
  const source = createPostgresCanonicalEntitySource(
    makeQuery([
      {
        entity_id: 'ent_dc_001',
        display_name: 'Washington Monument',
        kind: 'place',
        summary: null,
        jurisdiction_label: 'Washington, D.C.',
      },
      {
        entity_id: 'ent_unresolvable_001',
        display_name: 'Some Institution',
        kind: 'institution',
        summary: null,
        jurisdiction_label: 'Not A Real Place',
      },
    ]),
  );

  const page = await source.listPage(undefined);
  assert.equal(page.items[0]!.location?.state, 'DC');

  const unresolvable = page.items[1]!;
  assert.equal(unresolvable.location?.state, undefined);
  assert.equal(unresolvable.location?.placeLabel, 'Not A Real Place');
});

test('createPostgresCanonicalEntitySource omits location entirely when jurisdictionLabel is absent', async () => {
  const source = createPostgresCanonicalEntitySource(
    makeQuery([
      {
        entity_id: 'ent_no_place_001',
        display_name: 'Some Event',
        kind: 'event',
        summary: null,
        jurisdiction_label: null,
      },
    ]),
  );

  const page = await source.listPage(undefined);
  assert.equal(page.items[0]!.location, undefined);
});

test('createPostgresCanonicalEntitySource skips rows missing display_name', async () => {
  const source = createPostgresCanonicalEntitySource(
    makeQuery([
      {
        entity_id: 'ent_blank_001',
        display_name: '   ',
        kind: 'place',
        summary: null,
        jurisdiction_label: 'Austin, Texas',
      },
    ]),
  );

  const page = await source.listPage(undefined);
  assert.deepEqual(page.items, []);
});

test('createPostgresCanonicalEntitySource sets nextCursor only on a full page', async () => {
  const fullPageRow = (id: string) => ({
    entity_id: id,
    display_name: id,
    kind: 'other',
    summary: null,
    jurisdiction_label: null,
  });

  const fullPage = createPostgresCanonicalEntitySource(
    makeQuery([fullPageRow('a'), fullPageRow('b')]),
    2,
  );
  const fullResult = await fullPage.listPage(undefined);
  assert.equal(fullResult.nextCursor, 'b');

  const partialPage = createPostgresCanonicalEntitySource(makeQuery([fullPageRow('a')]), 2);
  const partialResult = await partialPage.listPage(undefined);
  assert.equal(partialResult.nextCursor, undefined);
});
