/**
 * `/stories/[slug]` sticky evidence rail — pure logic only. "In this chapter" comes from
 * `chapterToc` in `ArticleBody.tsx` (it has to live there so the same function that generates a
 * heading's rendered `id` also generates the rail's `href`, or the two would drift). This file
 * holds the one other rail computation the page needs: which article, if any, comes next in the
 * current one's collection.
 */
import type { PublicArticleListItemDoc } from '@repo/schemas';

export type NextInCollection = {
  readonly href: string;
  readonly title: string;
  readonly positionLabel: string | undefined;
};

/**
 * The next entry in the current article's collection, by series position — undefined when the
 * article isn't in a series, or is already the collection's last entry. `items` is the same
 * `listPublicArticleListItems()` result `/stories` already reads; no new data source.
 */
export function nextInCollection(
  seriesId: string | undefined,
  seriesPosition: number | undefined,
  currentSlug: string,
  items: readonly PublicArticleListItemDoc[],
): NextInCollection | undefined {
  if (seriesId === undefined || seriesPosition === undefined) return undefined;

  const next = items
    .filter(
      (item) =>
        item.series?.id === seriesId &&
        item.slug !== currentSlug &&
        item.series.position > seriesPosition,
    )
    .sort((a, b) => a.series!.position - b.series!.position)[0];

  if (!next) return undefined;
  return {
    href: `/stories/${next.slug}`,
    title: next.title,
    positionLabel: next.series?.positionLabel,
  };
}
