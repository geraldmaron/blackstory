/**
 * The Stories index helpers.
 *
 * There used to be three narrative partitions (`history`, `topics`, `myths`) and the featured
 * band preferred a `history` entry. There is one partition now, and the preference is on the
 * editorial FORMAT — a chapter leads, because a chapter is the deep narrative form.
 */
import {
  STORY_FORMAT_LABELS,
  listStoriesOfFormat,
  listStoryEntries,
  pickFeaturedStory,
  storyFormatLabel,
  storyHref,
} from './story-index';

describe('story-index', () => {
  it('lists every narrative entry, and only narrative entries', () => {
    const entries = listStoryEntries();
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.every((entry) => entry.section === 'stories')).toBe(true);
    expect(entries.every((entry) => entry.format !== undefined)).toBe(true);
  });

  it('sorts newest first', () => {
    const dates = listStoryEntries().map((entry) => entry.page.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('features a Chapter, not merely the newest piece', () => {
    const featured = pickFeaturedStory();
    expect(featured?.format).toBe('chapter');
  });

  it('falls back to the newest piece when no Chapter is in view', () => {
    const entries = listStoriesOfFormat('myth');
    expect(entries.length).toBeGreaterThan(0);
    expect(pickFeaturedStory(entries)?.format).toBe('myth');
    expect(pickFeaturedStory([])).toBeUndefined();
  });

  it('keeps the myth-correction format after the /myths surface was retired', () => {
    // The surface is gone; the content and its editorial identity are not. A correction reads
    // differently from a chapter, and that is what a reader is choosing when they open one.
    const corrections = listStoriesOfFormat('myth');
    expect(corrections.length).toBeGreaterThan(0);
    expect(storyFormatLabel(corrections[0]!)).toBe('Correction');
    expect(STORY_FORMAT_LABELS.myth).toBe('Correction');
  });

  it('addresses a story at /stories/{slug}, with no editorial partition in the URL', () => {
    const entry = listStoryEntries()[0]!;
    expect(storyHref(entry)).toBe(`/stories/${entry.page.slug}`);
    expect(storyHref(entry)).not.toMatch(/\/learn\//);
  });
});
