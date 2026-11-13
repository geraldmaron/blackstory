/**
 * Camera padding for the Explore chrome: the part of the canvas that chrome covers, so a framed
 * record or area lands in the map a reader can actually see.
 *
 * Two layouts, one per breakpoint (explore-column.css):
 *  - Wide (768px and up): the 380px column floating 12px in from the left edge, the 56px decade
 *    histogram floating 12px above the bottom edge, the zoom and locate stack bottom-right, and
 *    the header above it all. The map runs under all of it, so the padding is what they cover.
 *  - Phone: the header on top, the bottom sheet at its current (or about to be) height, and the
 *    tab bar under the sheet. The sides take only a slim gutter: the controls sit in the corner
 *    above the sheet, never across the middle of the map.
 *
 * MapLibre throws `Map cannot fit within canvas with the given bounds, padding, and/or offset`
 * when the padding leaves no room, and that throw kills map init outright, so every inset is
 * clamped to leave part of each axis free.
 *
 * Pure and framework-free so the clamp is unit-testable without a WebGL context.
 */

export type ChromeInset = { top: number; right: number; bottom: number; left: number };

export type ChromeState = {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Phone only: the height of the bottom sheet, measured from the viewport's bottom edge
   * (tab bar included). Ignored on the wide layout. */
  readonly sheetHeight?: number;
};

/** Below this width Explore is a full-screen map with a bottom sheet (explore-column.css). */
export const EXPLORE_PHONE_MAX_WIDTH = 767;

/** The floating left column. */
export const EXPLORE_COLUMN_WIDTH = 380;
/** The gutter every floating plate keeps from the viewport edge (`--ds-xfloat`). */
export const EXPLORE_FLOAT_GUTTER = 12;
/** The decade histogram docked on the map's bottom edge. */
export const EXPLORE_HISTOGRAM_HEIGHT = 56;

const WIDE_HEADER = 56;
const PHONE_HEADER = 48;
/** Air between the framed thing and the chrome around it. */
const GAP = 24;
/** The 44px zoom and locate stack plus its gutter. */
const CONTROLS = 44 + EXPLORE_FLOAT_GUTTER;

/** Share of each axis the padding may consume before it gets scaled back. */
const MAX_HORIZONTAL_SHARE = 0.6;
const MAX_VERTICAL_SHARE = 0.72;

export function chromePadding(state: ChromeState): ChromeInset {
  const { viewportWidth, viewportHeight } = state;
  let top: number;
  let right: number;
  let bottom: number;
  let left: number;

  if (viewportWidth <= EXPLORE_PHONE_MAX_WIDTH) {
    top = PHONE_HEADER + GAP;
    // Symmetric and slim: the country fills the phone's width, and a framed record lands on the
    // center line, clear of the controls stacked at the right edge just above the sheet.
    right = GAP / 2;
    left = GAP / 2;
    bottom = Math.max(0, state.sheetHeight ?? 0) + GAP;
  } else {
    top = WIDE_HEADER + GAP;
    right = CONTROLS + GAP / 2;
    left = EXPLORE_FLOAT_GUTTER + EXPLORE_COLUMN_WIDTH + GAP;
    bottom = EXPLORE_FLOAT_GUTTER + EXPLORE_HISTOGRAM_HEIGHT + GAP;
  }

  // Horizontal clamp: scale both sides by one factor so the camera stays centered on the free area.
  const maxHorizontal = viewportWidth * MAX_HORIZONTAL_SHARE;
  if (left + right > maxHorizontal) {
    const k = maxHorizontal / (left + right);
    left = Math.floor(left * k);
    right = Math.floor(right * k);
  }

  const maxVertical = viewportHeight * MAX_VERTICAL_SHARE;
  if (top + bottom > maxVertical) {
    const k = maxVertical / (top + bottom);
    top = Math.floor(top * k);
    bottom = Math.floor(bottom * k);
  }

  return { top, right, bottom, left };
}
