/**
 * Test-only drivers for `useLayoutSize`.
 *
 * Under `jest-expo` there is no real window: `useWindowDimensions()` reads whatever the
 * preset seeded `Dimensions` with, and no provider supplies safe-area insets. Without these
 * helpers, an adaptive component simply cannot be tested at a chosen width. Ship them with
 * the hook, not after it.
 *
 * Worked example — assert a component's wide layout on an iPad Pro 11" in portrait:
 *
 * ```tsx
 * import { render, act } from '@testing-library/react-native';
 * import {
 *   createLayoutTestWrapper,
 *   resetTestWindowSize,
 *   setTestWindowSize,
 * } from '@/ui/layout/testing';
 *
 * afterEach(resetTestWindowSize);
 *
 * it('shows the side rail on a tablet-sized window', async () => {
 *   setTestWindowSize({ width: 834, height: 1194 });
 *   const wrapper = createLayoutTestWrapper({ insets: { top: 24, bottom: 20 } });
 *
 *   const { getByTestId, queryByTestId } = await render(<ExploreView />, { wrapper });
 *   expect(getByTestId('explore-rail')).toBeTruthy();
 *
 *   // Rotate, or drag the split-view divider: same helper, wrapped in act().
 *   await act(async () => setTestWindowSize({ width: 507, height: 1194 }));
 *   expect(queryByTestId('explore-rail')).toBeNull();
 * });
 * ```
 *
 * `setTestWindowSize` before `render` needs no `act`; after `render` it must be wrapped,
 * because it drives a React state update through the `Dimensions` change event.
 *
 * These helpers use the real `react-native-safe-area-context` context object. A suite that
 * also calls `jest.mock('react-native-safe-area-context', ...)` with a hand-written factory
 * must spread `jest.requireActual(...)` into it (as this repo's existing mocks do for
 * everything else) so `SafeAreaInsetsContext` survives.
 */
import type { ComponentType, ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

/** Window size in dp. `scale` / `fontScale` keep the preset's values unless overridden. */
export type TestWindowSize = {
  readonly width: number;
  readonly height: number;
  readonly scale?: number;
  readonly fontScale?: number;
};

// Captured at import, before any test has touched it, so `resetTestWindowSize` restores the
// preset's own window rather than a value some earlier test left behind.
const presetWindow = Dimensions.get('window');

/**
 * Sets the window every `useWindowDimensions()` in the tree reads, and notifies hooks that
 * are already mounted. Wrap in `act()` when calling it after `render`.
 */
export function setTestWindowSize(size: TestWindowSize): void {
  const next = {
    width: size.width,
    height: size.height,
    scale: size.scale ?? presetWindow.scale,
    fontScale: size.fontScale ?? presetWindow.fontScale,
  };

  Dimensions.set({ window: next, screen: next });
}

/**
 * Restores the preset's window size. Call from `afterEach` so suites do not leak into each
 * other — Testing Library's own cleanup has already unmounted the tree by then, so no `act`
 * is needed there. Wrap it in `act()` if you call it while a tree is still mounted.
 */
export function resetTestWindowSize(): void {
  Dimensions.set({ window: presetWindow, screen: presetWindow });
}

/**
 * Builds a `wrapper` for `render` / `renderHook` that supplies safe-area insets. Omitted
 * edges are zero. Call it once outside the render so the wrapper identity stays stable.
 */
export function createLayoutTestWrapper(options?: {
  readonly insets?: Partial<EdgeInsets>;
}): ComponentType<{ readonly children: ReactNode }> {
  const insets: EdgeInsets = {
    top: options?.insets?.top ?? 0,
    right: options?.insets?.right ?? 0,
    bottom: options?.insets?.bottom ?? 0,
    left: options?.insets?.left ?? 0,
  };

  return function LayoutTestWrapper({ children }: { readonly children: ReactNode }) {
    return (
      <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
    );
  };
}
