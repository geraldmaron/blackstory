/**
 * Story-shaped catalog helpers: the featured band, the compact index, and story routing.
 *
 * There used to be three narrative partitions (`history`, `topics`, `myths`) and a
 * `LONGFORM_SECTIONS` list that named them. There is one now, and the distinction that mattered
 * — a myth correction reads differently from a chapter — survives as the entry's `format`.
 */
import type { ContentEntry, StoryFormat } from '@/features/content';
import { CONTENT_CATALOG } from '@/features/content';

/** Every narrative entry, newest first. */
export function listStoryEntries(): readonly ContentEntry[] {
  return CONTENT_CATALOG.filter((entry) => entry.section === 'stories').sort((a, b) =>
    b.page.publishedAt.localeCompare(a.page.publishedAt),
  );
}

/** Narrative entries of one editorial format, newest first. */
export function listStoriesOfFormat(format: StoryFormat): readonly ContentEntry[] {
  return listStoryEntries().filter((entry) => entry.format === format);
}

/**
 * The featured story: the newest Chapter, falling back to the newest entry of any format.
 *
 * Deliberately kind-aware, and the same rule the web Stories index uses. Straight newest-first
 * made the flagship of the whole surface whichever short piece happened to publish last.
 */
export function pickFeaturedStory(
  entries: readonly ContentEntry[] = listStoryEntries(),
): ContentEntry | undefined {
  if (entries.length === 0) return undefined;
  return entries.find((entry) => entry.format === 'chapter') ?? entries[0];
}

/** How a format is named to a reader. Never the raw token. */
export const STORY_FORMAT_LABELS: Readonly<Record<StoryFormat, string>> = Object.freeze({
  chapter: 'Chapter',
  entry: 'Entry',
  myth: 'Correction',
});

export function storyFormatLabel(entry: ContentEntry): string {
  return entry.format ? STORY_FORMAT_LABELS[entry.format] : 'Story';
}

export function storyHref(entry: ContentEntry): `/stories/${string}` {
  return `/stories/${entry.page.slug}`;
}
