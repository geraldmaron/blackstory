/**
 * The Framed posture's two decisions, as pure functions.
 *
 * Design law: `docs/ui/design-direction-v9-surfaces.md` §3.
 *
 * `plate-posture.ts` answers what posture a SURFACE rests in. This module answers the question one
 * level down, the one that changes on every scroll frame: given that resting posture and whatever
 * moment is currently claiming the plate, what posture does the plate actually hold right now, and
 * where does it sit.
 *
 * Both are pure because neither can be tested any other way in this repo's harness. The posture
 * transition is driven by scroll and the geometry is read from `getBoundingClientRect`, so a test
 * that drove them through the DOM would need a browser. Split out here, "a record page whose
 * moment scrolls away returns the plate to Framed-at-rest rather than Live" is an assertion over a
 * function call, which is the form SP-08's one-Framed-slot criterion actually needs.
 */
import type { SurfaceClass } from '../../lib/nav/surface-classes';
import { defaultPostureFor, framedClaimAllowed, type PlatePosture } from './plate-posture';

/** The plate's box, in the coordinates of its containing block (see {@link plateBoxForSlot}). */
export type PlateBox = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The posture the plate holds this frame.
 *
 * `claimGranted` is threaded in rather than resolved here because the claim mutates the shared
 * `FramedSlotRegistry` — a refused claim is a real outcome (two stages mounted at once, see that
 * module) and the plate must fall back to its resting posture rather than fight for the slot.
 *
 * The Instrument case is the one worth stating plainly: a moment CAN mount on Explore, inside
 * the record sheet that floats over the live plate. `framedClaimAllowed` already refuses it, and
 * the result is that the sheet's place block renders its static fallback while the plate keeps
 * steering underneath. A sheet cannot borrow the plate it is floating over.
 */
export function resolvePlatePosture(input: {
  readonly surface: SurfaceClass | null;
  readonly hasLiveMoment: boolean;
  readonly claimGranted: boolean;
}): PlatePosture {
  const resting = defaultPostureFor(input.surface);
  if (!input.hasLiveMoment) return resting;
  if (!framedClaimAllowed(input.surface)) return resting;
  if (!input.claimGranted) return resting;
  return 'framed';
}

/**
 * Where the plate sits when Framed, in DOCUMENT space.
 *
 * THE PLATE MUST NOT CHASE THE SCROLL. It used to: the box was the slot's viewport rect, clamped
 * to the viewport, written to a `position: fixed` plate on every scroll frame. That arrangement
 * cannot be made to look right, because the document scrolls on the compositor while the plate's
 * new `top` is computed on the main thread from a rect read one frame earlier. Every frame of a
 * scroll gesture, the map sat a few pixels off the slot it was supposed to fill, and the reader
 * saw the page ground flash along the top or bottom edge of the copper frame. Clamping made it
 * worse: it resized the box mid-scroll, so the map's own edge moved too.
 *
 * Positioning in document space fixes the class rather than the symptom. The plate becomes
 * `position: absolute` in the same coordinate space as the slot it is filling, so the browser
 * scrolls the two together — no per-frame write, nothing to lag behind, no clamp, and the box's
 * SIZE is constant for as long as the moment holds the plate, which is what keeps MapLibre from
 * resizing its drawing buffer mid-gesture.
 *
 * `origin` is the containing block's current viewport rect — `document.documentElement`'s, in
 * practice, since the plate is a direct child of `<body>` and neither is positioned. Subtracting
 * it rather than adding `scrollY` is what makes the result stable during a scroll: both rects
 * shift by the same amount, so the difference does not move.
 *
 * A zero-area slot still yields a zero-area box. The caller treats that as "do not paint" rather
 * than as a box, because a zero-height GL canvas still costs a resize.
 */
export function plateBoxForSlot(
  rect: {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
  },
  origin: { readonly top: number; readonly left: number },
): PlateBox {
  return {
    top: rect.top - origin.top,
    left: rect.left - origin.left,
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
  };
}

/** Whether a box encloses enough area to be worth painting. */
export function boxIsPaintable(box: PlateBox): boolean {
  return box.width > 0 && box.height > 0;
}
