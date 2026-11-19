import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listedOnStories, storyBasePath, storyHref } from './story-routes';

test('a president entry lives under /presidents; a chapter under /stories', () => {
  const lincoln = {
    slug: 'abraham-lincoln',
    collection: { id: 'presidents', label: 'x', position: 16 },
  };
  const chapter = { slug: 'buying-a-home' };
  assert.equal(storyHref(lincoln), '/presidents/abraham-lincoln');
  assert.equal(storyHref(chapter), '/stories/buying-a-home');
  assert.equal(listedOnStories(lincoln), false);
  assert.equal(listedOnStories(chapter), true);
});

test('an unknown collection stays a story series under /stories', () => {
  const member = { slug: 'part-one', collection: { id: 'some-series', label: 'x', position: 1 } };
  assert.equal(storyBasePath(member), '/stories');
  assert.equal(listedOnStories(member), true);
});
