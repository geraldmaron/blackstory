/**
 * The tour's scroll scrub: where the camera is for a given scroll position.
 *
 * The tour is one continuous camera path that the page's own scroll plays forward and backward.
 * Nothing is timed and nothing is captured: a scroll position is a camera, so scrolling a little
 * moves it a little and scrolling back reverses it.
 *
 * The path, in scroll order:
 *   - From the top of the page to the first stop: one dive from the opening's globe into the
 *     first record.
 *   - Each stop is two screens tall. For the first `TOUR_HOLD_SCREENS` of them the camera holds
 *     on the record and its words show; for the rest it travels: straight up from the record
 *     until the next one fits on the stage with it, across, and straight down into that one.
 *     It never goes back to the opening's globe on the way.
 *   - After the last stop it pulls back out to the opening's globe, and is there before the band
 *     that follows the tour reaches the screen (the last stop carries one extra screen for it).
 *
 * Pure arithmetic, so it is pinned under `node:test` without a DOM or a map.
 */
import { flightPeakZoom } from '../../lib/map-experience/camera-presets';

/** How tall one stop's section is, in screens (the retired home tour's stylesheet set the same number). */
export const TOUR_STOP_SCREENS = 2;
/** How much of a stop's section the camera holds still for, in screens. */
export const TOUR_HOLD_SCREENS = 0.8;
/** The scroll, in screens, before the opening gives way to the tour. */
export const TOUR_ACTIVATE_SCREENS = 0.04;
/** A stop's words show while the camera is within this much of landed (0 to 1 of a leg). */
export const TOUR_WORDS_WINDOW = 0.08;

export type TourLayout = {
  /** Document Y of the first stop's section. */
  readonly top: number;
  /** One screen, in pixels: half of a stop's section. */
  readonly screen: number;
  /** How many stops. */
  readonly count: number;
};

/**
 * Where the scroll is on the path. Anchors are numbered 0 (the opening), 1 to `count` (the
 * stops) and `count + 1` (the opening again, after the last stop). `t` runs 0 at `from` to 1 at
 * `to`; on a hold `from === to`.
 */
