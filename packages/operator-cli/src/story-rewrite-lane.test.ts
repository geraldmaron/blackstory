/**
 * Tests for the story rewrite artifact lane: mock provider resolution and validation gates.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getSeedStoryProjection } from '@repo/domain';
import {
  buildMockStoryRewriteBody,
  createMockStoryRewriteProvider,
  resolveStoryRewriteProvider,
} from './story-rewrite-lane.js';
import { rewriteStory, validateStoryRewrite } from './story-rewrite.js';

// NOTE: `getSeedStoryProjection` here pulls from the @repo/domain legacy seed
// corpus purely as a stable, ready-made StoryProjection fixture for exercising
// the mock rewrite/validation gates below. It is unrelated to the retired
// runStoryRewriteLane batch lane (repo-gvd0) and does not depend on the
// seed stories being served on any live route.

test('mock story rewrite body passes validation gates for seed stories', () => {
  const story = getSeedStoryProjection('before-the-battle-cry');
  assert.ok(story);
  const body = buildMockStoryRewriteBody(story);
  assert.deepEqual(validateStoryRewrite(story, { body }), []);
});

test('resolveStoryRewriteProvider falls back to mock without OpenRouter credentials', () => {
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const resolved = resolveStoryRewriteProvider({ provider: 'openrouter' });
    assert.equal(resolved.provider.id, 'mock');
    assert.equal(resolved.liveGeneration, false);
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});

test('createMockStoryRewriteProvider returns structured JSON for rewriteStory', async () => {
  const story = getSeedStoryProjection('the-log-cabin-costume');
  assert.ok(story);
  const provider = createMockStoryRewriteProvider();
  const result = await rewriteStory(story, { provider });
  assert.equal(result.validationIssues.length, 0);
  assert.ok(result.wordCount >= 900);
});
