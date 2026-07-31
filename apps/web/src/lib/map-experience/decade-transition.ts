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

/** Pin opacity crossfade, in ms. Long enough to read as a change, short enough to scrub through. */
export const DECADE_TRANSITION_MS = 420;

/** Sweep step under normal motion, and under reduced motion. §5.4 / §6 chapter 4. */
export const SWEEP_STEP_MS = 190;
export const SWEEP_STEP_REDUCED_MS = 400;

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
 * reads as a stall, and the reader has already pressed play.
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

  if (running) step();
  else options.onDone?.();

  return {
    cancel: () => {
      if (pending !== null) unschedule(pending);
      pending = null;
      running = false;
    },
    isRunning: () => running,
  };
}
