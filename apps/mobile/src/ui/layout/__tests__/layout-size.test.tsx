/**
 * `useLayoutSize` — the window size-class primitive.
 *
 * Two things are pinned here. First the thresholds themselves, exercised through the pure
 * classifier exactly at and either side of every boundary, plus a table of real device and
 * split-view geometry so a future threshold change has to break a named device rather than
 * an abstract number. Second the hook and its test drivers, because nothing downstream can
 * be tested at a chosen width unless `setTestWindowSize` really moves the hook.
 */
import { act, renderHook } from '@testing-library/react-native';

import {
  classifyLayoutSize,
  layoutHeightBreakpoints,
  layoutWidthBreakpoints,
  useLayoutSize,
} from '../layout-size';
import { createLayoutTestWrapper, resetTestWindowSize, setTestWindowSize } from '../testing';

afterEach(() => {
  resetTestWindowSize();
});

// A tall window, so width tests are never accidentally decided by the height class.
const TALL = 1194;
// A wide window, so height tests are never accidentally decided by the width class.
const WIDE = 1024;

describe('width class thresholds', () => {
  it.each([
    [layoutWidthBreakpoints.medium - 1, 'compact'],
    [layoutWidthBreakpoints.medium, 'medium'],
    [layoutWidthBreakpoints.medium + 1, 'medium'],
    [layoutWidthBreakpoints.expanded - 1, 'medium'],
    [layoutWidthBreakpoints.expanded, 'expanded'],
    [layoutWidthBreakpoints.expanded + 1, 'expanded'],
  ])('classifies width %ipt as %s', (width, expected) => {
    expect(classifyLayoutSize({ width, height: TALL }).widthClass).toBe(expected);
  });

  it('treats the breakpoint as an inclusive lower bound, not an exclusive one', () => {
    expect(classifyLayoutSize({ width: 600, height: TALL }).widthClass).toBe('medium');
    expect(classifyLayoutSize({ width: 599.5, height: TALL }).widthClass).toBe('compact');
  });
});

describe('height class thresholds', () => {
  it.each([
    [layoutHeightBreakpoints.medium - 1, 'compact'],
    [layoutHeightBreakpoints.medium, 'medium'],
    [layoutHeightBreakpoints.medium + 1, 'medium'],
    [layoutHeightBreakpoints.expanded - 1, 'medium'],
    [layoutHeightBreakpoints.expanded, 'expanded'],
    [layoutHeightBreakpoints.expanded + 1, 'expanded'],
  ])('classifies height %ipt as %s', (height, expected) => {
    expect(classifyLayoutSize({ width: WIDE, height }).heightClass).toBe(expected);
  });
});

describe('orientation', () => {
  it('reports portrait when the window is taller than it is wide', () => {
    expect(classifyLayoutSize({ width: 393, height: 852 }).orientation).toBe('portrait');
  });

  it('reports landscape when the window is wider than it is tall', () => {
    expect(classifyLayoutSize({ width: 852, height: 393 }).orientation).toBe('landscape');
  });

  it('reports a square window as portrait', () => {
    expect(classifyLayoutSize({ width: 700, height: 700 }).orientation).toBe('portrait');
  });

  it('reports orientation independently of size class — a medium-width window in both shapes', () => {
    expect(classifyLayoutSize({ width: 744, height: 1133 })).toMatchObject({
      widthClass: 'medium',
      orientation: 'portrait',
    });
    expect(classifyLayoutSize({ width: 744, height: 600 })).toMatchObject({
      widthClass: 'medium',
      orientation: 'landscape',
    });
  });
});

/**
 * Real geometry in points, portrait unless noted. Device sizes are exact; split-view and
 * Slide Over column widths are the sizes iPadOS hands an app at each divider position,
 * rounded to the point. This is the table the thresholds were chosen against: no
 * full-screen tablet may land in the same bucket as a phone, and no split-view column may
 * land in the same bucket as a full-screen tablet.
 */
