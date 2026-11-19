/**
 * Where a published story lives on the site: `/stories/{slug}`, or a collection's own path when
 * the collection is its own destination (the presidents). The table is shared with the public API
 * and the phone (`STORY_COLLECTION_PATHS` in `@repo/public-contracts/destinations`); this module
 * only adapts it to the web's story documents.
 */
import type { PublicStoryListItemDoc } from '@repo/schemas';
import {
  STORY_COLLECTION_PATHS,
  storyBasePathFor,
  storyPath,
} from '@repo/public-contracts/destinations';

/** Collection id -> the collection's own path. */
export const COLLECTION_ROUTES = STORY_COLLECTION_PATHS;

type Routable = Pick<PublicStoryListItemDoc, 'slug' | 'collection'>;

/** The base path an item lives under: a collection's path, or `/stories`. */
export function storyBasePath(item: Routable): string {
  return storyBasePathFor(item.collection?.id);
}

/** The one canonical address for a story or collection entry. */
export function storyHref(item: Routable): string {
  return storyPath(item.slug, item.collection?.id);
}

/** True when an item is listed on `/stories` rather than on its own collection's page. */
export function listedOnStories(item: Routable): boolean {
  return storyBasePath(item) === '/stories';
}
