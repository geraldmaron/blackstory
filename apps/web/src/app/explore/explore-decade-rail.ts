/**
 * Explore decade dock drag helpers. Click-and-drag scrolls the overflow strip;
 * a short press still selects via the tab button. Pointer capture keeps MapLibre
 * from stealing the pan.
 */

export type DecadeRailStop = string;

/** Ordered stops: `all` then each catalog decade. */
export function buildDecadeRailStops(
  entityDecades: readonly { readonly decade: string }[],
): readonly DecadeRailStop[] {
  return ['all', ...entityDecades.map((entry) => entry.decade)];
}

export function decadeStopToEra(stop: DecadeRailStop): string | undefined {
  return stop === 'all' ? undefined : stop;
}

/** Movement past this (px) counts as a drag, not a tap. */
export const DECADE_RAIL_DRAG_THRESHOLD_PX = 6;

export type DecadeRailDragState = {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startScrollLeft: number;
  moved: boolean;
};

/** Begin a horizontal drag-scroll gesture. */
export function beginDecadeRailDrag(
  list: HTMLElement,
  pointerId: number,
  clientX: number,
): DecadeRailDragState {
  return {
    pointerId,
    startClientX: clientX,
    startScrollLeft: list.scrollLeft,
    moved: false,
  };
}

/**
 * Apply pointer delta to `scrollLeft`. Returns whether the gesture has crossed
 * the drag threshold (so click should be suppressed on pointerup).
 */
export function applyDecadeRailDrag(
  list: HTMLElement,
  drag: DecadeRailDragState,
  clientX: number,
  thresholdPx: number = DECADE_RAIL_DRAG_THRESHOLD_PX,
): boolean {
  const deltaX = clientX - drag.startClientX;
  if (Math.abs(deltaX) >= thresholdPx) {
    drag.moved = true;
  }
  const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth);
  list.scrollLeft = Math.min(maxScroll, Math.max(0, drag.startScrollLeft - deltaX));
  return drag.moved;
}
