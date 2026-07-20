/**
 * Decade coupling for plate memorial names: newest→oldest ambient frames pass
 * names whose death year falls in the displayed decade. Pure schedule helpers
 * plus MapLibre feature-state applicators — no setStyle thrash; individual
 * (or 1–3) staggered fades across the decade dwell.
 */
import type { Map as MapLibreMap } from 'maplibre-gl';
import { FINAL_FRAME_LABEL } from './decade-flow';
import type { MemorialNameFeature } from './build-memorial-name-features';

/** Must match `EXPLORE_MEMORIAL_NAMES_SOURCE_ID` in explore-layer-ids. */
const MEMORIAL_SOURCE_ID = 'explore-memorial-names';

/** Feature-state key: when true, text-opacity paints to 0. */
export const MEMORIAL_PASSED_STATE = 'passed';

/** Per-name opacity transition — short enough to stagger many within one dwell. */
export const MEMORIAL_NAME_FADE_MS = 720;

/** Hero decade dwell; stagger window leaves headroom before the next frame.
 * Sized for large decade cohorts from the full memorial archive. */
export const MEMORIAL_STAGGER_WINDOW_MS = 3600;

export type MemorialDecadeFrame = {
  /** Decade label ("2010s") or undefined / Today for full restore. */
  readonly decade?: string;
  readonly isComplete?: boolean;
};

export type MemorialFadePlan = {
  /** Instantly mark passed (already shown on a newer decade). */
  readonly passImmediate: readonly string[];
  /** Instantly restore (scrubbed back; death decade still ahead). */
  readonly restoreImmediate: readonly string[];
  /** Stagger-fade during this frame's dwell (death decade === current). */
  readonly staggerPass: readonly string[];
};

/** Parse "2010s" → 2010; Today / invalid → undefined. */
export function parseAmbientDecadeStart(decade: string | undefined): number | undefined {
  if (!decade || decade === FINAL_FRAME_LABEL) return undefined;
  const match = /^(\d{4})s$/.exec(decade.trim());
  if (!match) return undefined;
  const year = Number.parseInt(match[1]!, 10);
  return Number.isNaN(year) ? undefined : year;
}

/**
 * Visibility plan for newest→oldest play:
 * - deathDecade > current → already passed (newer decades shown earlier)
 * - deathDecade === current → stagger fade this dwell
 * - deathDecade < current → still waiting (older decades not yet shown)
 * Complete / no decade → restore everyone.
 */
export function planMemorialDecadeFade(
  features: readonly MemorialNameFeature[],
  frame: MemorialDecadeFrame,
): MemorialFadePlan {
  if (frame.isComplete || !frame.decade || frame.decade === FINAL_FRAME_LABEL) {
    return {
      passImmediate: [],
      restoreImmediate: features.map((feature) => feature.properties.id),
      staggerPass: [],
    };
  }

  const current = parseAmbientDecadeStart(frame.decade);
  if (current === undefined) {
    return {
      passImmediate: [],
      restoreImmediate: features.map((feature) => feature.properties.id),
      staggerPass: [],
    };
  }

  const passImmediate: string[] = [];
  const restoreImmediate: string[] = [];
  const staggerPass: string[] = [];

  for (const feature of features) {
    const death = feature.properties.decadeStart;
    const id = feature.properties.id;
    if (death > current) {
      passImmediate.push(id);
    } else if (death === current) {
      staggerPass.push(id);
    } else {
      restoreImmediate.push(id);
    }
  }

  // Seed-stable stagger order within the decade cohort.
  staggerPass.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return { passImmediate, restoreImmediate, staggerPass };
}

/**
 * Spread `ids` across `windowMs` in batches of 1–3 (never one bulk wipe).
 * Returns delay ms from schedule start for each id.
 */
export function memorialStaggerDelays(
  ids: readonly string[],
  windowMs: number = MEMORIAL_STAGGER_WINDOW_MS,
): readonly { readonly id: string; readonly delayMs: number }[] {
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  let i = 0;
  while (i < ids.length) {
    const remaining = ids.length - i;
    const size = remaining <= 2 ? remaining : 1 + (i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2);
    const take = Math.min(size, remaining);
    batches.push(ids.slice(i, i + take) as string[]);
    i += take;
  }
  const span = Math.max(0, windowMs);
  const step = batches.length <= 1 ? 0 : span / (batches.length - 1);
  const out: { readonly id: string; readonly delayMs: number }[] = [];
  for (let b = 0; b < batches.length; b += 1) {
    const delayMs = Math.round(b * step);
    for (const id of batches[b]!) {
      out.push({ id, delayMs });
    }
  }
  return out;
}

function setPassed(map: MapLibreMap, id: string, passed: boolean): void {
  try {
    map.setFeatureState(
      { source: MEMORIAL_SOURCE_ID, id },
      { [MEMORIAL_PASSED_STATE]: passed },
    );
  } catch (error) {
    console.error(`[memorial-decade] setFeatureState ${id} failed`, error);
  }
}

export type MemorialDecadeApplyHandle = {
  readonly cancel: () => void;
};

/**
 * Apply a decade frame to memorial feature-state. Immediate sync for restore /
 * already-passed; staggered setFeatureState for the current decade's deaths.
 * Returns a cancel handle for in-flight stagger timers.
 */
export function applyMemorialDecadeFrame(
  map: MapLibreMap,
  features: readonly MemorialNameFeature[],
  frame: MemorialDecadeFrame,
  options?: {
    readonly reducedMotion?: boolean;
    readonly staggerWindowMs?: number;
  },
): MemorialDecadeApplyHandle {
  const plan = planMemorialDecadeFade(features, frame);
  const timeouts: number[] = [];
  let cancelled = false;

  for (const id of plan.passImmediate) setPassed(map, id, true);
  for (const id of plan.restoreImmediate) setPassed(map, id, false);

  if (plan.staggerPass.length === 0) {
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  if (options?.reducedMotion) {
    for (const id of plan.staggerPass) setPassed(map, id, true);
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  const schedule = memorialStaggerDelays(plan.staggerPass, options?.staggerWindowMs ?? MEMORIAL_STAGGER_WINDOW_MS);
  for (const entry of schedule) {
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setPassed(map, entry.id, true);
    }, entry.delayMs);
    timeouts.push(timeoutId);
  }

  return {
    cancel: () => {
      cancelled = true;
      for (const id of timeouts) window.clearTimeout(id);
    },
  };
}
