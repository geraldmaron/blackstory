/**
 * The Mississippi collection: one slot and one address per entry, every call-out carries a
 * citation that resolves to one of the entry's own references, and nothing ships published
 * until a reviewer promotes it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mississippiStories } from './mississippi.ts';

test('collection positions and slugs are unique', () => {
  const positions = mississippiStories.map((story) => story.collection.position);
  assert.equal(new Set(positions).size, positions.length);
  const slugs = mississippiStories.map((story) => story.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('every citation marker resolves to a reference on the same entry', () => {
  for (const story of mississippiStories) {
    const ids = new Set(story.references.map((reference) => reference.id));
    const text = JSON.stringify(story.body);
    for (const match of text.matchAll(/\[ref:([a-z0-9-]+)\]/g)) {
      assert.ok(ids.has(match[1] ?? ''), `${story.slug} cites unknown reference ${match[1]}`);
    }
  }
});

test('every call-out carries at least one citation', () => {
  for (const story of mississippiStories) {
    for (const block of story.body) {
      if (block.type !== 'list') continue;
      for (const item of (block as { items?: readonly string[] }).items ?? []) {
        assert.match(item, /\[ref:[a-z0-9-]+\]/, `${story.slug}: uncited call-out "${item}"`);
      }
    }
  }
});

test('the collection is a draft until promoted', () => {
  for (const story of mississippiStories) assert.equal(story.status, 'draft');
});
