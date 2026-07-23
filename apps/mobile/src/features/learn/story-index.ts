/**
 * Story-shaped catalog helpers for the Stories-forward Learn tab (featured band, compact index,
 * longform reader routing). Narrative sections mirror web `/stories`, `/history`, and `/myths`.
 */
import type { CatalogSectionId, LearnContentEntry } from './content-catalog';
import { CONTENT_CATALOG } from './content-catalog';

/** Catalog partitions that render as longform editorial (Source Serif body, calm chrome). */
export const LONGFORM_SECTIONS: readonly CatalogSectionId[] = ['topics', 'history', 'myths'];

export function isLongformSection(section: CatalogSectionId): boolean {
  return LONGFORM_SECTIONS.includes(section);
}

/** All narrative entries across story-shaped partitions, newest first. */
export function listStoryEntries(): readonly LearnContentEntry[] {
  return CONTENT_CATALOG.filter((entry) => LONGFORM_SECTIONS.includes(entry.section)).sort((a, b) =>
    b.page.publishedAt.localeCompare(a.page.publishedAt),
  );
}

/** Featured story for the home band — prefer a history anchor when present. */
export function pickFeaturedStory(
  entries: readonly LearnContentEntry[] = listStoryEntries(),
): LearnContentEntry | undefined {
  if (entries.length === 0) return undefined;
  return entries.find((entry) => entry.section === 'history') ?? entries[0];
}

export function storyRouteIdForSection(section: CatalogSectionId): string {
  if (section === 'topics') return 'topics';
  if (section === 'history') return 'history';
  if (section === 'myths') return 'myths';
  return section;
}

export function storyHref(entry: LearnContentEntry): `/learn/${string}/${string}` {
  return `/learn/${storyRouteIdForSection(entry.section)}/${entry.page.slug}`;
}
