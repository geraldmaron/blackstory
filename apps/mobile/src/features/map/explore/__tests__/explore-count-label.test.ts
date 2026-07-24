/**
 * Unit tests for Explore dual count copy (viewport vs release total).
 */
import { formatExploreCountLabel } from '../explore-count-label';

describe('formatExploreCountLabel', () => {
  it('uses a single count before the map reports a viewport', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 3,
        releaseCount: 3,
        scopeLabel: 'All records',
        filters: {},
      }),
    ).toEqual({
      inline: '3 records',
      railInline: '3 pinned',
      accessibilityLabel: 'All records, 3 records',
    });
  });

  it('shows dual copy when viewport-scoped count differs from release total', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 712,
        releaseCount: 1365,
        scopeLabel: 'In view',
        filters: {},
      }),
    ).toEqual({
      inline: '712 in view · 1,365 in release',
      railInline: '712 / 1,365',
      accessibilityLabel: 'In view, 712 in view, 1,365 in release',
    });
  });

  it('reflects active filters in both single and dual modes', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 2,
        releaseCount: 2,
        scopeLabel: 'All records',
        filters: { kind: 'place' },
      }),
    ).toEqual({
      inline: '2 records · filtered',
      railInline: '2 filtered',
      accessibilityLabel: 'All records, 2 records · filtered',
    });

    expect(
      formatExploreCountLabel({
        inViewCount: 712,
        releaseCount: 1365,
        scopeLabel: 'In view',
        filters: { kind: 'place' },
      }),
    ).toEqual({
      inline: '712 · filtered in view · 1,365 in release',
      railInline: '712 / 1,365',
      accessibilityLabel: 'In view, 712 in view · filtered, 1,365 in release',
    });
  });

  it('appends demo fixtures hint when requested', () => {
    expect(
      formatExploreCountLabel({
        inViewCount: 3,
        releaseCount: 3,
        scopeLabel: 'All records',
        filters: {},
        showDemoHint: true,
      }).inline,
    ).toBe('3 records demo fixtures');
  });
});
