/**
 * The Door's map window: the box on screen the live plate frames its camera against.
 *
 * The plate is one fixed, full-viewport canvas shared with Explore (MapStage.tsx), but on `/` the
 * reader only ever sees part of it: below the bar on a desktop, and inside the sticky strip above
 * the chapters on a phone. A national frame fitted to the whole canvas put the 49th parallel under
 * the bar and, on a phone, the country behind the cards; and because it was fitted once, for the
 * viewport the plate happened to be built in, a window resized afterwards kept the old zoom and
 * lost a coast or two (repo-18ma2).
 *
 * So the frame is derived from the window's own rect, every time it changes. `doorFramePadding`
 * turns the window into `cameraForBounds` padding (the plate fits CONUS inside the window, below
 * the field chrome, with a small margin); `doorFrameOffset` turns it into the `flyTo` offset a
 * place chapter needs so the place lands in the middle of the window rather than the middle of
 * the canvas. Both are plain arithmetic over rects so they can be pinned under `node:test`
 * without a DOM.
 */

export type DoorFrameBox = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

export type DoorFramePadding = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** Margin inside the window, as a share of its shorter side. */
export const DOOR_FRAME_MARGIN_RATIO = 0.05;
/** Never tighter than this: a phone strip still gets a hairline of ocean around the coasts. */
export const DOOR_FRAME_MARGIN_MIN_PX = 12;
/** Never looser than this: the field chrome, not the margin, is what keeps the country down. */
export const DOOR_FRAME_MARGIN_MAX_PX = 32;
/** A padded box smaller than this is a collapsed strip or a mid-reflow read, not a frame. */
export const DOOR_FRAME_MIN_BOX_PX = 48;

function isPaintable(box: DoorFrameBox): boolean {
  return (
    Number.isFinite(box.top) &&
    Number.isFinite(box.left) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  );
}

/** The margin the window asks for, from its own shorter side. */
export function doorFrameMargin(window: DoorFrameBox): number {
  const raw = Math.round(Math.min(window.width, window.height) * DOOR_FRAME_MARGIN_RATIO);
  return Math.min(DOOR_FRAME_MARGIN_MAX_PX, Math.max(DOOR_FRAME_MARGIN_MIN_PX, raw));
}

/**
 * `cameraForBounds` padding that fits a bounds box inside `window`, on a plate whose canvas
 * occupies `plate`, below whatever field `chrome` sits along the window's top edge (the pin
 * count and the rotate hint on a desktop; nothing on a phone, where the chrome is hidden and
 * measures as an empty box). All rects share one coordinate space (viewport pixels from
 * `getBoundingClientRect`). `null` when a rect is degenerate or the window leaves the plate less
 * than `DOOR_FRAME_MIN_BOX_PX` to draw in, which callers treat as "keep the current frame".
 */
export function doorFramePadding(
  window: DoorFrameBox,
  plate: DoorFrameBox,
  chrome: DoorFrameBox | null = null,
): DoorFramePadding | null {
  if (!isPaintable(window) || !isPaintable(plate)) return null;
  const margin = doorFrameMargin(window);
  const chromeBand =
    chrome !== null && isPaintable(chrome)
      ? Math.max(0, chrome.top + chrome.height - window.top)
      : 0;
  const padding = {
    top: Math.max(0, window.top - plate.top + chromeBand + margin),
    left: Math.max(0, window.left - plate.left + margin),
    right: Math.max(0, plate.left + plate.width - (window.left + window.width) + margin),
    bottom: Math.max(0, plate.top + plate.height - (window.top + window.height) + margin),
  };
  if (
    plate.width - padding.left - padding.right < DOOR_FRAME_MIN_BOX_PX ||
    plate.height - padding.top - padding.bottom < DOOR_FRAME_MIN_BOX_PX
  ) {
    return null;
  }
  return padding;
}

/**
 * Screen-pixel offset from the plate's center to the window's center — MapLibre's `offset`
 * camera option, which moves where a `center` lands without touching the transform's padding.
 */
export function doorFrameOffset(
  window: DoorFrameBox,
  plate: DoorFrameBox,
): readonly [x: number, y: number] | null {
  if (!isPaintable(window) || !isPaintable(plate)) return null;
  return [
    window.left + window.width / 2 - (plate.left + plate.width / 2),
    window.top + window.height / 2 - (plate.top + plate.height / 2),
  ];
}

/** Whole-pixel equality, so a sub-pixel jitter from a scrollbar or a font swap is not a resize. */
export function sameDoorFrameBox(a: DoorFrameBox | null, b: DoorFrameBox | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}
