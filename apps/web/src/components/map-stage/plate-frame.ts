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

/** The plate's fixed-position box, in viewport pixels. */
export type PlateInset = {
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
 * Where the plate sits when Framed.
 *
 * The plate is `position: fixed`, so a slot rect in viewport coordinates is already the inset it
 * needs. What this adds is the clamp: a slot scrolled halfway off the top of the viewport reports
 * a negative `top`, and a fixed element given a negative top paints its content above the fold
 * where it overlaps the command bar. Clamping to the viewport keeps the plate inside the frame the
 * reader can actually see, and the height shrinks to match so the map is never stretched.
 *
 * A slot fully off screen yields a zero-area inset. The caller treats that as "do not paint"
 * rather than as a box, because a zero-height GL canvas still costs a resize.
 */
export function plateInsetForSlot(
  rect: {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
  },
  viewport: { readonly width: number; readonly height: number },
): PlateInset {
  const top = Math.max(0, rect.top);
  const bottom = Math.min(viewport.height, rect.top + rect.height);
  const left = Math.max(0, rect.left);
  const right = Math.min(viewport.width, rect.left + rect.width);
  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/** Whether an inset encloses enough area to be worth painting. */
export function insetIsPaintable(inset: PlateInset): boolean {
  return inset.width > 0 && inset.height > 0;
}
