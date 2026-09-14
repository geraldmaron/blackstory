/**
 * Pure parsers for the Wave 9 mobile performance baseline harness
 * (`../mobile-perf-baseline.mjs`). Everything here is text in, structured data out — no
 * filesystem, no child processes — so the parsing logic can be exercised from captured sample
 * output on any machine, the same split `packages/testing/src/release-gates/mobile/checks.ts`
 * uses for the store release gate: collection is platform-specific and unverifiable without a
 * build host or a booted device; judgement (here, parsing) is not, and is what actually gets
 * tested (`../mobile-perf-baseline.test.mjs`).
 *
 * REPORT-ONLY baseline (owner decision, 2026-09-14): nothing in this module or its caller
 * applies a threshold. It only turns raw command output into numbers.
 */

const PERF_MARK_PREFIX = 'BLACKSTORY_PERF';
// Matches the exact line shape `perf-marks.ts` emits: `BLACKSTORY_PERF {"mark":...,"ms":...}`.
// Deliberately permissive about what comes BEFORE the prefix on the line (logcat's
// `date pid tid level tag:` columns, iOS's syslog/compact prefix, ndjson's surrounding object
// keys) and about extra trailing content after the JSON closes on the same physical line.
const PERF_MARK_LINE = new RegExp(`${PERF_MARK_PREFIX}\\s+(\\{.*\\})`);

/**
 * Extracts every `{mark, ms}` pair from a blob of text that may contain `BLACKSTORY_PERF` lines
 * mixed in with anything else (Android logcat noise, iOS log-show frames). Malformed JSON after
 * the prefix is skipped rather than thrown — one corrupted line must not lose every other mark in
 * the same capture. Marks are returned in the order they appear in the text.
 */
export function extractPerfMarks(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const marks = [];
  for (const line of text.split('\n')) {
    const match = PERF_MARK_LINE.exec(line);
    if (match === null) continue;
    let payload;
    try {
      payload = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (typeof payload !== 'object' || payload === null) continue;
    if (typeof payload.mark !== 'string' || typeof payload.ms !== 'number') continue;
    if (!Number.isFinite(payload.ms)) continue;
    marks.push({ mark: payload.mark, ms: payload.ms });
  }
  return marks;
}

/**
 * Parses `log show`/`log stream --style ndjson` output (each line one JSON object with at least
 * `timestamp` and `eventMessage`) into perf marks carrying the log's OWN wall-clock timestamp
 * alongside the in-app `ms`. That log timestamp is what lets the harness approximate an iOS
 * cold/warm launch time — there is no OS-reported launch metric on the simulator the way
 * Android's `am start -W` gives one, so "time from the launch command to the earliest mark's log
 * timestamp" is the tightest honest signal available without Instruments (documented in the
 * harness's `method` field, not presented as an official launch metric).
 *
 * Lines that are not valid JSON (log show sometimes prints an informational banner before the
 * stream starts) are skipped rather than thrown.
 */
export function parseIosNdjsonLog(ndjsonText) {
  if (typeof ndjsonText !== 'string' || ndjsonText.length === 0) return [];
  const results = [];
  for (const line of ndjsonText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed === '[' || trimmed === ']' || trimmed === ',') continue;
    // ndjson lines from `log show` are sometimes comma-terminated when the tool was asked for a
    // JSON array instead of true ndjson; stripping one trailing comma costs nothing and makes
    // this parser tolerant of either.
    const jsonText = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    let event;
    try {
      event = JSON.parse(jsonText);
    } catch {
      continue;
    }
    if (typeof event !== 'object' || event === null) continue;
    const message = event.eventMessage;
    if (typeof message !== 'string') continue;
    const [mark] = extractPerfMarks(message);
    if (mark === undefined) continue;
    const timestampMs = typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : NaN;
    results.push({
      mark: mark.mark,
      ms: mark.ms,
      timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
    });
  }
  return results;
}

/**
 * Parses `adb logcat -d -s ReactNativeJS` output. Each line looks like:
 *   `MM-DD HH:mm:ss.SSS  PID  TID LEVEL ReactNativeJS: BLACKSTORY_PERF {"mark":"...","ms":1}`
 * logcat's default timestamp format carries no year, so `referenceDate` (default: now) supplies
 * one — correct as long as the capture and the parse happen within the same calendar year, which
 * a single harness run always does.
 */
