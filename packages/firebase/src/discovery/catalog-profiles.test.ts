/**
 * Unit tests for soft discovery catalog profile loading (propose/review, never hard-exclude).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX,
  createPublicSearchIndexCatalogPager,
  loadDiscoveryCatalogProfiles,
  publicSearchIndexDocFromRow,
  resolutionProfileFromCatalogLeaf,
} from './catalog-profiles.js';

test('publicSearchIndexDocFromRow skips unknown kinds and empty names', () => {
  assert.equal(
    publicSearchIndexDocFromRow({
      id: 'x',
      data: () => ({ displayName: 'A', kind: 'not-a-kind' }),
    }),
    undefined,
  );
  assert.equal(
    publicSearchIndexDocFromRow({
      id: 'y',
      data: () => ({ displayName: '   ', kind: 'person' }),
    }),
    undefined,
  );
});

test('resolutionProfileFromCatalogLeaf maps aliases for soft match', () => {
  const profile = resolutionProfileFromCatalogLeaf(
    {
      id: 'ent_rosa',
      kind: 'person',
      displayName: 'Rosa Parks',
      aliases: ['Rosa Louise McCauley Parks'],
    },
    '2026-07-18T12:00:00.000Z',
  );
  assert.equal(profile.entity.id, 'ent_rosa');
  assert.deepEqual(profile.entity.aliases, [{ value: 'Rosa Louise McCauley Parks', kind: 'aka' }]);
});

test('loadDiscoveryCatalogProfiles pages until max and reports truncation', async () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    id: `ent_${i}`,
    data: () => ({
      displayName: `Person ${i}`,
      kind: 'person',
      aliases: [],
    }),
  }));
  let calls = 0;
  const pager = createPublicSearchIndexCatalogPager({
    async page(input) {
      calls += 1;
      const start =
        input.cursor === undefined ? 0 : rows.findIndex((row) => row.id === input.cursor) + 1;
      const slice = rows.slice(start, start + input.limit);
      return { docs: slice };
    },
  });

  const loaded = await loadDiscoveryCatalogProfiles({
    pager,
    maxProfiles: 3,
    nowIso: '2026-07-18T12:00:00.000Z',
  });

  assert.equal(loaded.profiles.length, 3);
  assert.equal(loaded.truncated, true);
  assert.deepEqual(loaded.catalogTitles, ['Person 0', 'Person 1', 'Person 2']);
  assert.ok(calls >= 1);
});

test('loadDiscoveryCatalogProfiles returns empty without hard-failing', async () => {
  const pager = createPublicSearchIndexCatalogPager({
    async page() {
      return { docs: [] };
    },
  });
  const loaded = await loadDiscoveryCatalogProfiles({ pager, maxProfiles: 10 });
  assert.deepEqual(loaded.profiles, []);
  assert.equal(loaded.truncated, false);
});

test('DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX is a finite seed-safe cap', () => {
  assert.equal(DISCOVERY_CATALOG_PROFILE_DEFAULT_MAX, 500);
});
