/**
 * Sparse viewport coaching — empty Nearby/filter intersection without burying the map.
 */
import {
  shouldShowSparseViewportCoach,
  SPARSE_VIEWPORT_COACH_COPY,
} from '../sparse-viewport-coach';

describe('shouldShowSparseViewportCoach', () => {
  it('shows when the release has pins but the current view has none', () => {
    expect(shouldShowSparseViewportCoach({ inViewCount: 0, releaseCount: 1365 })).toBe(true);
  });

  it('hides when pins are in view or the release itself is empty', () => {
    expect(shouldShowSparseViewportCoach({ inViewCount: 12, releaseCount: 1365 })).toBe(false);
    expect(shouldShowSparseViewportCoach({ inViewCount: 0, releaseCount: 0 })).toBe(false);
  });

  it('keeps coaching copy free of em dashes', () => {
    expect(SPARSE_VIEWPORT_COACH_COPY.includes('\u2014')).toBe(false);
    expect(SPARSE_VIEWPORT_COACH_COPY).toMatch(/Pan/);
  });
});
