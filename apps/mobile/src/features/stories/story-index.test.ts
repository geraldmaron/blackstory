import type { StoryListItemV1 } from '@repo/public-contracts/v1/story';
import { listedOnStories, pickFeaturedStory, storyHref } from './story-index';
import { collectionMembers } from './story-client';

const item = (over: Partial<StoryListItemV1>): StoryListItemV1 => ({
  slug: 'x',
  title: 'X',
  summary: 'A summary.',
  format: 'chapter',
  eraLabel: '1900',
  placeLabel: 'United States',
  publishedAt: '2026-08-01',
  webPath: '/stories/x',
  ...over,
});

const lincoln = item({
  slug: 'abraham-lincoln',
  format: 'entry',
  collection: { id: 'presidents', label: 'Presidents', position: 16 },
  webPath: '/presidents/abraham-lincoln',
});
const washington = item({
  slug: 'george-washington',
  format: 'entry',
  collection: { id: 'presidents', label: 'Presidents', position: 1 },
  webPath: '/presidents/george-washington',
});
const chapter = item({ slug: 'buying-a-home', webPath: '/stories/buying-a-home' });

describe('story-index', () => {
  it('routes on the shared path and keeps presidents off the Stories tab', () => {
    expect(storyHref(lincoln)).toBe('/presidents/abraham-lincoln');
    expect(listedOnStories(lincoln)).toBe(false);
    expect(listedOnStories(chapter)).toBe(true);
  });

  it('features the newest chapter, not whatever entry published last', () => {
    expect(pickFeaturedStory([lincoln, chapter])?.slug).toBe('buying-a-home');
    expect(pickFeaturedStory([])).toBeUndefined();
  });

  it('orders a collection by its own position', () => {
    expect(
      collectionMembers([lincoln, chapter, washington], 'presidents').map((s) => s.slug),
    ).toEqual(['george-washington', 'abraham-lincoln']);
  });
});
