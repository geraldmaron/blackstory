/**
 * Layout size classes for the native app — "respond to the window, not the device."
 *
 * Every adaptive decision in the app reads this hook. Nothing reads a device model: an
 * iPad running in a 1/3 split-view column gets a ~320pt window and has to lay out exactly
 * like a phone, and an unfolded foldable has to lay out like a tablet. The only honest
 * input is the current window.
 *
 * Thresholds follow Material 3's window size classes (width 600 / 840, height 480 / 900)
 * rather than invented numbers. Apple's compact/regular size classes are the other prior
 * art, but UIKit never publishes the point values behind them, so they cannot be ported —
 * Material's are public, numeric, and land in the right place on real iOS geometry (see
 * the device table in `__tests__/layout-size.test.tsx`). Material's `large` (1200) and
 * `extra-large` (1600) width classes are folded into `expanded`: nothing in this app lays
 * out differently above 1200pt, and a class nobody honors is worse than no class.
 */
import { useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

/** Window size class. The same three-value scale is used for width and for height. */
export type LayoutSizeClass = 'compact' | 'medium' | 'expanded';

/** Window shape. `landscape` means strictly wider than tall; a square window is `portrait`. */
export type LayoutOrientation = 'portrait' | 'landscape';

/**
 * Width thresholds in dp, as inclusive lower bounds (Material 3 window size classes).
 * `compact` is everything below `medium`.
 */
export const layoutWidthBreakpoints = {
  medium: 600,
  expanded: 840,
} as const;

/**
 * Height thresholds in dp, as inclusive lower bounds (Material 3 window size classes).
 * `compact` is everything below `medium`.
 */
export const layoutHeightBreakpoints = {
  medium: 480,
  expanded: 900,
} as const;

/** Window dimensions in dp — the `width`/`height` of `useWindowDimensions()`. */
export type LayoutWindow = {
  readonly width: number;
  readonly height: number;
};

export type LayoutSize = {
  /** Window width in dp. Live — changes on rotation, resize and split-view drag. */
  readonly width: number;
  /** Window height in dp. Live. */
  readonly height: number;
  readonly widthClass: LayoutSizeClass;
  readonly heightClass: LayoutSizeClass;
  readonly orientation: LayoutOrientation;
  /**
   * Enough window in *both* axes to place two panes side by side — a map plus a rail, a
   * list plus a detail. True only when width and height are each above `compact`.
   *
   * Width alone is not enough. Every iPhone turned landscape is 667–956pt wide, clearing
   * the 600pt width threshold, but only 375–440pt tall — a side rail there leaves both
   * panes unusable. The 480pt height floor is what separates "phone on its side" from
   * "small tablet", and it separates them cleanly: no shipping phone is 480pt tall in
   * landscape, and no tablet window is shorter than 480pt in either orientation.
   */
  readonly supportsTwoPane: boolean;
  /**
   * Live safe-area insets for the same window. Bundled here because `left`/`right` stop
   * being zero exactly when the window goes wide (landscape on a notched phone, and any
   * iPad split view), which is when a caller is most likely to be reading this hook.
   *
   * Zero on all four edges when no `SafeAreaProvider` is mounted above the caller.
   */
  readonly insets: EdgeInsets;
};

const zeroInsets: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function widthClassFor(width: number): LayoutSizeClass {
  if (width >= layoutWidthBreakpoints.expanded) return 'expanded';
  if (width >= layoutWidthBreakpoints.medium) return 'medium';
  return 'compact';
}

function heightClassFor(height: number): LayoutSizeClass {
  if (height >= layoutHeightBreakpoints.expanded) return 'expanded';
  if (height >= layoutHeightBreakpoints.medium) return 'medium';
  return 'compact';
}

/**
 * Pure classifier behind `useLayoutSize`. Exported so a caller that already has a measured
 * frame (a resizable pane, not the window) can classify it on the same scale, and so the
 * threshold behavior is testable without React.
 */
export function classifyLayoutSize(
  window: LayoutWindow,
  insets: EdgeInsets = zeroInsets,
): LayoutSize {
  const widthClass = widthClassFor(window.width);
  const heightClass = heightClassFor(window.height);

  return {
    width: window.width,
    height: window.height,
    widthClass,
    heightClass,
    orientation: window.width > window.height ? 'landscape' : 'portrait',
    supportsTwoPane: widthClass !== 'compact' && heightClass !== 'compact',
    insets,
  };
}

/**
 * Reports the live window size class and safe-area insets together.
 *
 * Recomputes on rotation, on window resize, and on iPad split-view / Slide Over changes,
 * because `useWindowDimensions()` subscribes to the dimension change event. Do not swap it
 * for a module-scope `Dimensions.get('window')` — that reads once at import and never
 * updates.
 *
 * Tests drive this through `createLayoutTestWrapper` / `setTestWindowSize` in `./testing`.
 */
export function useLayoutSize(): LayoutSize {
  const { width, height } = useWindowDimensions();
  const providedInsets = useContext(SafeAreaInsetsContext);
  const insets = providedInsets ?? zeroInsets;

  // Reading the context directly rather than calling useSafeAreaInsets() is deliberate: that hook
  // throws without a provider, and a size read that crashes a screen outside a navigator is a bad
  // trade for a primitive this many surfaces will depend on. The cost of the softer failure is
  // that a missing provider degrades to zero insets silently, which in landscape or on a notched
  // device means content under the hardware. So it is loud in development and quiet in
  // production: a warning is recoverable, a crash in someone's hands is not.
  if (__DEV__ && providedInsets === undefined) {
    console.warn(
      'useLayoutSize: no SafeAreaInsetsContext above this component, so insets read as zero. ' +
        'Wrap the tree in a SafeAreaProvider (screens inside a navigator already have one), or ' +
        'in a test use createLayoutTestWrapper from @/ui/layout/testing.',
    );
  }

  return useMemo(() => classifyLayoutSize({ width, height }, insets), [width, height, insets]);
}
