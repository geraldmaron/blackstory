/**
 * Resolves one published record for `/invention/{slug}` through the search index, then a
 * point-get. Shared by the page and its 404 gate so both ask the same question once per request.
 */
import { cache } from 'react';
import { isResolvablePlaceSlug, resolvePlaceSlugFromSearchIndex } from '../../lib/place/place-slug';
import { getPublicSearchIndex, resolvePublicEntityView } from '../../lib/public-data/source';

/** Resolve a public invention slug to its release entity, or nothing. */
export const loadInventionRecord = cache(async (slug: string) => {
  if (!isResolvablePlaceSlug(slug)) return undefined;
  const index = await getPublicSearchIndex();
  const id = resolvePlaceSlugFromSearchIndex(index.data, slug);
  if (id === undefined) return undefined;
  return (await resolvePublicEntityView(id)).data ?? undefined;
});
