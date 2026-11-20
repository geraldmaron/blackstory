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
 *     on the record and its words show; for the rest it travels: out to the globe, then down
 *     into the next record.
 *   - After the last stop it pulls back out to the opening's globe, and is there before the band
 *     that follows the tour reaches the screen (the last stop carries one extra screen for it).
 *
 * Pure arithmetic, so it is pinned under `node:test` without a DOM or a map.
 */

/** How tall one stop's section is, in screens (door-tour.css sets the same number). */
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
    const t = clamp01(scrollY / top);
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
  /** The globe between two stops: centered, with the stage to itself. */
  readonly orbit: TourCamera;
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
 * One dive: from a globe camera (`t` 0) down to a landing (`t` 1). The globe turns to face the
 * place first, while there is still a globe to turn, then the camera comes down on it; the tilt
 * and the landing's own framing arrive last, near the ground, where they read as arriving.
 * Zoom is eased in zoom levels, so the ground grows at an even rate the whole way down.
 */
export function tourDive(globe: TourCamera, landing: TourCamera, t: number): TourCamera {
  const turn = smoothstep(0, 0.45, t);
  const frame = smoothstep(0.5, 1, t);
  return {
    center: [
      lerp(globe.center[0], landing.center[0], turn),
      lerp(globe.center[1], landing.center[1], turn),
    ],
    zoom: lerp(globe.zoom, landing.zoom, smoothstep(0, 1, t)),
    pitch: lerp(globe.pitch, landing.pitch, smoothstep(0.7, 1, t)),
    padding: {
      top: lerp(globe.padding.top, landing.padding.top, frame),
      right: lerp(globe.padding.right, landing.padding.right, frame),
      bottom: lerp(globe.padding.bottom, landing.padding.bottom, frame),
      left: lerp(globe.padding.left, landing.padding.left, frame),
    },
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
  // Between two stops: out to the globe, then down.
  return phase.t < 0.5
    ? tourDive(cameras.orbit, from, 1 - phase.t * 2)
    : tourDive(cameras.orbit, to, (phase.t - 0.5) * 2);
}

/**
 * The stop the camera is at or nearest to (0-based), or null nearer the opening. This is the
 * record the map marks as selected, and where the camera cuts to when it is not allowed to move.
 */
export function tourNearestStop(phase: TourPhase, count: number): number | null {
  if (!phase.active) return null;
  const anchor = phase.t < 0.5 ? phase.from : phase.to;
  return anchor >= 1 && anchor <= count ? anchor - 1 : null;
}

/** Reads the tour's layout from its stop sections. `null` when there is no tour on the page. */
export function measureTourLayout(root: ParentNode = document): TourLayout | null {
  const steps = root.querySelectorAll<HTMLElement>('[data-tour-step]');
  const first = steps[0];
  if (!first) return null;
  // The section's own height, not the window's: `dvh` moves with a phone's toolbars. The last
  // stop is one screen taller, for the pull-out (door-tour.css).
  const screen = first.offsetHeight / (TOUR_STOP_SCREENS + (steps.length === 1 ? 1 : 0));
  if (screen <= 0) return null;
  return { top: first.getBoundingClientRect().top + window.scrollY, screen, count: steps.length };
}
