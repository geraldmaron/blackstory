/**
 * `/stories` ("Chapters") index grouping: bound stories group under their theme
 * title and link to `/themes/[themeId]#chapter-N`; unbound stories fall into a
 * final "Standalone" group and keep linking to their own article page.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicStoryListItem } from '../../lib/public-data/source';
import { groupStoriesByTheme, storyHref } from './story-groups';

function storyItem(overrides: Partial<PublicStoryListItem> & { readonly slug: string }): PublicStoryListItem {
  return {
    id: overrides.slug,
    releaseId: 'release-1',
    slug: overrides.slug,
    title: overrides.title ?? overrides.slug,
    dek: overrides.dek ?? 'dek',
    publishedAt: overrides.publishedAt ?? '2024-01-01',
    eraLabel: overrides.eraLabel ?? '1960s',
    placeLabel: overrides.placeLabel ?? 'Chicago, IL',
    ...(overrides.themeBinding !== undefined ? { themeBinding: overrides.themeBinding } : {}),
  } as PublicStoryListItem;
}

test('storyHref links bound stories to the theme chapter anchor', () => {
  const bound = storyItem({
    slug: 'bound-story',
    themeBinding: { themeId: 'redlining', chapterIndex: 2, chapterCount: 3 },
  });
  assert.equal(storyHref(bound), '/themes/redlining#chapter-2');
});

test('storyHref keeps the article page link for unbound stories', () => {
  const unbound = storyItem({ slug: 'unbound-story' });
  assert.equal(storyHref(unbound), '/stories/unbound-story');
});

test('groupStoriesByTheme groups bound stories by themeId, sorted by chapterIndex', () => {
  const chapterTwo = storyItem({
    slug: 'chapter-2',
    themeBinding: { themeId: 'redlining', chapterIndex: 2, chapterCount: 2 },
  });
  const chapterOne = storyItem({
    slug: 'chapter-1',
    themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 2 },
  });

  const groups = groupStoriesByTheme([chapterTwo, chapterOne]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.key, 'redlining');
  assert.deepEqual(
    groups[0]?.stories.map((story) => story.slug),
    ['chapter-1', 'chapter-2'],
  );
});

test('groupStoriesByTheme puts unbound stories in a trailing Standalone group', () => {
  const bound = storyItem({
    slug: 'bound-story',
    themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 1 },
  });
  const unbound = storyItem({ slug: 'unbound-story' });

  const groups = groupStoriesByTheme([unbound, bound]);

  assert.equal(groups.length, 2);
  assert.equal(groups[groups.length - 1]?.key, 'standalone');
  assert.equal(groups[groups.length - 1]?.label, 'Standalone');
  assert.deepEqual(
    groups[groups.length - 1]?.stories.map((story) => story.slug),
    ['unbound-story'],
  );
});

test('groupStoriesByTheme returns no groups for an empty story list', () => {
  assert.deepEqual(groupStoriesByTheme([]), []);
});
