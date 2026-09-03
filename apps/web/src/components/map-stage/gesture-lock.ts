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
