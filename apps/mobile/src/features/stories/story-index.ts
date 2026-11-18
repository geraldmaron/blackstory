/**
 * Story list helpers over the live `/v1/stories` list.
 *
 * The phone mirrors the site's addresses: a story lives at `/stories/{slug}`, and a collection
 * that is its own destination (the presidents) at its own path, from the one shared table
 * (`storyPath` in `@repo/public-contracts/destinations`, carried on each item as `webPath`).
 */
import type { StoryListItemV1 } from '@repo/public-contracts/v1/story';
import { storyBasePathFor } from '@repo/public-contracts/destinations';

/** The native route for a story: the same path the site uses. */
export function storyHref(story: Pick<StoryListItemV1, 'webPath'>): string {
  return story.webPath;
}

/** True when the item belongs on the Stories tab rather than on its collection's own screen. */
export function listedOnStories(story: Pick<StoryListItemV1, 'collection'>): boolean {
  return storyBasePathFor(story.collection?.id) === '/stories';
}

/** The featured story: the newest chapter, falling back to the newest story of any format. */
export function pickFeaturedStory(
  stories: readonly StoryListItemV1[],
): StoryListItemV1 | undefined {
  return stories.find((story) => story.format === 'chapter') ?? stories[0];
}
