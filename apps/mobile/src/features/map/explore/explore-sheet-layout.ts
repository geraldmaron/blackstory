/**
 * Explore sheet geometry helpers — keep map attribution and overlays clear of
 * the gorhom sheet when it is lifted by the tab-bar `bottomInset`.
 */
import { space } from '@/ui';

/** Peek / half / full as fractions of the sheet container (above the tab bar). */
export const EXPLORE_SHEET_PEEK_FRACTION = 0.16;
export const EXPLORE_SHEET_HALF_FRACTION = 0.32;
export const EXPLORE_SHEET_FULL_FRACTION = 0.48;

/** Default clearance gap between the attribution pill and the peek sheet top. */
const ATTRIBUTION_GAP_PX = space['3'];

/**
 * Pixel `bottom` for map attribution so the pill sits just above the peek sheet.
 *
 * gorhom resolves a `'16%'` snap point against the FULL sheet container height,
 * so the peek sheet top lands at `tabBarInset + mapAreaHeight * peekFraction`
 * (the inset is NOT subtracted before applying the fraction). An earlier
 * `usable = mapAreaHeight - tabBarInset` computation placed the pill a few px
 * UNDER the sheet; match gorhom's geometry exactly and add a clearance gap.
 */
export function attributionBottomAbovePeekSheet(options: {
  readonly mapAreaHeight: number;
  readonly tabBarInset: number;
  readonly peekFraction?: number;
  readonly gapPx?: number;
}): number {
  const peekFraction = options.peekFraction ?? EXPLORE_SHEET_PEEK_FRACTION;
  const gapPx = options.gapPx ?? ATTRIBUTION_GAP_PX;
  const { mapAreaHeight, tabBarInset } = options;
  if (mapAreaHeight <= 0) {
    return tabBarInset + Math.round(160 * peekFraction) + gapPx;
  }
  return Math.round(tabBarInset + mapAreaHeight * peekFraction + gapPx);
}
