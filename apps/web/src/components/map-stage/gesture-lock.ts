/**
 * Gesture locking for the non-Live postures.
 *
 * Design law: `docs/ui/design-direction-v9-surfaces.md` §3.
 *
 * A Framed plate is inset into a document that scrolls. If its gestures stayed live, a reader
 * scrolling past a map moment would have the wheel captured by the map and the page would stop
 * under them — the single most reliable way to make an embedded map feel broken. A Parked plate
 * locks for a different reason: it is not painted, and an invisible element that still answers
 * the keyboard is a trap for anyone tabbing through.
 *
 * So both non-Live postures lock, and Live is the only posture that steers.
 *
 * `GestureTarget` is a structural type rather than `maplibregl.Map` on purpose, matching the
 * narrowing `AtlasCameraTarget` already uses in this directory. It keeps this module honest under
 * `node:test`, where there is no WebGL and no MapLibre: the lock can be proven over a plain object
 * that counts its own calls. The alternative — asserting on a real map — is not a test that can
 * run in this repo's harness at all.
 */

/** The six handlers MapLibre exposes that can move or rotate the camera. */
export type GestureHandle = {
  disable(): void;
  enable(): void;
};

export type GestureTarget = {
  readonly scrollZoom: GestureHandle;
  readonly dragPan: GestureHandle;
  readonly dragRotate: GestureHandle;
  readonly touchZoomRotate: GestureHandle;
  readonly doubleClickZoom: GestureHandle;
  readonly keyboard: GestureHandle;
};

/**
 * Named rather than inlined so `lockGestures` and `unlockGestures` cannot drift apart. The failure
 * mode this prevents is asymmetry: a handler disabled on entry and forgotten on exit leaves
 * Explore subtly dead — the map pans but will not rotate, and nothing points at the cause.
 */
const GESTURE_KEYS = [
  'scrollZoom',
  'dragPan',
  'dragRotate',
  'touchZoomRotate',
  'doubleClickZoom',
  'keyboard',
] as const satisfies readonly (keyof GestureTarget)[];

/** Hand the plate to the document: every gesture off. */
export function lockGestures(map: GestureTarget): void {
  for (const key of GESTURE_KEYS) map[key].disable();
}

/** Give the plate back to the reader: every gesture on. */
export function unlockGestures(map: GestureTarget): void {
  for (const key of GESTURE_KEYS) map[key].enable();
}

/**
 * The Door's ambient posture: the plate is painted full-viewport like Live, but a chapter, not
 * the reader, still owns the camera. `scrollZoom` stays off unconditionally — the wheel must
 * always reach the document, on every device, or the single defect the `ambient` posture exists
 * to prevent (a full-bleed map eating the page's scroll) comes right back.
 *
 * Everything else hands back to the reader, but only where doing so cannot reintroduce that same
 * defect through a different gesture: on a precise pointer (mouse, trackpad) a drag is not a
 * scroll, so `dragPan`, `dragRotate`, `touchZoomRotate`, `doubleClickZoom` and `keyboard` are safe
 * to release, and a reader can now catch and correct a chapter flight that overshoots. On a coarse
 * (touch) primary pointer this stays a full lock, because a one-finger drag on touch IS the scroll
 * gesture — releasing `dragPan` there would trade the wheel-jack defect for the identical one on
 * touch, just with the finger instead of the wheel.
 */
export function lockGesturesAmbient(
  map: GestureTarget,
  { pointerFine }: { readonly pointerFine: boolean },
): void {
  if (!pointerFine) {
    lockGestures(map);
    return;
  }
  map.scrollZoom.disable();
  map.dragPan.enable();
  map.dragRotate.enable();
  map.touchZoomRotate.enable();
  map.doubleClickZoom.enable();
  map.keyboard.enable();
}

/** The four postures resolve to one of the three gesture states above. One switch, called from
 * every `MapStage` site that reacts to a posture change, so the branches cannot drift apart the
 * way three separately hand-written `if (posture === 'live') ... else ...` call sites eventually
 * would the first time a fifth posture or a new gesture rule is added. */
export function applyGesturesForPosture(
  map: GestureTarget,
  posture: 'live' | 'ambient' | 'framed' | 'parked',
  { pointerFine }: { readonly pointerFine: boolean },
): void {
  if (posture === 'live') {
    unlockGestures(map);
    return;
  }
  if (posture === 'ambient') {
    lockGesturesAmbient(map, { pointerFine });
    return;
  }
  lockGestures(map);
}

/**
 * Whether the custom rotate gestures (Shift+drag, Safari two-finger twist —
 * `custom-rotate-gestures.ts`) should be attached for this posture. Deliberately identical to
 * `dragRotate`'s own enablement above: these are additional ways to trigger the same rotation
 * `dragRotate` already performs, not a separate capability, so a plate that has handed rotation
 * back to the reader hands it back through every path at once, and a plate that has not stays
 * silent on all of them.
 */
export function rotateGestureAllowed(
  posture: 'live' | 'ambient' | 'framed' | 'parked',
  { pointerFine }: { readonly pointerFine: boolean },
): boolean {
  if (posture === 'live') return true;
  if (posture === 'ambient') return pointerFine;
  return false;
}
