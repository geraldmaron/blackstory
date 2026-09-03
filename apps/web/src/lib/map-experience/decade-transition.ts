/**
 * Decade transition and sweep.
 *
 * v6-explore §4.4 mandated a hard snap between decades, on the reasoning that a morph would be
 * ornamental. v9 §11 supersedes that: a 420ms opacity transition on the pin layers is not
 * ornament, it is the difference between pins that *change* and pins that *blink*. The reader
 * scrubbing the histogram needs to see which points left and which arrived.
 *
 * The sweep renders record **presence** and nothing else. It must never be reweighted by harm,
 * severity or any density of suffering (§4.3). The type deliberately carries no weighting input,
 * so there is nowhere to put one.
 */

import type { ExploreMapFeature } from './build-explore-map-source';

/** Pin opacity crossfade, in ms. Long enough to read as a change, short enough to scrub through. */
export const DECADE_TRANSITION_MS = 420;

/** Sweep step under normal motion, and under reduced motion. §5.4 / §6 chapter 4. */
export const SWEEP_STEP_MS = 190;
export const SWEEP_STEP_REDUCED_MS = 400;

/**
 * The beat between clearing the plate and the first decade landing on it.
 *
 * Chapter 4 argues that the record *fills*, so it has to start from nothing: the plate empties,
 * the reader sees an empty country, and then four centuries arrive on it. That only reads if the
 * clearing crossfade has finished before the first decade appears, which is why this is a full
 * `DECADE_TRANSITION_MS` plus a short beat rather than one more sweep step.
 */
export const SWEEP_CLEAR_HOLD_MS = DECADE_TRANSITION_MS + 180;

/** Paint properties added to every pin layer so a decade change crossfades rather than snapping. */
export const DECADE_TRANSITION_PAINT = {
  'circle-opacity-transition': { duration: DECADE_TRANSITION_MS },
  'circle-stroke-opacity-transition': { duration: DECADE_TRANSITION_MS },
} as const;

export type SweepOptions = {
  /** First decade start year, inclusive. */
  readonly from: number;
  /** Last decade start year, inclusive. */
  readonly to: number;
  readonly onDecade: (decade: number) => void;
  /**
   * Empty the plate before the first decade lands. When given, the sweep opens by calling this,
   * holds for `clearHoldMs`, and only then emits `from`. Without it the sweep opens on `from`
   * synchronously, which is what the histogram scrubber wants and what the story chapter does not.
   */
  readonly onClear?: () => void;
  /** How long the cleared plate is held before the first decade. Ignored without `onClear`. */
  readonly clearHoldMs?: number;
  readonly onDone?: () => void;
  readonly reducedMotion?: boolean;
  /** Overrides the per-decade interval. Mostly for tests; the defaults are the design law's. */
  readonly stepMs?: number;
  /** Injected so the sweep is testable without real timers. */
  readonly scheduler?: (callback: () => void, delayMs: number) => unknown;
  readonly cancelScheduled?: (handle: unknown) => void;
};

export type SweepHandle = {
  /** Stops the sweep where it is. Safe to call after it has finished. */
  readonly cancel: () => void;
  readonly isRunning: () => boolean;
};

/** Every decade start year from `from` to `to`, inclusive, in chronological order. */
export function decadesBetween(from: number, to: number): readonly number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  const first = Math.min(from, to);
  const last = Math.max(from, to);
  const decades: number[] = [];
  for (let decade = first; decade <= last; decade += 10) decades.push(decade);
  return decades;
}

export function sweepIntervalMs(reducedMotion: boolean): number {
  return reducedMotion ? SWEEP_STEP_REDUCED_MS : SWEEP_STEP_MS;
}

/**
 * Steps decades in order, emitting each one.
 *
 * The first decade is emitted synchronously. A sweep whose opening frame is one interval late
 * reads as a stall, and the reader has already pressed play. The one exception is a sweep that
 * was asked to clear the plate first (`onClear`): there the pause is the point, not a stall.
 */
export function sweep(options: SweepOptions): SweepHandle {
  const schedule = options.scheduler ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const unschedule =
    options.cancelScheduled ?? ((handle: unknown) => clearTimeout(handle as never));
  const interval = options.stepMs ?? sweepIntervalMs(options.reducedMotion ?? false);
  const decades = decadesBetween(options.from, options.to);

  let index = 0;
  let pending: unknown = null;
  let running = decades.length > 0;

  function finish(): void {
    running = false;
    pending = null;
    options.onDone?.();
  }

  function step(): void {
    const decade = decades[index];
    if (decade === undefined) {
      finish();
      return;
    }
    index += 1;
    options.onDecade(decade);

    if (index >= decades.length) {
      finish();
      return;
    }
    pending = schedule(step, interval);
  }

  if (!running) {
    options.onDone?.();
  } else if (options.onClear) {
    options.onClear();
    pending = schedule(step, options.clearHoldMs ?? SWEEP_CLEAR_HOLD_MS);
  } else {
    step();
  }

  return {
    cancel: () => {
      if (pending !== null) unschedule(pending);
      pending = null;
      running = false;
    },
    isRunning: () => running,
  };
}

/**
 * The first decade this record is on the map for, or null when it carries no dated era bucket.
 *
 * Used by the story sweep, which fills the plate cumulatively rather than showing one decade at a
 * time: a record enters at its earliest decade and stays. Undated records return null and sit out
 * the sweep entirely rather than being drawn from the first frame, which would put them in the
 * 1630s — a date the archive does not claim for them.
 */
export function earliestDecadeFor(feature: ExploreMapFeature): number | null {
  const carried = feature.properties.earliestDecade;
  if (typeof carried === 'number' && Number.isFinite(carried)) return carried;

  let earliest: number | null = null;
  for (const bucket of feature.properties.eraBuckets) {
    const year = Number.parseInt(bucket, 10);
    if (!Number.isFinite(year)) continue;
    if (earliest === null || year < earliest) earliest = year;
  }
  return earliest;
}
