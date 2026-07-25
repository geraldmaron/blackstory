/**
 * Confirms `/stories` list items strip body/related fields and preserve seed
 * corpus order via `toStoryListItem`. The live `/stories` index reads Postgres
 * projections only (no snapshot fallback), so runtime list assembly is covered
 * by integration tests, not here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listSeedStoryProjections } from '@repo/domain';
import { toStoryListItem } from './public-readers';

test('toStoryListItem omits body, relatedEntityIds, and sources', () => {
  const full = listSeedStoryProjections()[0];
  assert.ok(full);
  assert.ok(full.body.length > 0);
  assert.ok(full.sources.length > 0);

  const item = toStoryListItem(full);
  assert.equal(item.slug, full.slug);
  assert.equal(item.title, full.title);
  assert.equal(item.dek, full.dek);
  assert.equal(item.eraLabel, full.eraLabel);
  assert.equal(item.placeLabel, full.placeLabel);
  assert.equal(item.publishedAt, full.publishedAt);
  assert.equal('body' in item, false);
  assert.equal('relatedEntityIds' in item, false);
  assert.equal('sources' in item, false);
});

test('mapping the seed corpus preserves length and order', () => {
  const full = listSeedStoryProjections();
  const items = full.map(toStoryListItem);
  assert.equal(items.length, full.length);
  assert.equal(items.length, 5);
  for (let i = 0; i < full.length; i += 1) {
    assert.equal(items[i]?.slug, full[i]?.slug);
    assert.equal(items[i]?.title, full[i]?.title);
  }
});
