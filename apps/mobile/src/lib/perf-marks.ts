/**
 * Release-build performance marks for the Wave 9 mobile performance baseline
 * (REPORT-ONLY: no thresholds, owner decision 2026-09-14).
 *
 * Deliberately separate from `src/observability`. That layer is a
 * dev-console-only diagnostic sink — gated behind `__DEV__`, sampled at 10%,
 * and explicitly documented as emitting nothing in production. The baseline
 * program measures Release builds on-device (iOS Simulator / Android
 * Emulator) by reading the OS-level log after the fact
 * (`scripts/release/mobile-perf-baseline.mjs`), so these marks have to reach
 * that log in every build variant, through a channel React Native forwards
 * to native logging regardless of dev/release mode: `console.log`, which
 * lands under the `ReactNativeJS` logcat tag on Android and in the NSLog-
 * backed unified log on iOS.
 *
 * Contract:
 *  - each named mark fires AT MOST ONCE per process — a second call is a
 *    silent no-op. These are launch-adjacent milestones ("first time X
 *    became true this run"), not a per-navigation event stream.
 *  - the only payload is a mark name (from a closed list) and a millisecond
 *    timestamp — no PII, no location, no identifier-bearing URL, nothing
 *    that needs redaction.
 *  - never throws. A bug here must not be able to affect the screen that
 *    called it.
 *  - "ms" is measured against RN's own startup clock
 *    (`performance.rnStartupTiming`, RN 0.86 — see
 *    `node_modules/react-native/src/private/webapis/performance/Performance.js`)
 *    when the native side provides it, so it means "since the process
 *    actually started", not "since this module happened to load". When that
 *    timing is unavailable (Jest, web, an engine that never populated it),
 *    marks fall back to this module's own load time as the origin — still a
 *    consistent clock, just missing whatever elapsed before this module was
 *    first imported.
 */

const MARK_PREFIX = 'BLACKSTORY_PERF';

/** The complete set of marks the Wave 9 program names that this app can emit. */
export type PerfMarkName =
  | 'first_useful_content'
  | 'first_map_render'
  | 'search_results_shown'
  | 'story_loaded'
  | 'entity_detail_loaded';

type StartupTimingLike = { readonly startTime?: number | null };
type PerformanceLike = {
  readonly now?: () => number;
  readonly rnStartupTiming?: StartupTimingLike;
};

function getPerformance(): PerformanceLike | undefined {
  try {
    return (globalThis as { performance?: PerformanceLike }).performance;
  } catch {
    return undefined;
  }
}

function nowMs(): number {
  try {
    const now = getPerformance()?.now;
    if (typeof now === 'function') {
      return now();
    }
  } catch {
    // Fall through to Date.now below.
  }
  return Date.now();
}

// Captured once, at module-load time: the fallback origin used when
// `performance.rnStartupTiming.startTime` isn't available. Always the same
// coordinate space as `nowMs()`, so a mark computed against it is still a
// consistent "ms since roughly-process-start" reading.
const moduleLoadTimeMs = nowMs();

function resolveStartTimeMs(): number {
  try {
    const startTime = getPerformance()?.rnStartupTiming?.startTime;
    if (typeof startTime === 'number' && Number.isFinite(startTime)) {
      return startTime;
    }
  } catch {
    // Fall through to the fallback origin below.
  }
  return moduleLoadTimeMs;
}

const firedMarks = new Set<PerfMarkName>();

/**
 * Record a named performance mark, once per process. Emits a single
 * structured `console.log` line (`BLACKSTORY_PERF {"mark":...,"ms":...}`)
 * that `scripts/release/mobile-perf-baseline.mjs` reads back from the OS
 * log. Safe to call unconditionally from a render path: bounded, synchronous,
 * and never throws.
 */
export function markPerf(mark: PerfMarkName): void {
  try {
    if (firedMarks.has(mark)) return;
    firedMarks.add(mark);
    const ms = Math.round(nowMs() - resolveStartTimeMs());
    console.log(`${MARK_PREFIX} ${JSON.stringify({ mark, ms })}`);
  } catch {
    // Instrumentation must never affect the caller.
  }
}

/** Test-only seam: clear fired-mark state between tests. */
export function __resetPerfMarksForTests(): void {
  firedMarks.clear();
}

export { MARK_PREFIX };
