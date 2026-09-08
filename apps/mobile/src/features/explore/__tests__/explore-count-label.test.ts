/**
 * Unit tests for Explore dual count copy (viewport vs release total).
 */
import {
  EXPLORE_SCOPE_ALL_PINNED,
  EXPLORE_SCOPE_NEARBY,
  formatExploreCountLabel,
} from '../explore-count-label';

describe('formatExploreCountLabel', () => {
  it('uses a single count before the map reports a viewport', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 3,
        releaseCount: 3,
        scopeLabel: EXPLORE_SCOPE_ALL_PINNED,
        filters: {},
      }),
    ).toEqual({
      inline: '3 pinned',
      railInline: '3 pinned',
      accessibilityLabel: 'All pinned, 3 pinned',
    });
  });

  it('shows dual copy when viewport-scoped count differs from release total', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 712,
        releaseCount: 1365,
        scopeLabel: EXPLORE_SCOPE_NEARBY,
        filters: {},
      }),
    ).toEqual({
      inline: '712 nearby · 1,365 in release',
      railInline: '712 / 1,365',
      accessibilityLabel: 'Nearby, 712 nearby, 1,365 in release',
    });
  });

  it('reflects active filters in both single and dual modes', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 2,
        releaseCount: 2,
        scopeLabel: EXPLORE_SCOPE_ALL_PINNED,
        filters: { kind: 'place' },
      }),
    ).toEqual({
      inline: '2 pinned · filtered',
      railInline: '2 filtered',
      accessibilityLabel: 'All pinned, 2 pinned · filtered',
    });

    expect(
      formatExploreCountLabel({
        inViewCount: 712,
        releaseCount: 1365,
        scopeLabel: EXPLORE_SCOPE_NEARBY,
        filters: { kind: 'place' },
      }),
    ).toEqual({
      inline: '712 · filtered nearby · 1,365 in release',
      railInline: '712 / 1,365',
      accessibilityLabel: 'Nearby, 712 nearby · filtered, 1,365 in release',
    });
  });

  it('appends demo fixtures hint when requested', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 3,
        releaseCount: 3,
        scopeLabel: EXPLORE_SCOPE_ALL_PINNED,
        filters: {},
        showDemoHint: true,
      }).inline,
    ).toBe('3 pinned demo fixtures');
  });
});
