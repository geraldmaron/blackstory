/**
 * Sanity checks for public longform story projections (Firebase seed corpus).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSeedStoryProjection, listSeedStoryProjections } from './public-story-seed.js';
import { publicStoryProjectionSchema } from './types.js';

test('seed story catalog is exactly five Zod-valid longform articles', () => {
  const stories = listSeedStoryProjections();
  assert.equal(stories.length, 5);
  for (const story of stories) {
    const parsed = publicStoryProjectionSchema.safeParse(story);
    assert.ok(parsed.success, `${story.slug}: ${parsed.success ? '' : parsed.error.message}`);
    assert.ok(story.body.length >= 2, `${story.slug} should have multiple sections`);
    const paragraphCount = story.body.reduce((n, section) => n + section.paragraphs.length, 0);
    assert.ok(paragraphCount >= 6, `${story.slug} should be longer prose`);
    assert.ok(story.relatedEntityIds.length > 0);
    for (const entityId of story.relatedEntityIds) {
      assert.match(entityId, /^ent_/);
    }
    assert.ok(story.sources.length >= 1, `${story.slug} must cite at least one source`);
    for (const source of story.sources) {
      assert.match(source.url, /^https:\/\//, `${story.slug}: source must be HTTPS`);
      assert.ok(source.label.length > 0);
    }
    assert.equal(getSeedStoryProjection(story.slug)?.slug, story.slug);
    assert.equal(
      story.body.some((section) => section.paragraphs.some((p) => p.includes('\u2014'))),
      false,
      `${story.slug} must not use em dashes`,
    );
  }
});
