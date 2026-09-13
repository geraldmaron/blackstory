/**
 * Unit tests for the Postgres discovery catalog loader (no live DB — an injectable
 * `Pick<pg.Pool, 'query'>` fake stands in, same pattern as
 * `entity-enrichment-selector.test.ts` in `@repo/ops-data`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDiscoveryCatalogQuery,
  loadDiscoveryCatalogProfilesFromPostgres,
  resolutionProfileFromSearchIndexRow,
  type DiscoveryCatalogQueryable,
  type SearchIndexCatalogRow,
} from './discovery-catalog-postgres.js';

const NOW = '2026-09-12T00:00:00.000Z';

test('buildDiscoveryCatalogQuery joins the active release and parameterizes the limit', () => {
  const { sql, params } = buildDiscoveryCatalogQuery({ limit: 500 });
  assert.match(sql, /FROM bb_public\.search_index si/);
  assert.match(sql, /JOIN bb_public\.v_active_release_id v ON v\.release_id = si\.release_id/);
  assert.match(sql, /LIMIT \$1/);
  assert.deepEqual(params, [500]);
});

test('resolutionProfileFromSearchIndexRow maps a well-formed row to a ResolutionProfile', () => {
  const row: SearchIndexCatalogRow = {
    entity_id: 'ent_rosa_parks',
    name: 'Rosa Parks',
    kind: 'person',
    aliases: ['Rosa Louise McCauley'],
  };
  const profile = resolutionProfileFromSearchIndexRow(row, NOW);
  assert.ok(profile);
  assert.equal(profile?.entity.id, 'ent_rosa_parks');
  assert.equal(profile?.entity.kind, 'person');
  assert.equal(profile?.entity.displayName, 'Rosa Parks');
  assert.deepEqual(profile?.entity.aliases, [{ value: 'Rosa Louise McCauley', kind: 'aka' }]);
  assert.equal(profile?.entity.createdAt, NOW);
  assert.equal(profile?.entity.updatedAt, NOW);
});

test('resolutionProfileFromSearchIndexRow omits aliases when there are none', () => {
  const row: SearchIndexCatalogRow = {
    entity_id: 'ent_x',
    name: 'X Place',
    kind: 'place',
    aliases: [],
  };
  const profile = resolutionProfileFromSearchIndexRow(row, NOW);
  assert.equal(profile?.entity.aliases, undefined);
});

test('resolutionProfileFromSearchIndexRow rejects a row with a missing or unknown kind', () => {
  assert.equal(
    resolutionProfileFromSearchIndexRow(
      { entity_id: 'ent_x', name: 'X', kind: null, aliases: null },
      NOW,
    ),
    undefined,
  );
  assert.equal(
    resolutionProfileFromSearchIndexRow(
      { entity_id: 'ent_x', name: 'X', kind: 'not-a-real-kind', aliases: null },
      NOW,
    ),
    undefined,
  );
});

test('resolutionProfileFromSearchIndexRow rejects a row missing entity_id or name', () => {
  assert.equal(
    resolutionProfileFromSearchIndexRow(
      { entity_id: null, name: 'X', kind: 'place', aliases: null },
      NOW,
    ),
    undefined,
  );
  assert.equal(
    resolutionProfileFromSearchIndexRow(
      { entity_id: 'ent_x', name: null, kind: 'place', aliases: null },
      NOW,
    ),
    undefined,
  );
});

test('loadDiscoveryCatalogProfilesFromPostgres runs the built query and drops unusable rows', async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const rows: SearchIndexCatalogRow[] = [
    { entity_id: 'ent_a', name: 'Alpha Place', kind: 'place', aliases: [] },
    { entity_id: 'ent_b', name: 'Bad Kind', kind: 'not-a-real-kind', aliases: null },
    { entity_id: 'ent_c', name: 'Carter School', kind: 'school', aliases: ['Carter High'] },
  ];
  const fakePool: DiscoveryCatalogQueryable = {
    query: (async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return { rows };
    }) as DiscoveryCatalogQueryable['query'],
  };

  const profiles = await loadDiscoveryCatalogProfilesFromPostgres({ pool: fakePool, nowIso: NOW });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.params, [5_000]);
  assert.equal(profiles.length, 2);
  assert.deepEqual(
    profiles.map((profile) => profile.entity.id),
    ['ent_a', 'ent_c'],
  );
});

test('loadDiscoveryCatalogProfilesFromPostgres clamps maxProfiles into [1, 10000]', async () => {
  const calls: unknown[][] = [];
  const fakePool: DiscoveryCatalogQueryable = {
    query: (async (_sql: string, params: unknown[]) => {
      calls.push(params);
      return { rows: [] };
    }) as DiscoveryCatalogQueryable['query'],
  };

  await loadDiscoveryCatalogProfilesFromPostgres({ pool: fakePool, maxProfiles: 999_999 });
  await loadDiscoveryCatalogProfilesFromPostgres({ pool: fakePool, maxProfiles: 0 });

  assert.deepEqual(calls[0], [10_000]);
  assert.deepEqual(calls[1], [1]);
});
