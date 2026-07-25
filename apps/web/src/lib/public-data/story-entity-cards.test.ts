/**
 * Confirms story-related entity cards (and about mosaic) use the thin batched
 * loader (`listPublicEntityViewsByIds`) without requiring full entity-page /
 * full-catalog hydration. The loader is live-Postgres-only (no seed fallback),
 * so request-order and dedup over real rows are covered by integration tests
 * (see repo tracker); here we cover the DB-independent behavior: empty/normalized
 * input and the bounded mosaic id set.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATMOSPHERE_TILE_CREDITS } from '../../components/atmosphere/tile-credits';
import { listPublicEntityViewsByIds } from './source';

test('listPublicEntityViewsByIds returns empty for empty input', async () => {
  const { data, source } = await listPublicEntityViewsByIds([]);
  assert.equal(source, 'none');
  assert.equal(data.length, 0);
});

test('listPublicEntityViewsByIds normalizes to empty for blank/whitespace ids', async () => {
  const { data, source } = await listPublicEntityViewsByIds(['', '   ']);
  assert.equal(source, 'none');
  assert.equal(data.length, 0);
});

test('about mosaic tile ids are a bounded set suitable for thin ByIds loads', () => {
  const mosaicIds = [
    ...new Set(ATMOSPHERE_TILE_CREDITS.map((tile) => tile.entityId).filter(Boolean)),
  ];
  assert.ok(mosaicIds.length >= 1);
  assert.ok(mosaicIds.length <= 400, 'mosaic must stay far below a full national catalog scan');
});
