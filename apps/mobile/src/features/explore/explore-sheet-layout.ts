/**
 * Explore sheet geometry helpers — keep map attribution and overlays clear of
 * the gorhom sheet when it is lifted by the tab-bar `bottomInset`.
 */
import { MIN_TOUCH_TARGET, space } from '@/ui';

/** Peek / half / full as fractions of the sheet container (above the tab bar). Pin Pulse: map owns first glance. */
export const EXPLORE_SHEET_PEEK_FRACTION = 0.11;
export const EXPLORE_SHEET_HALF_FRACTION = 0.34;
export const EXPLORE_SHEET_FULL_FRACTION = 0.52;

/**
 * Fallback peek height in points, used only until the rail header has measured itself.
 *
 * Handle (44dp touch target) plus a header row at its own 44dp minimum with `space['2']` padding
 * above and below. The real value replaces this on the first layout pass.
 */
export const EXPLORE_SHEET_PEEK_FALLBACK_PX = MIN_TOUCH_TARGET + MIN_TOUCH_TARGET + space['2'] * 2;

/**
 * The peek detent, in points: the handle plus whatever the rail header actually measured.
 *
 * Peek used to be `11%` of the sheet container. A fraction of the screen is not the height of a
 * header, so on a 402x874pt phone the detent came out taller than its content and left a band of
 * empty Archive Paper above the tab bar, while the header's own control was clipped by the same
 * detent (repo-pmi5n). Nothing but the handle and the header is visible at peek, so nothing else
 * is reserved — and because the header is measured rather than assumed, this stays correct at
 * large type sizes, where a fixed height would clip the row it was meant to show.
 */
export function explorePeekHeightPx(measuredHeaderHeight: number | undefined): number {
  if (measuredHeaderHeight === undefined || !Number.isFinite(measuredHeaderHeight)) {
    return EXPLORE_SHEET_PEEK_FALLBACK_PX;
  }
  if (measuredHeaderHeight <= 0) return EXPLORE_SHEET_PEEK_FALLBACK_PX;
  return Math.ceil(MIN_TOUCH_TARGET + measuredHeaderHeight);
}

/** Default clearance gap between the attribution pill and the peek sheet top. */
const ATTRIBUTION_GAP_PX = space['3'];

/**
 * Pixel `bottom` for map attribution so the pill sits just above the peek sheet.
 *
 * gorhom resolves a percentage snap point against the FULL sheet container height,
 * so the peek sheet top lands at `tabBarInset + mapAreaHeight * peekFraction`
 * (the inset is NOT subtracted before applying the fraction). An earlier
 * `usable = mapAreaHeight - tabBarInset` computation placed the pill a few px
 * UNDER the sheet; match gorhom's geometry exactly and add a clearance gap.
 */
export function attributionBottomAbovePeekSheet(options: {
  readonly mapAreaHeight: number;
  readonly tabBarInset: number;
  /** Measured rail-header height. Given, the pill clears the same detent the sheet actually uses. */
  readonly peekHeaderHeight?: number;
  readonly peekFraction?: number;
  readonly gapPx?: number;
}): number {
  const gapPx = options.gapPx ?? ATTRIBUTION_GAP_PX;
  const { mapAreaHeight, tabBarInset } = options;
  // Peek is a point height now, so the pill clears a measured sheet rather than a fraction of the
  // screen. Keeping the old fractional maths here would put the pill under the sheet on any phone
  // where the two disagree — which, after repo-pmi5n, is every phone.
  if (options.peekHeaderHeight !== undefined) {
    return Math.round(tabBarInset + explorePeekHeightPx(options.peekHeaderHeight) + gapPx);
  }
  const peekFraction = options.peekFraction ?? EXPLORE_SHEET_PEEK_FRACTION;
  if (mapAreaHeight <= 0) {
    return tabBarInset + Math.round(160 * peekFraction) + gapPx;
  }
  return Math.round(tabBarInset + mapAreaHeight * peekFraction + gapPx);
}
