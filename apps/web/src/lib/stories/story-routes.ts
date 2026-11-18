/**
 * Where a published story lives on the site.
 *
 * Most stories live at `/stories/{slug}`. A collection listed here is its own destination instead:
 * a set of uniform, comparable entries with a natural order (the presidents, by term) is a
 * collection a reader browses, not a story they read start to finish, so its entries live under
 * the collection's own path. The slug namespace stays shared, so a member is reachable at exactly
 * one address and the other one 308s to it.
 */
import type { PublicStoryListItemDoc } from '@repo/schemas';

/** Collection id -> the collection's own path. */
export const COLLECTION_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  presidents: '/presidents',
});

type Routable = Pick<PublicStoryListItemDoc, 'slug' | 'collection'>;

/** The base path an item lives under: a collection's path, or `/stories`. */
export function storyBasePath(item: Routable): string {
  const id = item.collection?.id;
  return (id !== undefined && COLLECTION_ROUTES[id]) || '/stories';
}

/** The one canonical address for a story or collection entry. */
export function storyHref(item: Routable): string {
  return `${storyBasePath(item)}/${item.slug}`;
}

/** True when an item is listed on `/stories` rather than on its own collection's page. */
export function listedOnStories(item: Routable): boolean {
  return storyBasePath(item) === '/stories';
}
