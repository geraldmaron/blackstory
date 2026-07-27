/**
 * Pure grouping/link helpers for the `/stories` ("Chapters") index. Split out of
 * `page.tsx` so these can be unit tested without pulling in CSS/next imports.
 */
import type { PublicStoryListItem } from '../../lib/public-data/source';
import { getThemeCatalogEntry } from '../../lib/theme-impact/catalog';

export const STANDALONE_GROUP_LABEL = 'Standalone';

export type StoryGroup = {
  readonly key: string;
  readonly label: string;
  readonly stories: readonly PublicStoryListItem[];
};

/** Bound stories link into their theme's chaptered essay; unbound stories keep their article page. */
export function storyHref(story: PublicStoryListItem): string {
  const binding = story.themeBinding;
  if (!binding) return `/stories/${story.slug}`;
  return `/themes/${binding.themeId}#chapter-${binding.chapterIndex}`;
}

/** Groups stories by `themeBinding.themeId` (sorted by theme title, then chapterIndex within a
 * group), with unbound stories collected into a trailing "Standalone" group. */
export function groupStoriesByTheme(stories: readonly PublicStoryListItem[]): readonly StoryGroup[] {
  const groupsByThemeId = new Map<string, PublicStoryListItem[]>();
  const standalone: PublicStoryListItem[] = [];

  for (const story of stories) {
    const themeId = story.themeBinding?.themeId;
    if (!themeId) {
      standalone.push(story);
      continue;
    }
    const bucket = groupsByThemeId.get(themeId);
    if (bucket) {
      bucket.push(story);
    } else {
      groupsByThemeId.set(themeId, [story]);
    }
  }

  const themeGroups: StoryGroup[] = [...groupsByThemeId.entries()].map(([themeId, items]) => ({
    key: themeId,
    label: getThemeCatalogEntry(themeId)?.title ?? themeId,
    stories: [...items].sort(
      (a, b) => (a.themeBinding?.chapterIndex ?? 0) - (b.themeBinding?.chapterIndex ?? 0),
    ),
  }));

  themeGroups.sort((a, b) => a.label.localeCompare(b.label));

  return standalone.length > 0
    ? [...themeGroups, { key: 'standalone', label: STANDALONE_GROUP_LABEL, stories: standalone }]
    : themeGroups;
}
