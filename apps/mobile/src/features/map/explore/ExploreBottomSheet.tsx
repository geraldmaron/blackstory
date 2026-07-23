/**
 * Gorhom bottom-sheet host for Explore: peek / half / full snaps over the
 * full-bleed map. Delegates to the shared AppBottomSheet primitive.
 *
 * Attribution is an overlay on the map above the peek (see MapAttribution), not
 * a reserved gap under the sheet — `bottomInset` stays 0 so the "In view" list
 * is never squeezed by a sandwich bar between sheet and tab bar (ADR-025 §8).
 * Sheet z-index stays above attribution so expanded content covers the pill.
 */
import type { ReactNode } from 'react';
import { AppBottomSheet } from '../../../ui/AppBottomSheet';

/** Snap indices: 0 = peek, 1 = half, 2 = full. */
export const EXPLORE_SHEET_PEEK = 0;
export const EXPLORE_SHEET_HALF = 1;
export const EXPLORE_SHEET_FULL = 2;

/**
 * Sheet bottom inset. Kept at 0 so the sheet sits flush in the map area; map
 * attribution clears the peek via MapAttribution's bottom offset instead.
 */
export const EXPLORE_SHEET_ATTRIBUTION_INSET = 0;

export type ExploreBottomSheetProps = {
  readonly children: ReactNode;
  readonly hasSelection?: boolean;
  readonly reduceMotion?: boolean;
  readonly testID?: string;
  /** Fired when the sheet settles on peek / half / full. */
  readonly onSnapIndexChange?: (index: number) => void;
};

export function ExploreBottomSheet({
  children,
  hasSelection = false,
  reduceMotion = false,
  testID = 'explore-bottom-sheet',
  onSnapIndexChange,
}: ExploreBottomSheetProps) {
  return (
    <AppBottomSheet
      expanded={hasSelection}
      reduceMotion={reduceMotion}
      bottomInset={EXPLORE_SHEET_ATTRIBUTION_INSET}
      testID={testID}
      accessibilityLabel="Explore metrics sheet"
      onSnapIndexChange={onSnapIndexChange}
    >
      {children}
    </AppBottomSheet>
  );
}