export type TourPhase = {
  /** False above the tour and after it: the opening's own camera has the map. */
  readonly active: boolean;
  readonly from: number;
  readonly to: number;
  readonly t: number;
  /** The stop whose words show (0-based), or null while the camera travels. */
  readonly words: number | null;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function tourPhase(scrollY: number, layout: TourLayout): TourPhase {
  const { top, screen, count } = layout;
  const inactive: TourPhase = { active: false, from: 0, to: 0, t: 0, words: null };
  if (count <= 0 || screen <= 0 || top <= 0) return inactive;
  const exit = count + 1;
  if (scrollY <= TOUR_ACTIVATE_SCREENS * screen) return inactive;
  const end = top + count * TOUR_STOP_SCREENS * screen;
  if (scrollY >= end) return { active: false, from: exit, to: exit, t: 0, words: null };

  // The dive from the opening into the first stop.
  if (scrollY < top) {
    // Measured from where the tour takes the map, so its first frame is the opening's own.
    const start = TOUR_ACTIVATE_SCREENS * screen;
    const t = clamp01((scrollY - start) / (top - start));
    return { active: true, from: 0, to: 1, t, words: t >= 1 - TOUR_WORDS_WINDOW ? 0 : null };
  }
  const section = TOUR_STOP_SCREENS * screen;
  const index = Math.min(count - 1, Math.floor((scrollY - top) / section));
  const into = scrollY - top - index * section;
  const hold = TOUR_HOLD_SCREENS * screen;
  const stop = index + 1;
  if (into <= hold) return { active: true, from: stop, to: stop, t: 0, words: index };
  const t = clamp01((into - hold) / (section - hold));
  const to = stop + 1;
  const words =
    t <= TOUR_WORDS_WINDOW ? index : to !== exit && t >= 1 - TOUR_WORDS_WINDOW ? index + 1 : null;
  return { active: true, from: stop, to, t, words };
}

export type TourPadding = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export type TourCamera = {
  readonly center: readonly [lng: number, lat: number];
  readonly zoom: number;
  readonly pitch: number;
  readonly padding: TourPadding;
};

export type TourCameras = {
  /** The opening's globe: where the path starts and ends. */
  readonly opening: TourCamera;
  /** The stage with the words cleared: the frame the camera pulls out to between two stops, and
   * the farthest out it may go. */
  readonly orbit: TourCamera;
  /** The stage's shorter side, in pixels: two stops fit inside it at the top of the trip between
   * them. */
  readonly span: number;
  /** One landing per stop, in order. */
  readonly stops: readonly TourCamera[];
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 below `edge0`, 1 above `edge1`, eased between. */
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const k = clamp01((x - edge0) / (edge1 - edge0));
  return k * k * (3 - 2 * k);
};

/**
 * One dive: from a camera high up (`t` 0) down to a landing (`t` 1). The camera comes down ON the
 * record: the record's distance from where it lands, measured on screen, only ever closes, and is
 * closed by 45% of the way. From there the record does not move at all; the ground grows around
 * it. The tilt arrives last, near the ground, where it reads as arriving.
 *
 * Two things make that true. The ground still to cover shrinks with the zoom gained as well as
 * with the turn, because a degree is twice as many pixels one level down: easing the center in
 * degrees alone sends the record away from its landing before bringing it back. And the landing's
 * framing arrives with the turn, not after it, so the zoom's fixed point is already the record's
 * final place on screen when the deep part of the dive begins.
 * Zoom is eased in zoom levels, so the ground grows at an even rate the whole way down.
 */
export function tourDive(high: TourCamera, landing: TourCamera, t: number): TourCamera {
  const turn = smoothstep(0, 0.45, t);
  const zoom = lerp(high.zoom, landing.zoom, smoothstep(0, 1, t));
  const reach = 1 - (1 - turn) * Math.min(1, 2 ** (high.zoom - zoom));
  return {
    center: [
      lerp(high.center[0], landing.center[0], reach),
      lerp(high.center[1], landing.center[1], reach),
    ],
    zoom,
    pitch: lerp(high.pitch, landing.pitch, smoothstep(0.7, 1, t)),
    padding: {
      top: lerp(high.padding.top, landing.padding.top, turn),
      right: lerp(high.padding.right, landing.padding.right, turn),
      bottom: lerp(high.padding.bottom, landing.padding.bottom, turn),
      left: lerp(high.padding.left, landing.padding.left, turn),
    },
  };
}

/**
 * The top of the trip between two stops: over the middle of the two, only as far out as it takes
 * for both to fit on the stage (the click flights' rule, `flightPeakZoom`), and never as far as
 * the opening's globe. Neighbors barely rise; the far coast rises to the country.
 */
export function tourBetween(from: TourCamera, to: TourCamera, cameras: TourCameras): TourCamera {
  // Plain degrees on a 512px world, as `flightPeakZoom`'s callers measure it: sizes the trip,
  // places nothing.
  const degrees = Math.hypot(to.center[0] - from.center[0], to.center[1] - from.center[1]);
  const screensAway = ((degrees / 360) * 512 * 2 ** from.zoom) / Math.max(1, cameras.span);
  return {
    center: [(from.center[0] + to.center[0]) / 2, (from.center[1] + to.center[1]) / 2],
    zoom: Math.max(cameras.orbit.zoom, flightPeakZoom(from.zoom, to.zoom, screensAway)),
    pitch: 0,
    padding: cameras.orbit.padding,
  };
}

/** The camera for a phase. `null` when the phase is not the tour's (the opening has the map). */
export function tourCameraAt(phase: TourPhase, cameras: TourCameras): TourCamera | null {
  if (!phase.active) return null;
  const count = cameras.stops.length;
  const stopAt = (anchor: number) => cameras.stops[Math.min(count, Math.max(1, anchor)) - 1];
  const from = stopAt(phase.from);
  const to = stopAt(phase.to);
  if (!from || !to) return null;
  if (phase.from === phase.to) return from;
  // In from the opening, and back out to it: one dive each, no second globe in between.
  if (phase.from === 0) return tourDive(cameras.opening, to, phase.t);
  if (phase.to === count + 1) return tourDive(cameras.opening, from, 1 - phase.t);
  // Between two stops: up until both fit, then down.
  const high = tourBetween(from, to, cameras);
  return phase.t < 0.5
    ? tourDive(high, from, 1 - phase.t * 2)
    : tourDive(high, to, (phase.t - 0.5) * 2);
}

/**
 * The stop the camera is at or nearest to (0-based), or null nearer the opening. This is where
 * the camera cuts to when it is not allowed to move.
 */
export function tourNearestStop(phase: TourPhase, count: number): number | null {
  if (!phase.active) return null;
  const anchor = phase.t < 0.5 ? phase.from : phase.to;
  return anchor >= 1 && anchor <= count ? anchor - 1 : null;
}

/**
 * The stop whose record the map marks (0-based). The nearest stop, except on the way in from the
 * opening: there the first record is marked from the first frame, so the reader sees what the
 * camera is coming down on while it is still one light among thousands.
 */
export function tourMarkedStop(phase: TourPhase, count: number): number | null {
  return phase.active && phase.from === 0 && count > 0 ? 0 : tourNearestStop(phase, count);
}

/** Reads the tour's layout from its stop sections. `null` when there is no tour on the page. */
export function measureTourLayout(root: ParentNode = document): TourLayout | null {
  const steps = root.querySelectorAll<HTMLElement>('[data-tour-step]');
  const first = steps[0];
  if (!first) return null;
  // The section's own height, not the window's: `dvh` moves with a phone's toolbars. The last
  // stop is one screen taller, for the pull-out.
  const screen = first.offsetHeight / (TOUR_STOP_SCREENS + (steps.length === 1 ? 1 : 0));
  if (screen <= 0) return null;
  return { top: first.getBoundingClientRect().top + window.scrollY, screen, count: steps.length };
}

const approach = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * One eased step of the camera toward where the scroll wants it. `k` is the share of the gap
 * closed this step. `arrived` is set once every part is within what a reader can see, and then
 * the camera is the target itself, so the last frame is the scroll's own camera.
 */
export function easeTourCamera(
  current: TourCamera,
  target: TourCamera,
  k: number,
): { readonly camera: TourCamera; readonly arrived: boolean } {
  const camera: TourCamera = {
    center: [
      approach(current.center[0], target.center[0], k),
      approach(current.center[1], target.center[1], k),
    ],
    zoom: approach(current.zoom, target.zoom, k),
    pitch: approach(current.pitch, target.pitch, k),
    padding: {
      top: approach(current.padding.top, target.padding.top, k),
      right: approach(current.padding.right, target.padding.right, k),
      bottom: approach(current.padding.bottom, target.padding.bottom, k),
      left: approach(current.padding.left, target.padding.left, k),
    },
  };
  const arrived =
    Math.abs(camera.center[0] - target.center[0]) < 1e-5 &&
    Math.abs(camera.center[1] - target.center[1]) < 1e-5 &&
    Math.abs(camera.zoom - target.zoom) < 0.001 &&
    Math.abs(camera.pitch - target.pitch) < 0.05 &&
    Math.abs(camera.padding.top - target.padding.top) < 0.5 &&
    Math.abs(camera.padding.left - target.padding.left) < 0.5;
  return arrived ? { camera: target, arrived } : { camera, arrived };
}
