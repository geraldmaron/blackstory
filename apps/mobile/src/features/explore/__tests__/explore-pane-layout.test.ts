/**
 * Where Explore switches between the phone sheet and the tablet rail, checked against real
 * device geometry rather than against the constants restated.
 *
 * The table below is the point: the rule is a window rule, so the cases that matter are the
 * ones where window and device disagree — a phone turned sideways is wide, an iPad in Slide
 * Over is narrow, and a half-width split view is somewhere in between.
 */
import { classifyLayoutSize } from '@/ui/layout';
import {
  EXPLORE_MAP_MIN_WIDTH,
  EXPLORE_RAIL_MAX_WIDTH,
  EXPLORE_RAIL_MIN_WIDTH,
  explorePaneLayout,
} from '../explore-pane-layout';

function layoutFor(width: number, height: number) {
  return explorePaneLayout(classifyLayoutSize({ width, height }));
}

describe('explorePaneLayout — which posture a window gets', () => {
  it.each([
    ['iPhone 16 Pro portrait', 402, 874],
    ['iPhone 16 Pro Max portrait', 440, 956],
    ['iPhone SE portrait', 375, 667],
    // Wide enough for two panes by width alone. It must not get them: 393pt of height with a
    // list beside the map leaves neither pane able to show anything.
    ['iPhone 16 Pro landscape', 874, 402],
    ['iPhone 16 Pro Max landscape', 956, 440],
    // iPad Slide Over hands the app a phone-width column on a tablet.
    ['iPad Slide Over', 320, 1133],
    // A third-width split view on an 11" iPad.
    ['iPad 1/3 split view portrait', 320, 1194],
    ['iPad 1/2 split view portrait', 507, 1194],
  ])('gives %s the bottom sheet', (_name, width, height) => {
    expect(layoutFor(width, height)).toEqual({ kind: 'sheet' });
  });

  it.each([
    ['iPad mini portrait', 744, 1133],
    ['iPad mini landscape', 1133, 744],
    ['iPad Pro 11" portrait', 834, 1194],
    ['iPad Pro 11" landscape', 1194, 834],
    ['iPad Pro 13" portrait', 1024, 1366],
    ['iPad Pro 13" landscape', 1366, 1024],
    ['iPad Pro 13" 1/2 split view landscape', 678, 1024],
  ])('gives %s two panes', (_name, width, height) => {
    expect(layoutFor(width, height).kind).toBe('two-pane');
  });
});

describe('explorePaneLayout — how the two panes are sized', () => {
  it('never leaves the map below its floor, at any width that gets two panes', () => {
    for (let width = 600; width <= 1600; width += 1) {
      const layout = explorePaneLayout(classifyLayoutSize({ width, height: 1024 }));
      if (layout.kind !== 'two-pane') continue;
      expect(layout.mapWidth).toBeGreaterThanOrEqual(EXPLORE_MAP_MIN_WIDTH);
      expect(layout.railWidth + layout.mapWidth).toBe(width);
    }
  });

  it('keeps the rail between its clamps', () => {
    for (let width = 600; width <= 1600; width += 1) {
      const layout = explorePaneLayout(classifyLayoutSize({ width, height: 1024 }));
      if (layout.kind !== 'two-pane') continue;
      expect(layout.railWidth).toBeGreaterThanOrEqual(EXPLORE_RAIL_MIN_WIDTH);
      expect(layout.railWidth).toBeLessThanOrEqual(EXPLORE_RAIL_MAX_WIDTH);
    }
  });

  it('spends new width on the map once the rail has stopped growing', () => {
    const wide = explorePaneLayout(classifyLayoutSize({ width: 1366, height: 1024 }));
    const wider = explorePaneLayout(classifyLayoutSize({ width: 1600, height: 1024 }));
    if (wide.kind !== 'two-pane' || wider.kind !== 'two-pane') throw new Error('expected two-pane');

    expect(wide.railWidth).toBe(EXPLORE_RAIL_MAX_WIDTH);
    expect(wider.railWidth).toBe(EXPLORE_RAIL_MAX_WIDTH);
    expect(wider.mapWidth - wide.mapWidth).toBe(1600 - 1366);
  });

  it('is monotonic — widening the window never narrows a pane', () => {
    let previousRail = 0;
    let previousMap = 0;
    for (let width = 600; width <= 1600; width += 1) {
      const layout = explorePaneLayout(classifyLayoutSize({ width, height: 1024 }));
      if (layout.kind !== 'two-pane') continue;
      expect(layout.railWidth).toBeGreaterThanOrEqual(previousRail);
      expect(layout.mapWidth).toBeGreaterThanOrEqual(previousMap);
      previousRail = layout.railWidth;
      previousMap = layout.mapWidth;
    }
  });
});
