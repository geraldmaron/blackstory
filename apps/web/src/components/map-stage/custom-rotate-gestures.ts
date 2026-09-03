/**
 * Rotate triggers `dragRotate` and `touchZoomRotate` do not cover on their own.
 *
 * MapLibre's native `dragRotate` binds to a right-click drag or a Ctrl/Cmd+left-drag — correct,
 * but not discoverable, and it says nothing to a trackpad. The gap this module closes is
 * platform, not MapLibre configuration: outside Safari, no browser exposes trackpad two-finger
 * *rotation* (twist) to web content at all — Chrome, Firefox and Edge only ever report the
 * aggregate as `wheel` deltas, which is why "twist to rotate" cannot be the map's only rotate
 * path. Three triggers close that gap without conflicting with `dragRotate`:
 *
 *   - Shift+drag: a `wheel`-free, purely synthetic gesture built from `pointer` events, so it
 *     works identically in every browser.
 *   - Shift+wheel: the trackpad answer everywhere twist is unavailable. A two-finger swipe with
 *     Shift held arrives as an ordinary `wheel` event in every engine, which is the only form a
 *     trackpad gesture takes outside Safari. Same modifier as the drag on purpose: one key means
 *     rotate, and the reader does not have to know whether they are holding a mouse or not.
 *   - Safari's native `gesturestart`/`gesturechange` events: real per-frame twist rotation,
 *     free correctness on exactly the platform (Mac trackpad + WebKit) that actually reports it.
 *
 * All three are gated by `rotateGestureAllowed` (`gesture-lock.ts`) at every call site — the same
 * posture rule that governs `dragRotate` itself, so a plate that has not handed rotation back to
 * the reader does not hand it back through a side door.
 *
 * The `attach*` functions carry no `node:test` coverage, matching `state-labels.ts`'s
 * `buildStateLabelElement`: each one reaches for DOM APIs (`PointerEvent`, `setPointerCapture`,
 * `GestureEvent`, a non-passive `wheel` listener) that plain Node has no implementation for, and
 * they are verified in the browser instead. `wheelRotateDeltaPx` is pure and is tested.
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
 * Degrees of bearing per pixel of Shift+wheel delta. Lower than the drag rate: a trackpad swipe
 * keeps emitting deltas after the fingers lift (kinetic scrolling), so the same rate that feels
 * right under a held pointer overshoots badly under a flick.
 */
const SHIFT_WHEEL_DEGREES_PER_PIXEL = 0.2;

/** `deltaMode` is lines or pages on some mice; normalize both to pixels before scaling. */
const WHEEL_LINE_HEIGHT_PX = 16;
const WHEEL_PAGE_HEIGHT_PX = 400;

/** A wheel event's rotation intent: the dominant axis, in pixels. */
export function wheelRotateDeltaPx(event: {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode?: number;
}): number {
  const raw = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!Number.isFinite(raw)) return 0;
  if (event.deltaMode === 1) return raw * WHEEL_LINE_HEIGHT_PX;
  if (event.deltaMode === 2) return raw * WHEEL_PAGE_HEIGHT_PX;
  return raw;
}

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

/**
 * Shift+wheel rotate: the trackpad path in every browser that is not Safari.
 *
 * A bare wheel is left completely alone — on the Door the wheel is the page's scroll and jacking
 * it is the one defect the ambient posture exists to prevent (`gesture-lock.ts`). Only a
 * Shift-held wheel is claimed, and a Ctrl-held one is refused outright: that is what a trackpad
 * pinch arrives as, and pinch is zoom's, not rotation's.
 *
 * Shift held with a two-finger swipe is reported on `deltaX` by some engines and `deltaY` by
 * others, which is why the dominant axis decides rather than a fixed one.
 */
export function attachShiftWheelRotate(
  map: RotateTarget,
  container: HTMLElement,
): RotateGestureHandle {
  const onWheel = (event: WheelEvent) => {
    if (!event.shiftKey || event.ctrlKey || event.metaKey) return;
    const delta = wheelRotateDeltaPx(event);
    if (delta === 0) return;
    map.setBearing(map.getBearing() - delta * SHIFT_WHEEL_DEGREES_PER_PIXEL);
    event.preventDefault();
    event.stopPropagation();
  };

  // Not passive: this gesture's whole job is to take the wheel away from the document, which a
  // passive listener is not allowed to do.
  container.addEventListener('wheel', onWheel, { capture: true, passive: false });

  return {
    detach() {
      container.removeEventListener('wheel', onWheel, { capture: true });
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
