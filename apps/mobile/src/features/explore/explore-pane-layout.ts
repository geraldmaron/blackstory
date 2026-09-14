/**
 * Explore's wide-window geometry: when the map gets a persistent records rail beside it
 * instead of a bottom sheet over it, and how wide that rail is.
 *
 * `LayoutSize.supportsTwoPane` answers "is this window big enough for two panes at all".
 * It is not enough on its own here, because it says nothing about how much window each
 * pane would actually get. A 600x800pt window clears `supportsTwoPane`, but a rail wide
 * enough to hold a record row leaves the map under 300pt, and a 300pt map is not a map —
 * it is a thumbnail with gestures. So Explore adds one floor of its own: whatever is left
 * after the rail must still be a usable map, or the sheet stays.
 *
 * Both numbers are in dp and both come off the live window, so dragging a split-view
 * divider moves the app between the two layouts the same way rotating does.
 */
import type { LayoutSize } from '@/ui/layout';

/**
 * Narrowest rail that can hold a record row without wrapping the caption under the title.
 * Below this the rail stops being a list and becomes a column of ellipses.
 */
export const EXPLORE_RAIL_MIN_WIDTH = 300;

/**
 * Widest the rail grows. Past this the extra width buys nothing — the rows are one line of
 * title over one line of caption — and it is taken from the map, which always has a use for it.
 */
export const EXPLORE_RAIL_MAX_WIDTH = 400;

/** Share of the window the rail takes between the two clamps. */
export const EXPLORE_RAIL_WIDTH_FRACTION = 0.33;

/**
 * Smallest map pane worth showing. Below this a pin and its neighbours cannot be told apart
 * without a zoom, which defeats the point of keeping the map on screen next to the list.
 */
export const EXPLORE_MAP_MIN_WIDTH = 360;

export type ExplorePaneLayout =
  /** Phone posture: full-bleed map with the records sheet over it. */
  | { readonly kind: 'sheet' }
  /** Tablet posture: map pane beside a persistent records rail. */
  | { readonly kind: 'two-pane'; readonly railWidth: number; readonly mapWidth: number };

function railWidthFor(windowWidth: number): number {
  const proportional = windowWidth * EXPLORE_RAIL_WIDTH_FRACTION;
  return Math.round(
    Math.min(EXPLORE_RAIL_MAX_WIDTH, Math.max(EXPLORE_RAIL_MIN_WIDTH, proportional)),
  );
}

/**
 * Picks Explore's posture for a window, and sizes the panes when it picks two of them.
 *
 * Pure and window-driven — no device check, no orientation check. An iPad in Slide Over is
 * handed a ~320pt column and gets the sheet; an unfolded foldable at 700pt gets the rail.
 */
export function explorePaneLayout(size: LayoutSize): ExplorePaneLayout {
  if (!size.supportsTwoPane) return { kind: 'sheet' };

  const railWidth = railWidthFor(size.width);
  const mapWidth = size.width - railWidth;
  if (mapWidth < EXPLORE_MAP_MIN_WIDTH) return { kind: 'sheet' };

  return { kind: 'two-pane', railWidth, mapWidth };
}