export function parseAndroidLogcatPerfMarks(logcatText, referenceDate = new Date()) {
  if (typeof logcatText !== 'string' || logcatText.length === 0) return [];
  const year = referenceDate.getUTCFullYear();
  const results = [];
  for (const line of logcatText.split('\n')) {
    const [mark] = extractPerfMarks(line);
    if (mark === undefined) continue;
    const timestampMatch = /^(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(line);
    let timestampMs = null;
    if (timestampMatch !== null) {
      const [, month, day, hour, minute, second, millis] = timestampMatch;
      const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}Z`);
      timestampMs = Number.isFinite(parsed) ? parsed : null;
    }
    results.push({ mark: mark.mark, ms: mark.ms, timestampMs });
  }
  return results;
}

const AM_START_FIELD = {
  status: /^Status:\s*(\S+)/m,
  launchState: /^LaunchState:\s*(\S+)/m,
  activity: /^Activity:\s*(\S+)/m,
  totalTimeMs: /^TotalTime:\s*(\d+)/m,
  waitTimeMs: /^WaitTime:\s*(\d+)/m,
};

/**
 * Parses `adb shell am start -W -S -n <pkg>/<activity>` (cold, `-S` forces a stop-first launch)
 * or the same command without `-S` (warm — the process is left running and merely brought back to
 * the foreground). `TotalTime` is the OS's own launch-to-first-frame measurement; nothing here
 * derives it from marks or timestamps.
 */
export function parseAndroidAmStart(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return {
      status: null,
      launchState: null,
      activity: null,
      totalTimeMs: null,
      waitTimeMs: null,
    };
  }
  const statusMatch = AM_START_FIELD.status.exec(stdout);
  const launchStateMatch = AM_START_FIELD.launchState.exec(stdout);
  const activityMatch = AM_START_FIELD.activity.exec(stdout);
  const totalTimeMatch = AM_START_FIELD.totalTimeMs.exec(stdout);
  const waitTimeMatch = AM_START_FIELD.waitTimeMs.exec(stdout);
  return {
    status: statusMatch ? statusMatch[1] : null,
    launchState: launchStateMatch ? launchStateMatch[1] : null,
    activity: activityMatch ? activityMatch[1] : null,
    totalTimeMs: totalTimeMatch ? Number.parseInt(totalTimeMatch[1], 10) : null,
    waitTimeMs: waitTimeMatch ? Number.parseInt(waitTimeMatch[1], 10) : null,
  };
}

/**
 * Parses `adb shell dumpsys meminfo <pkg>`. Modern Android (API 30+) prints a "TOTAL PSS:" /
 * "TOTAL RSS:" line inside an "App Summary" block; older releases print only a bare "TOTAL:"
 * line. Both are matched; the App Summary line is preferred when both are present because it is
 * the one Android itself documents as the app's proportional footprint.
 */
export function parseAndroidMeminfo(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return { totalPssKb: null, totalRssKb: null };
  }
  const summaryMatch = /TOTAL PSS:\s*(\d+)(?:\s+TOTAL RSS:\s*(\d+))?/.exec(stdout);
  if (summaryMatch !== null) {
    return {
      totalPssKb: Number.parseInt(summaryMatch[1], 10),
      totalRssKb: summaryMatch[2] !== undefined ? Number.parseInt(summaryMatch[2], 10) : null,
    };
  }
  const legacyMatch = /^\s*TOTAL:\s*(\d+)/m.exec(stdout);
  return {
    totalPssKb: legacyMatch !== null ? Number.parseInt(legacyMatch[1], 10) : null,
    totalRssKb: null,
  };
}

const GFXINFO_FIELD = {
  totalFrames: /Total frames rendered:\s*(\d+)/,
  jankyFrames: /Janky frames:\s*(\d+)\s*\(([\d.]+)%\)/,
  p50Ms: /50th percentile:\s*(\d+)ms/,
  p90Ms: /90th percentile:\s*(\d+)ms/,
  p95Ms: /95th percentile:\s*(\d+)ms/,
  p99Ms: /99th percentile:\s*(\d+)ms/,
};

/**
 * Parses `adb shell dumpsys gfxinfo <pkg>` (after a `dumpsys gfxinfo <pkg> reset` and a scripted
 * gesture in between) into frame-jank statistics. Returns `null` fields for whichever lines are
 * absent rather than throwing — a package with no rendered frames since the last reset (e.g. the
 * scripted gesture targeted the wrong screen) prints a stats block with zero frames and no
 * percentile lines at all, and the caller decides whether that is measurable.
 */
export function parseAndroidGfxInfo(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return {
      totalFrames: null,
      jankyFrames: null,
      jankyPercent: null,
      p50Ms: null,
      p90Ms: null,
      p95Ms: null,
      p99Ms: null,
    };
  }
  const totalMatch = GFXINFO_FIELD.totalFrames.exec(stdout);
  const jankyMatch = GFXINFO_FIELD.jankyFrames.exec(stdout);
  const p50Match = GFXINFO_FIELD.p50Ms.exec(stdout);
  const p90Match = GFXINFO_FIELD.p90Ms.exec(stdout);
  const p95Match = GFXINFO_FIELD.p95Ms.exec(stdout);
  const p99Match = GFXINFO_FIELD.p99Ms.exec(stdout);
  return {
    totalFrames: totalMatch ? Number.parseInt(totalMatch[1], 10) : null,
    jankyFrames: jankyMatch ? Number.parseInt(jankyMatch[1], 10) : null,
    jankyPercent: jankyMatch ? Number.parseFloat(jankyMatch[2]) : null,
    p50Ms: p50Match ? Number.parseInt(p50Match[1], 10) : null,
    p90Ms: p90Match ? Number.parseInt(p90Match[1], 10) : null,
    p95Ms: p95Match ? Number.parseInt(p95Match[1], 10) : null,
    p99Ms: p99Match ? Number.parseInt(p99Match[1], 10) : null,
  };
}

/** Sorted-copy median. Returns `null` for an empty input rather than `NaN`. */
export function median(numbers) {
  const values = numbers.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Nearest-rank percentile (p in [0, 100]) over a sorted copy of `numbers`. Returns `null` for an
 * empty input. This is a reporting aggregate, not a statistical claim — with the default 5 runs
 * (`--runs`) "p90" is close to "the slowest of 5", which is disclosed in the output's `method`
 * field rather than dressed up as a robust percentile.
 */
export function percentile(numbers, p) {
  const values = numbers.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index];
}
