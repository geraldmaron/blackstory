/**
 * Web-side checks that `/stories` data comes from the storage-neutral seed corpus,
 * not an apps/web body catalog.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { getSeedStoryProjection, listSeedStoryProjections } from '@repo/domain';

test('storage-neutral story corpus contains exactly five stories', () => {
  const stories = listSeedStoryProjections();
  assert.equal(stories.length, 5);
  for (const story of stories) {
    assert.ok(story.slug.length > 0);
    assert.ok(story.body.length > 0);
    assert.ok(story.sources.length >= 1, `${story.slug} must list sources`);
    assert.ok(story.relatedEntityIds.every((id: string) => id.startsWith('ent_')));
    assert.equal(getSeedStoryProjection(story.slug)?.id, story.slug);
  }
});

test('apps/web does not ship a parallel stories-seed module', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const legacySeed = join(here, '../../data/stories-seed.ts');
  const legacyNational = join(here, '../../data/national-story-seed');
  assert.equal(existsSync(legacySeed), false);
  assert.equal(existsSync(legacyNational), false);
});
