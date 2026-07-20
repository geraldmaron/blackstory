/**
 * Confirms story-related entity cards (and about mosaic) use the thin batched
 * loader (seed path) and preserve request order without requiring full
 * entity-page / full-catalog hydration. Also checks empty input and that
 * duplicate id lists still resolve once.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATMOSPHERE_TILE_CREDITS } from '../../components/atmosphere/tile-credits';
import { listPublicEntities } from '../../data/public-seed';
import { listPublicEntityViewsByIds } from './source';

test('listPublicEntityViewsByIds returns seed entities in request order', async () => {
  const catalog = listPublicEntities();
  assert.ok(catalog.length >= 2);
  const first = catalog[0]!;
  const second = catalog[1]!;

  const { data, source } = await listPublicEntityViewsByIds([second.id, first.id, 'ent_missing_xx']);
  assert.equal(source, 'snapshot');
  assert.equal(data.length, 2);
  assert.equal(data[0]?.id, second.id);
  assert.equal(data[1]?.id, first.id);
});

test('listPublicEntityViewsByIds returns empty for empty input', async () => {
  const { data, source } = await listPublicEntityViewsByIds([]);
  assert.equal(source, 'none');
  assert.equal(data.length, 0);
});

test('listPublicEntityViewsByIds dedupes ids while preserving first-seen order', async () => {
  const catalog = listPublicEntities();
  assert.ok(catalog.length >= 2);
  const first = catalog[0]!;
  const second = catalog[1]!;

  const { data } = await listPublicEntityViewsByIds([first.id, first.id, second.id, first.id]);
  assert.equal(data.length, 2);
  assert.equal(data[0]?.id, first.id);
  assert.equal(data[1]?.id, second.id);
});

test('about mosaic tile ids are a bounded set suitable for thin ByIds loads', () => {
  const mosaicIds = [
    ...new Set(ATMOSPHERE_TILE_CREDITS.map((tile) => tile.entityId).filter(Boolean)),
  ];
  assert.ok(mosaicIds.length >= 1);
  assert.ok(mosaicIds.length <= 400, 'mosaic must stay far below a full national catalog scan');
});
