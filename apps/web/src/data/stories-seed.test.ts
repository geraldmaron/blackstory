/**
 * Sanity checks for the Stories seed catalog — related entity/fact ids resolve.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSeedFact } from './facts-seed';
import { getPublicEntity } from './public-seed';
import { listSeedStories } from './stories-seed';

test('every seed story resolves related entities and published facts', () => {
  const stories = listSeedStories();
  assert.ok(stories.length >= 15, `expected >= 15 stories, got ${stories.length}`);
  for (const story of stories) {
    assert.ok(story.slug.length > 0);
    assert.ok(story.body.length > 0);
    for (const entityId of story.relatedEntityIds) {
      assert.ok(getPublicEntity(entityId), `missing entity ${entityId} on ${story.slug}`);
    }
    for (const factId of story.relatedFactIds) {
      const fact = getSeedFact(factId);
      assert.ok(fact, `missing fact ${factId} on ${story.slug}`);
      assert.notEqual(fact!.status, 'draft');
    }
  }
});
