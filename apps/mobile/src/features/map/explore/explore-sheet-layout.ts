/**
 * Explore sheet geometry helpers — keep map attribution and overlays clear of
 * the gorhom sheet when it is lifted by the tab-bar `bottomInset`.
 */

/** Peek / half / full as fractions of the sheet container (above the tab bar). */
export const EXPLORE_SHEET_PEEK_FRACTION = 0.16;
export const EXPLORE_SHEET_HALF_FRACTION = 0.32;
export const EXPLORE_SHEET_FULL_FRACTION = 0.48;

/**
 * Pixel `bottom` for map attribution so the pill sits just above the peek sheet.
 * A bare percentage matches the HTML prototype, but native Explore passes
 * `bottomInset={tabBarHeight}` — the sheet rises while attribution stayed at
 * `22%`, so the OpenStreetMap / OpenMapTiles pill covered the rail and handle.
 */
export function attributionBottomAbovePeekSheet(options: {
  readonly mapAreaHeight: number;
  readonly tabBarInset: number;
  readonly peekFraction?: number;
  readonly gapPx?: number;
}): number {
  const peekFraction = options.peekFraction ?? EXPLORE_SHEET_PEEK_FRACTION;
  const gapPx = options.gapPx ?? 8;
  const { mapAreaHeight, tabBarInset } = options;
  if (mapAreaHeight <= 0) {
    return tabBarInset + Math.round(160 * peekFraction) + gapPx;
  }
  const usable = Math.max(mapAreaHeight - tabBarInset, 0);
  return Math.round(tabBarInset + usable * peekFraction + gapPx);
}
