/**
 * Confirms `/stories` list items strip body/related fields and preserve seed
 * corpus order via `listPublicStoryListItems` / `toStoryListItem`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listSeedStoryProjections } from '@repo/firebase';
import { listSnapshotStoryListItems, toStoryListItem } from './firestore-readers';
import { listPublicStoryListItems } from './source';

test('toStoryListItem omits body and relatedEntityIds', () => {
  const full = listSeedStoryProjections()[0];
  assert.ok(full);
  assert.ok(full.body.length > 0);

  const item = toStoryListItem(full);
  assert.equal(item.slug, full.slug);
  assert.equal(item.title, full.title);
  assert.equal(item.dek, full.dek);
  assert.equal(item.eraLabel, full.eraLabel);
  assert.equal(item.placeLabel, full.placeLabel);
  assert.equal(item.publishedAt, full.publishedAt);
  assert.equal('body' in item, false);
  assert.equal('relatedEntityIds' in item, false);
});

test('listSnapshotStoryListItems matches seed corpus length and order', () => {
  const full = listSeedStoryProjections();
  const items = listSnapshotStoryListItems();
  assert.equal(items.length, full.length);
  assert.equal(items.length, 5);
  for (let i = 0; i < full.length; i += 1) {
    assert.equal(items[i]?.slug, full[i]?.slug);
    assert.equal(items[i]?.title, full[i]?.title);
  }
});

test('listPublicStoryListItems returns empty-safe snapshot list items', async () => {
  const { data, source } = await listPublicStoryListItems();
  assert.equal(source, 'snapshot');
  assert.equal(data.length, 5);
  for (const item of data) {
    assert.ok(item.slug.length > 0);
    assert.ok(item.title.length > 0);
    assert.ok(item.dek.length > 0);
    assert.equal('body' in item, false);
    assert.equal('relatedEntityIds' in item, false);
  }
});
