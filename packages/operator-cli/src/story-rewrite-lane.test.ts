/**
 * Tests for the story rewrite artifact lane: mock provider resolution and validation gates.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getSeedStoryProjection } from '@repo/domain';
import {
  buildMockStoryRewriteBody,
  createMockStoryRewriteProvider,
  resolveStoryRewriteProvider,
  runStoryRewriteLane,
} from './story-rewrite-lane.js';
import { rewriteStory, validateStoryRewrite } from './story-rewrite.js';

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

test('runStoryRewriteLane writes review artifacts for all five seed stories', async () => {
  const output = mkdtempSync(join(tmpdir(), 'story-rewrite-'));
  const summary = await runStoryRewriteLane({ output, provider: 'mock' });
  assert.equal(summary.results.length, 5);
  assert.equal(summary.liveGeneration, false);
  for (const result of summary.results) {
    const artifact = JSON.parse(readFileSync(`${output}/${result.slug}.json`, 'utf8')) as {
      validationIssues: string[];
    };
    assert.deepEqual(artifact.validationIssues, []);
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
