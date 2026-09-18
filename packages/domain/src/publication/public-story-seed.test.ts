/**
 * `publicStoryProjectionSchema` is active: this fixture is typed by it, and `/admin/stories/articles`
 * and `/admin/stories/review` read the fixture through
 * `apps/web/src/admin/stories/cover-article-catalog.ts`.
 *
 * The link between them was a bare `import type`, which a consumer search picks up but a compiler
 * cannot enforce — the fixture could drift out of the schema's shape and nothing would say so, and
 * the next sweep would read that silence as "nothing uses this" all over again. These tests parse
 * the fixture through the schema at runtime, so the dependency is a thing that fails rather than a
 * claim in a comment.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicStoryProjectionSchema } from '@repo/schemas';
import {
  SEED_STORY_PROJECTIONS,
  getSeedStoryProjection,
  listSeedStoryProjections,
} from './public-story-seed.js';

test('every seed story parses against publicStoryProjectionSchema', () => {
  assert.ok(SEED_STORY_PROJECTIONS.length > 0, 'seed fixture must not be empty');
  for (const story of SEED_STORY_PROJECTIONS) {
    const result = publicStoryProjectionSchema.safeParse(story);
    assert.equal(
      result.success,
      true,
      `${story.slug} failed: ${result.success ? '' : JSON.stringify(result.error.issues)}`,
    );
  }
});

test('seed slugs are unique, so the admin lookup by slug is unambiguous', () => {
  const slugs = listSeedStoryProjections().map((story) => story.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('getSeedStoryProjection finds a seeded slug and misses an unseeded one', () => {
  const first = SEED_STORY_PROJECTIONS[0];
  assert.ok(first);
  assert.equal(getSeedStoryProjection(first.slug)?.title, first.title);
  assert.equal(getSeedStoryProjection('no-such-story'), undefined);
});

/**
 * The admin cover catalog maps each seed story to a `CoverArticleRecord` using exactly these
 * five fields. An empty one would render a blank row on `/admin/stories/articles`.
 */
test('every seed story carries the fields the admin cover catalog renders', () => {
  for (const story of SEED_STORY_PROJECTIONS) {
    for (const field of ['slug', 'title', 'dek', 'eraLabel', 'placeLabel'] as const) {
      assert.ok(story[field].length > 0, `${story.slug} has an empty ${field}`);
    }
  }
});
