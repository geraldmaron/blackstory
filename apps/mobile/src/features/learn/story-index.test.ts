/**
 * story-index helper tests.
 */
import { listStoryEntries, pickFeaturedStory, isLongformSection } from './story-index';

describe('story-index', () => {
  it('lists narrative entries from topics, history, and myths', () => {
    const entries = listStoryEntries();
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.every((entry) => isLongformSection(entry.section))).toBe(true);
  });

  it('prefers a history entry for the featured band when available', () => {
    const featured = pickFeaturedStory();
    expect(featured?.section).toBe('history');
  });
});
