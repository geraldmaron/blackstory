/**
 * Gorhom bottom-sheet host for Explore: peek / half / full snaps over the
 * full-bleed map. Delegates to the shared AppBottomSheet primitive.
 *
 * Pin Pulse detents (11/34/52): map owns first glance; native Explore also lifts
 * the sheet with tab-bar `bottomInset`. `bottomInset` still clears the edition tab bar.
 */
import { useMemo, type ReactNode } from 'react';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import {
  EXPLORE_SHEET_FULL_FRACTION,
  EXPLORE_SHEET_HALF_FRACTION,
  EXPLORE_SHEET_PEEK_FRACTION,
  explorePeekHeightPx,
} from './explore-sheet-layout';

/** Snap indices: 0 = peek, 1 = half, 2 = full browse. */
export const EXPLORE_SHEET_PEEK = 0;
export const EXPLORE_SHEET_HALF = 1;
export const EXPLORE_SHEET_FULL = 2;

function pct(fraction: number): `${number}%` {
  return `${Math.round(fraction * 100)}%`;
}

/** Peek rail, selection preview, full browse — map stays the majority surface. */
export const EXPLORE_SHEET_SNAP_POINTS = [
  pct(EXPLORE_SHEET_PEEK_FRACTION),
  pct(EXPLORE_SHEET_HALF_FRACTION),
  pct(EXPLORE_SHEET_FULL_FRACTION),
] as const;

/**
 * Snap points with peek sized to the header the sheet actually shows.
 *
 * gorhom takes a mixed list, so peek is a point height while half and full stay proportional —
 * those two are deliberately a share of the screen (the map keeps the majority), while peek is
 * the height of one header and has no business scaling with the phone.
 */
export function exploreSheetSnapPoints(
  peekHeaderHeight: number | undefined,
): readonly (string | number)[] {
  return [
    explorePeekHeightPx(peekHeaderHeight),
    pct(EXPLORE_SHEET_HALF_FRACTION),
    pct(EXPLORE_SHEET_FULL_FRACTION),
  ];
}

/** Peek height as a percentage string (instruments panel + attribution clearance). */
export const EXPLORE_SHEET_PEEK_HEIGHT: `${number}%` = pct(EXPLORE_SHEET_PEEK_FRACTION);

/**
 * Default sheet bottom inset when tab bar height is unavailable (tests).
 * ExploreView passes the live tab bar height from React Navigation.
 */
export const EXPLORE_SHEET_BOTTOM_INSET = 0;

/** @deprecated Use EXPLORE_SHEET_BOTTOM_INSET */
export const EXPLORE_SHEET_ATTRIBUTION_INSET = EXPLORE_SHEET_BOTTOM_INSET;

export type ExploreBottomSheetProps = {
  readonly children: ReactNode;
  /** Controlled snap index; defaults from `hasSelection` when omitted. */
  readonly snapIndex?: number;
  readonly hasSelection?: boolean;
  readonly reduceMotion?: boolean;
  readonly testID?: string;
  /** Lift sheet above the edition tab bar (from `useBottomTabBarHeight`). */
  readonly bottomInset?: number;
  /** Scrollable body for entity preview (facts + CTA below fold). */
  readonly scrollable?: boolean;
  /**
   * Records-rail mode: child is a BottomSheetFlatList (no View/ScrollView wrap)
   * so browse scrolling and sheet snap gestures stay in sync.
   */
  readonly sheetList?: boolean;
  /** Measured rail-header height; peek is sized to it. Undefined until first layout. */
  readonly peekHeaderHeight?: number;
  /** Fired when the sheet settles on peek / half / full. */
  readonly onSnapIndexChange?: (index: number) => void;
};

export function ExploreBottomSheet({
  children,
  snapIndex,
  hasSelection = false,
  reduceMotion = false,
  testID = 'explore-bottom-sheet',
  bottomInset = EXPLORE_SHEET_BOTTOM_INSET,
  scrollable = false,
  sheetList = false,
  peekHeaderHeight,
  onSnapIndexChange,
}: ExploreBottomSheetProps) {
  const resolvedIndex =
    snapIndex ?? (hasSelection ? EXPLORE_SHEET_HALF : EXPLORE_SHEET_PEEK);
  const snapPoints = useMemo(() => exploreSheetSnapPoints(peekHeaderHeight), [peekHeaderHeight]);

  return (
    <AppBottomSheet
      snapIndex={resolvedIndex}
      snapPoints={snapPoints}
      reduceMotion={reduceMotion}
      bottomInset={bottomInset}
      scrollable={scrollable}
      sheetList={sheetList}
      testID={testID}
      accessibilityLabel="Explore records sheet"
      onSnapIndexChange={onSnapIndexChange}
    >
      {children}
    </AppBottomSheet>
  );
}
