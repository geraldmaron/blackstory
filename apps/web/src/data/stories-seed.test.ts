/**
 * Sanity checks for the Stories seed catalog.
 * National-catalog related entities resolve from Firestore in production
 * (not the Dunbar offline snapshot).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicEntity } from './public-seed';
import { listSeedStories } from './stories-seed';

test('every seed story has body copy and related entity ids', () => {
  const stories = listSeedStories();
  assert.ok(stories.length >= 15, `expected >= 15 stories, got ${stories.length}`);
  for (const story of stories) {
    assert.ok(story.slug.length > 0);
    assert.ok(story.body.length > 0);
    assert.ok(
      story.relatedEntityIds.length > 0,
      `${story.slug} needs at least one related entity id`,
    );
    for (const entityId of story.relatedEntityIds) {
      assert.match(entityId, /^ent_/, `related entity id must be canonical: ${entityId}`);
      // Dunbar-cluster ids stay in the offline seed; national-catalog ids are live-only.
      const seedEntity = getPublicEntity(entityId);
      if (seedEntity) {
        assert.equal(seedEntity.id, entityId);
      }
    }
  }
});
