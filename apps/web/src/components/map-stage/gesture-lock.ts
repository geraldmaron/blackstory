/**
 * Which gestures the plate answers, per posture. One table, one rule:
 *
 *   - A full-screen map is the reader's: every gesture, one finger pans (Google's `greedy`,
 *     the only mode a full-screen map has — there is no page around it to scroll).
 *   - A map that is not full-screen is a picture on touch screens: no gestures at all. A finger
 *     on it scrolls the page it sits in, and a tap is how the reader asks for the real map.
 *     That is the mobile convention (Apple Maps, Airbnb, Zillow, Brad Frost's "adaptive maps"),
 *     and it replaces the two-finger "cooperative" mode this file used to apply, which nothing on
 *     a phone could reach because the page's own content sat on top of the map.
 *
 * Design law: `docs/ui/design-direction-v9-surfaces.md` §3.
 *
 *   live     the Instrument (Explore, the Door's "Browse the map"): `reader`.
 *   ambient  the Door's journey backdrop: `backdrop` on a precise pointer — a mouse drag is not
 *            a scroll, so it may catch a chapter flight, but the wheel always scrolls the page —
 *            and `off` on touch, where a one-finger drag IS the scroll.
 *   framed   a map moment inside a reading page: `off`.
 *   parked   not painted: `off`, so an invisible map is not a keyboard trap.
 *
 * `GestureTarget` is structural rather than `maplibregl.Map` so this runs under `node:test`
 * over a fake that records its own calls.
 */

export type GestureHandle = {
  disable(): void;
  enable(): void;
};

export type GestureTarget = {
  readonly scrollZoom: GestureHandle;
  readonly dragPan: GestureHandle;
  readonly dragRotate: GestureHandle;
  readonly touchZoomRotate: GestureHandle;
  readonly touchPitch: GestureHandle;
  readonly doubleClickZoom: GestureHandle;
  readonly keyboard: GestureHandle;
  /** MapLibre's two-finger mode. Never used; switched off explicitly so no posture inherits it.
   * Optional because older builds and test fakes may not carry it. */
  readonly cooperativeGestures?: GestureHandle;
};

export type PlatePostureName = 'live' | 'ambient' | 'framed' | 'parked';

export type GesturePolicy = 'reader' | 'backdrop' | 'off';

type GestureKey = Exclude<keyof GestureTarget, 'cooperativeGestures'>;

/**
 * What each policy turns on. Everything not listed is off, so no handler can be left enabled by
 * an earlier posture — the asymmetry bug (a handler disabled on entry and forgotten on exit) has
 * no place to live when every apply writes every key.
 *
 * `touchPitch` stays off even for the reader: a two-finger vertical drag tilting the map is the
 * gesture people trigger by accident mid-pinch. Tilt lives in the View panel.
 */
const ENABLED: Record<GesturePolicy, ReadonlySet<GestureKey>> = {
  reader: new Set<GestureKey>([
    'dragPan',
    'touchZoomRotate',
    'doubleClickZoom',
    'scrollZoom',
    'dragRotate',
    'keyboard',
  ]),
  backdrop: new Set<GestureKey>(['dragPan', 'dragRotate', 'doubleClickZoom', 'keyboard']),
  off: new Set<GestureKey>(),
};

const GESTURE_KEYS: readonly GestureKey[] = [
  'scrollZoom',
  'dragPan',
  'dragRotate',
  'touchZoomRotate',
  'touchPitch',
  'doubleClickZoom',
  'keyboard',
];

export function gesturePolicyFor(
  posture: PlatePostureName,
  { pointerFine }: { readonly pointerFine: boolean },
): GesturePolicy {
  if (posture === 'live') return 'reader';
  if (posture === 'ambient') return pointerFine ? 'backdrop' : 'off';
  return 'off';
}

export function applyGesturePolicy(map: GestureTarget, policy: GesturePolicy): void {
  const enabled = ENABLED[policy];
  for (const key of GESTURE_KEYS) {
    if (enabled.has(key)) map[key].enable();
    else map[key].disable();
  }
  map.cooperativeGestures?.disable();
}

/** Hand the plate to the document: every gesture off. */
export function lockGestures(map: GestureTarget): void {
  applyGesturePolicy(map, 'off');
}

export function applyGesturesForPosture(
  map: GestureTarget,
  posture: PlatePostureName,
  options: { readonly pointerFine: boolean },
): void {
  applyGesturePolicy(map, gesturePolicyFor(posture, options));
}

/**
 * Whether the desktop-only rotate extras (Shift+drag, Shift+wheel, Mac trackpad twist —
 * `custom-rotate-gestures.ts`) attach. Only on a precise pointer: on a touch screen MapLibre's
 * own `touchZoomRotate` already rotates with two fingers, and iPhone Safari fires the same
 * `gesturestart`/`gesturechange` events for every pinch, so the twist handler there turned each
 * pinch into a fight between two camera writers.
 */
export function rotateGestureAllowed(
  posture: PlatePostureName,
  { pointerFine }: { readonly pointerFine: boolean },
): boolean {
  if (!pointerFine) return false;
  const policy = gesturePolicyFor(posture, { pointerFine });
  return policy === 'reader' || policy === 'backdrop';
}
