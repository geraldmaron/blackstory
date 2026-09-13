/**
 * Integration coverage for `listPublicEntityViewsByIds` over live Postgres rows (repo-ihsw).
 *
 * `story-entity-cards.test.ts` covers only the DB-independent behavior (empty/blank input,
 * the mosaic id bound) because the loader went live-Postgres-only when the degraded-mode/seed
 * fallback was removed (d9a5c9e5); request-order preservation and dedup can no longer be
 * asserted against seed-backed fixtures. This file proves both against real
 * `bb_public.release_entities` rows.
 *
 * Skips locally when live public projections are not configured (no `PUBLIC_DATA_SOURCE=postgres`
 * + `DATABASE_URL`/`APP_DATABASE_URL`) or the configured Postgres is unreachable; fails closed
 * when `CI_REQUIRE_POSTGRES=1` (mirrors `packages/data-access/src/postgres.integration.test.ts`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUseLivePublicProjections } from './live-policy';
import { fetchActiveRelease } from './public-readers';
import { queryPostgres, __resetPostgresPoolForTests } from './postgres-client';
import { listPublicEntityViewsByIds } from './source';

const REQUIRE = process.env.CI_REQUIRE_POSTGRES === '1';

type EntityIdRow = { readonly entity_id: string };

test('listPublicEntityViewsByIds preserves request order and dedupes repeated ids over live rows', async (t) => {
  if (!shouldUseLivePublicProjections()) {
    t.skip('requires PUBLIC_DATA_SOURCE=postgres + DATABASE_URL/APP_DATABASE_URL (see repo-ihsw)');
    return;
  }

  let active: Awaited<ReturnType<typeof fetchActiveRelease>>;
  let rows: readonly EntityIdRow[];
  try {
    active = await fetchActiveRelease();
    if (!active) throw new Error('no active release');
    rows = await queryPostgres<EntityIdRow>(
      `SELECT entity_id FROM bb_public.release_entities
         WHERE release_id = $1
         ORDER BY entity_id
         LIMIT 3`,
      [active.releaseId],
    );
  } catch (error) {
    if (REQUIRE) throw error;
    t.skip(`live Postgres unreachable: ${(error as Error).message}`);
    return;
  }

  assert.ok(rows.length >= 2, 'need at least 2 live entity ids to prove ordering/dedup');
  const [first, second] = rows.map((row) => row.entity_id) as [string, string];

  // Reversed relative to the id-sorted query, plus a repeated id: catches both a silent
  // switch back to the sorted cache key and a failure to dedupe on first-seen order.
  const requested = [second, first, second, first];
  const { data, source } = await listPublicEntityViewsByIds(requested);

  assert.equal(source, 'live');
  assert.equal(
    data.length,
    2,
    'duplicate ids must collapse to one entry each, in first-seen order',
  );
  assert.deepEqual(
    data.map((entity) => entity.id),
    [second, first],
    'result order must follow request order, not id-sorted order',
  );

  await __resetPostgresPoolForTests();
});
