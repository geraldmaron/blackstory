/**
 * Rotate triggers `dragRotate` and `touchZoomRotate` do not cover on their own.
 *
 * MapLibre's native `dragRotate` binds to a right-click drag or a Ctrl/Cmd+left-drag — correct,
 * but not discoverable, and it says nothing to a trackpad. The gap this module closes is
 * platform, not MapLibre configuration: outside Safari, no browser exposes trackpad two-finger
 * *rotation* (twist) to web content at all — Chrome, Firefox and Edge only ever report the
 * aggregate as `wheel` deltas, which is why "twist to rotate" cannot be the map's only rotate
 * path. Two triggers close that gap without conflicting with `dragRotate`:
 *
 *   - Shift+drag: a `wheel`-free, purely synthetic gesture built from `pointer` events, so it
 *     works identically in every browser.
 *   - Safari's native `gesturestart`/`gesturechange` events: real per-frame twist rotation,
 *     free correctness on exactly the platform (Mac trackpad + WebKit) that actually reports it.
 *
 * Both are gated by `rotateGestureAllowed` (`gesture-lock.ts`) at every call site — the same
 * posture rule that governs `dragRotate` itself, so a plate that has not handed rotation back to
 * the reader does not hand it back through a side door.
 *
 * No `node:test` coverage here, matching `state-labels.ts`'s `buildStateLabelElement`: every
 * export below calls `document.createElement`-adjacent DOM APIs (`PointerEvent`,
 * `setPointerCapture`, `GestureEvent`) that plain Node has no implementation for. Verified in the
 * browser instead.
 */

/** What these gestures need off the live map. Structural, matching `gesture-lock.ts`'s own
 * `GestureTarget` convention, so this stays testable without a real MapLibre instance. */
export type RotateTarget = {
  getBearing(): number;
  setBearing(bearing: number): unknown;
};

export type RotateGestureHandle = {
  /** Removes every listener this attach call added. Idempotent. */
  detach(): void;
};

/** Degrees of bearing per horizontal pixel of Shift+drag. Tuned so a full-width drag on a
 * typical viewport (~1200px) covers a bit more than one full turn — enough range to feel free,
 * not so much that a small drag overshoots past usable framing. */
const SHIFT_DRAG_DEGREES_PER_PIXEL = 0.35;

/**
 * Shift+drag rotate. Listens on `pointerdown`/`pointermove`/`pointerup` rather than MapLibre's
 * own drag handler because the modifier condition (Shift, not Ctrl/Cmd or the right button) is
 * not one `dragRotate` supports, and this needs to coexist with `dragPan`'s plain left-drag
 * without stealing it — only a Shift-held press engages rotate; a bare drag falls through
 * untouched to MapLibre's own handlers.
 */
export function attachShiftDragRotate(
  map: RotateTarget,
  container: HTMLElement,
): RotateGestureHandle {
  let pointerId: number | null = null;
  let lastClientX = 0;

  const onPointerDown = (event: PointerEvent) => {
    if (!event.shiftKey || event.button !== 0 || pointerId !== null) return;
    pointerId = event.pointerId;
    lastClientX = event.clientX;
    container.setPointerCapture(event.pointerId);
    // Shift+drag is this gesture's alone — MapLibre's own dragPan must not also pan underneath it.
    event.preventDefault();
    event.stopPropagation();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - lastClientX;
    lastClientX = event.clientX;
    map.setBearing(map.getBearing() - deltaX * SHIFT_DRAG_DEGREES_PER_PIXEL);
    event.preventDefault();
    event.stopPropagation();
  };

  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    pointerId = null;
  };

  // Capture phase: this must see the press before MapLibre's own canvas listeners decide it is a
  // plain drag.
  container.addEventListener('pointerdown', onPointerDown, { capture: true });
  container.addEventListener('pointermove', onPointerMove, { capture: true });
  container.addEventListener('pointerup', endDrag, { capture: true });
  container.addEventListener('pointercancel', endDrag, { capture: true });

  return {
    detach() {
      container.removeEventListener('pointerdown', onPointerDown, { capture: true });
      container.removeEventListener('pointermove', onPointerMove, { capture: true });
      container.removeEventListener('pointerup', endDrag, { capture: true });
      container.removeEventListener('pointercancel', endDrag, { capture: true });
    },
  };
}

/** WebKit's proprietary gesture events — not in any standard `HTMLElementEventMap`. */
type SafariGestureEvent = Event & { readonly rotation: number };

/** True only where the browser actually reports these — real feature detection, not a UA
 * sniff: Safari is the only engine that has ever shipped `GestureEvent`. */
function supportsSafariGestureEvents(): boolean {
  return typeof window !== 'undefined' && 'ongesturestart' in window;
}

/**
 * Safari's native two-finger trackpad twist. `event.rotation` is cumulative degrees since
 * `gesturestart`, so each `gesturechange` sets bearing from a fixed start value rather than
 * accumulating deltas — the same "current value, not a delta" shape MapStage's other selection
 * state already uses, and it is what keeps this immune to a dropped event.
 *
 * Only `rotation` is read; `event.scale` (pinch) is left alone; MapLibre's own wheel-based pinch
 * handling already owns zoom, and touching scale here would fight it.
 */
export function attachSafariTwistRotate(
  map: RotateTarget,
  container: HTMLElement,
): RotateGestureHandle {
  if (!supportsSafariGestureEvents()) {
    return { detach() {} };
  }

  let startBearing = 0;

  const onGestureStart = (event: Event) => {
    startBearing = map.getBearing();
    event.preventDefault();
  };
  const onGestureChange = (event: Event) => {
    const rotation = (event as SafariGestureEvent).rotation;
    if (typeof rotation !== 'number') return;
    // WebKit's positive rotation is counter-clockwise; MapLibre's positive bearing is clockwise.
    map.setBearing(startBearing - rotation);
    event.preventDefault();
  };

  container.addEventListener('gesturestart', onGestureStart as EventListener);
  container.addEventListener('gesturechange', onGestureChange as EventListener);

  return {
    detach() {
      container.removeEventListener('gesturestart', onGestureStart as EventListener);
      container.removeEventListener('gesturechange', onGestureChange as EventListener);
    },
  };
}
