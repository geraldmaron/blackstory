/**
 * Gorhom bottom-sheet host for Explore: peek / half / full snaps over the
 * full-bleed map. Delegates to the shared AppBottomSheet primitive.
 *
 * Snap heights mirror the v7 HTML prototype (22% / 42% / 58% of the tab
 * content area). The sheet renders inside the Explore tab screen, so it sits
 * above the tab bar without a bottom inset; map attribution overlays the peek
 * sliver instead of reserving a gap under the sheet (ADR-025 §8).
 */
import type { ReactNode } from 'react';
import { AppBottomSheet } from '../../../ui/AppBottomSheet';

/** Snap indices: 0 = peek, 1 = half, 2 = full browse. */
export const EXPLORE_SHEET_PEEK = 0;
export const EXPLORE_SHEET_HALF = 1;
export const EXPLORE_SHEET_FULL = 2;

/** v7 prototype detents — peek rail, preview half, full browse. */
export const EXPLORE_SHEET_SNAP_POINTS = ['22%', '42%', '58%'] as const;

/** Peek height as a percentage string (instruments panel + attribution clearance). */
export const EXPLORE_SHEET_PEEK_HEIGHT: `${number}%` = '22%';

/**
 * Sheet bottom inset. Kept at 0 — Explore tab content already ends above the
 * tab bar; safe-area padding lives on the tab bar itself.
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
  /** Fired when the sheet settles on peek / half / full. */
  readonly onSnapIndexChange?: (index: number) => void;
};

export function ExploreBottomSheet({
  children,
  snapIndex,
  hasSelection = false,
  reduceMotion = false,
  testID = 'explore-bottom-sheet',
  onSnapIndexChange,
}: ExploreBottomSheetProps) {
  const resolvedIndex =
    snapIndex ?? (hasSelection ? EXPLORE_SHEET_HALF : EXPLORE_SHEET_PEEK);

  return (
    <AppBottomSheet
      snapIndex={resolvedIndex}
      snapPoints={EXPLORE_SHEET_SNAP_POINTS}
      reduceMotion={reduceMotion}
      bottomInset={EXPLORE_SHEET_BOTTOM_INSET}
      testID={testID}
      accessibilityLabel="Explore records sheet"
      onSnapIndexChange={onSnapIndexChange}
    >
      {children}
    </AppBottomSheet>
  );
}
