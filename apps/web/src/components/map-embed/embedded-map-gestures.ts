/**
 * Gesture policy for a map that lives inside a scrolling page and can grow to full screen in place.
 *
 *   In the page:  MapLibre's own `cooperativeGestures` — one finger scrolls the page (MapLibre
 *                 shows its "use two fingers" hint), two fingers pan and pinch the map, and on a
 *                 desktop a plain wheel scrolls while Ctrl/⌘ + wheel (or a trackpad pinch) zooms.
 *                 The supported version of Google's `cooperative`, not a hand-written one.
 *   Full screen:  every gesture, one finger pans (Google's `greedy`): there is no page to scroll.
 *
 * Neither state tilts (two-finger vertical drags are the classic accidental pitch) or rotates on
 * a pinch: this is a north-up locator of one place.
 *
 * Structural target type so the policy is testable under `node:test` without WebGL.
 */

export type EmbedGestureHandle = { enable(): void; disable(): void };

export type EmbedGestureTarget = {
  readonly cooperativeGestures: EmbedGestureHandle;
  readonly dragPan: EmbedGestureHandle;
  readonly scrollZoom: EmbedGestureHandle;
  readonly doubleClickZoom: EmbedGestureHandle;
  readonly keyboard: EmbedGestureHandle;
  readonly dragRotate: EmbedGestureHandle;
  readonly touchPitch: EmbedGestureHandle;
  readonly touchZoomRotate: EmbedGestureHandle & {
    enableRotation?(): void;
    disableRotation(): void;
  };
};

export function applyEmbeddedGestures(map: EmbedGestureTarget, expanded: boolean): void {
  map.dragPan.enable();
  map.scrollZoom.enable();
  map.doubleClickZoom.enable();
  map.keyboard.enable();
  map.touchZoomRotate.enable();
  map.touchZoomRotate.disableRotation();
  map.dragRotate.disable();
  map.touchPitch.disable();
  if (expanded) map.cooperativeGestures.disable();
  else map.cooperativeGestures.enable();
}

/** Where the frame animates from/to: the in-page slot's box, as fixed-position CSS. */
export function fixedBoxFor(rect: {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}): { top: string; left: string; width: string; height: string } {
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}