describe('real device and split-view geometry', () => {
  it.each([
    ['iPhone SE portrait', 375, 667, 'compact', 'medium', false],
    ['iPhone SE landscape', 667, 375, 'medium', 'compact', false],
    ['iPhone 16 portrait', 393, 852, 'compact', 'medium', false],
    ['iPhone 16 landscape', 852, 393, 'expanded', 'compact', false],
    ['iPhone 16 Pro Max portrait', 440, 956, 'compact', 'expanded', false],
    ['iPhone 16 Pro Max landscape', 956, 440, 'expanded', 'compact', false],
    ['iPad mini portrait', 744, 1133, 'medium', 'expanded', true],
    ['iPad mini landscape', 1133, 744, 'expanded', 'medium', true],
    ['iPad 10.2" portrait', 810, 1080, 'medium', 'expanded', true],
    ['iPad Pro 11" portrait', 834, 1194, 'medium', 'expanded', true],
    ['iPad Pro 11" landscape', 1194, 834, 'expanded', 'medium', true],
    ['iPad Pro 12.9" portrait', 1024, 1366, 'expanded', 'expanded', true],
    ['iPad Slide Over', 320, 1194, 'compact', 'expanded', false],
    ['iPad split view 1/2 of portrait', 507, 1366, 'compact', 'expanded', false],
    ['iPad split view 1/2 of 11" landscape', 592, 834, 'compact', 'medium', false],
    ['iPad split view 2/3 of 11" landscape', 855, 834, 'expanded', 'medium', true],
  ])(
    '%s (%ix%i) is %s width / %s height, two-pane: %s',
    (_name, width, height, widthClass, heightClass, supportsTwoPane) => {
      expect(classifyLayoutSize({ width, height })).toMatchObject({
        widthClass,
        heightClass,
        supportsTwoPane,
      });
    },
  );

  it('never offers two panes on a phone, in either orientation', () => {
    const phones = [
      [375, 667],
      [393, 852],
      [430, 932],
      [440, 956],
    ] as const;

    for (const [width, height] of phones) {
      expect(classifyLayoutSize({ width, height }).supportsTwoPane).toBe(false);
      expect(classifyLayoutSize({ width: height, height: width }).supportsTwoPane).toBe(false);
    }
  });

  it('offers two panes on every full-screen iPad, in either orientation', () => {
    const tablets = [
      [744, 1133],
      [810, 1080],
      [834, 1194],
      [1024, 1366],
    ] as const;

    for (const [width, height] of tablets) {
      expect(classifyLayoutSize({ width, height }).supportsTwoPane).toBe(true);
      expect(classifyLayoutSize({ width: height, height: width }).supportsTwoPane).toBe(true);
    }
  });
});

describe('insets', () => {
  it('defaults to zero on every edge when none are supplied', () => {
    expect(classifyLayoutSize({ width: 393, height: 852 }).insets).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('passes the supplied insets through unchanged', () => {
    const insets = { top: 0, right: 59, bottom: 21, left: 59 };
    expect(classifyLayoutSize({ width: 852, height: 393 }, insets).insets).toEqual(insets);
  });
});

describe('useLayoutSize', () => {
  it('reports the size set by setTestWindowSize — the mock helper really drives the hook', async () => {
    setTestWindowSize({ width: 834, height: 1194 });

    const { result } = await renderHook(() => useLayoutSize());

    expect(result.current).toMatchObject({
      width: 834,
      height: 1194,
      widthClass: 'medium',
      heightClass: 'expanded',
      orientation: 'portrait',
      supportsTwoPane: true,
    });
  });

  it('recomputes on rotation', async () => {
    setTestWindowSize({ width: 393, height: 852 });

    const { result } = await renderHook(() => useLayoutSize());
    expect(result.current).toMatchObject({ orientation: 'portrait', widthClass: 'compact' });

    await act(async () => {
      setTestWindowSize({ width: 852, height: 393 });
    });

    expect(result.current).toMatchObject({
      width: 852,
      height: 393,
      orientation: 'landscape',
      widthClass: 'expanded',
      heightClass: 'compact',
      // The whole point of tracking height: a rotated phone is wide and still not two-pane.
      supportsTwoPane: false,
    });
  });

  it('recomputes when a split-view divider narrows the window under the app', async () => {
    setTestWindowSize({ width: 1024, height: 1366 });

    const { result } = await renderHook(() => useLayoutSize());
    expect(result.current.supportsTwoPane).toBe(true);

    await act(async () => {
      setTestWindowSize({ width: 507, height: 1366 });
    });

    expect(result.current).toMatchObject({
      width: 507,
      widthClass: 'compact',
      supportsTwoPane: false,
    });

    await act(async () => {
      setTestWindowSize({ width: 320, height: 1366 });
    });

    expect(result.current).toMatchObject({ width: 320, widthClass: 'compact' });
  });

  it('reports the insets supplied by createLayoutTestWrapper alongside the size', async () => {
    setTestWindowSize({ width: 852, height: 393 });
    const wrapper = createLayoutTestWrapper({ insets: { left: 59, right: 59, bottom: 21 } });

    const { result } = await renderHook(() => useLayoutSize(), { wrapper });

    expect(result.current.insets).toEqual({ top: 0, right: 59, bottom: 21, left: 59 });
    expect(result.current.orientation).toBe('landscape');
  });

  it('falls back to zero insets when no safe-area provider is mounted', async () => {
    setTestWindowSize({ width: 393, height: 852 });

    const { result } = await renderHook(() => useLayoutSize());

    expect(result.current.insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('keeps a stable object identity across renders that do not change the window', async () => {
    setTestWindowSize({ width: 744, height: 1133 });

    const { result, rerender } = await renderHook(() => useLayoutSize());
    const first = result.current;

    await rerender({});

    expect(result.current).toBe(first);
  });

  it('is restored to the preset window size by resetTestWindowSize', async () => {
    setTestWindowSize({ width: 1024, height: 1366 });
    const { result: wide } = await renderHook(() => useLayoutSize());
    expect(wide.current.width).toBe(1024);

    await act(async () => {
      resetTestWindowSize();
    });

    const { result: restored } = await renderHook(() => useLayoutSize());
    expect(restored.current.width).not.toBe(1024);
  });
});
