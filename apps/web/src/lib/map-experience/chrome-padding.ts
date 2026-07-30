/**
 * Camera padding for the Atlas instrument chrome.
 *
 * MapLibre throws `Map cannot fit within canvas with the given bounds, padding, and/or offset`
 * when the requested padding leaves no room on the canvas, and that throw kills map init
 * outright. The instrument panels (Lens, Results, Record sheet) are wide enough to trigger it on
 * a laptop viewport once two of them are open, so every inset this returns is clamped to leave at
 * least half the canvas free on each axis.
 *
 * Pure and framework-free so the clamp is unit-testable without a WebGL context.
 * See docs/ui/design-direction-v9-atlas.md §4.2 rule 3.
 */

export type ChromeInset = { top: number; right: number; bottom: number; left: number };

export type ChromeState = {
  viewportWidth: number;
  viewportHeight: number;
  lensOpen: boolean;
  resultsOpen: boolean;
  sheetOpen: boolean;
};

/** Below this width the instruments stack over the map instead of flanking it. */
export const CHROME_NARROW_MAX_WIDTH = 820;

/** Panel widths the padding has to clear, including their viewport gutter. */
const LENS_INSET = 330;
const RESULTS_INSET = 376;
const SHEET_INSET = 468;
const OPEN_EDGE_INSET = 40;

const NARROW_TOP = 88;
const NARROW_SIDE = 16;
const NARROW_BOTTOM_MAX = 210;
const NARROW_BOTTOM_RATIO = 0.3;

const WIDE_TOP = 96;
const WIDE_BOTTOM_MAX = 160;
const WIDE_BOTTOM_RATIO = 0.22;

/** Share of each axis the padding may consume before it gets scaled back. */
const MAX_AXIS_SHARE = 0.5;

/** Symmetric inset used when even the clamped vertical padding would not fit. */
const VERTICAL_FALLBACK = 40;

export function chromePadding(state: ChromeState): ChromeInset {
  const { viewportWidth, viewportHeight } = state;
  const narrow = viewportWidth < CHROME_NARROW_MAX_WIDTH;

  let left: number;
  let right: number;
  let top: number;
  let bottom: number;

  if (narrow) {
    left = NARROW_SIDE;
    right = NARROW_SIDE;
    top = NARROW_TOP;
    bottom = Math.round(Math.min(NARROW_BOTTOM_MAX, viewportHeight * NARROW_BOTTOM_RATIO));
  } else {
    left = state.lensOpen ? LENS_INSET : OPEN_EDGE_INSET;
    right = state.sheetOpen ? SHEET_INSET : state.resultsOpen ? RESULTS_INSET : OPEN_EDGE_INSET;
    top = WIDE_TOP;
    bottom = Math.round(Math.min(WIDE_BOTTOM_MAX, viewportHeight * WIDE_BOTTOM_RATIO));
  }

  // Horizontal clamp: scale both sides by the same factor so the camera stays centred on the
  // free area rather than drifting toward whichever panel happened to be narrower.
  const maxHorizontal = viewportWidth * MAX_AXIS_SHARE;
  if (left + right > maxHorizontal) {
    const k = maxHorizontal / (left + right);
    left = Math.floor(left * k);
    right = Math.floor(right * k);
  }

  // Vertical guard. Applied on both branches, not just the wide one: a short narrow viewport
  // (a landscape phone, or a browser with a large chrome bar) hits this before any desktop size
  // does, and a throw there is just as fatal.
  if (top + bottom > viewportHeight * MAX_AXIS_SHARE) {
    top = VERTICAL_FALLBACK;
    bottom = VERTICAL_FALLBACK;
  }

  // Last resort for viewports too small for even the fallback, so the contract
  // (`top + bottom < viewportHeight`) holds for every input rather than almost every input.
  if (top + bottom > viewportHeight * MAX_AXIS_SHARE) {
    const k = (viewportHeight * MAX_AXIS_SHARE) / (top + bottom);
    top = Math.floor(top * k);
    bottom = Math.floor(bottom * k);
  }

  return { top, right, bottom, left };
}
