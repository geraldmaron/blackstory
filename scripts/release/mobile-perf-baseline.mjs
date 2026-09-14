#!/usr/bin/env node
/**
 * Wave 9 mobile performance baseline harness.
 *
 * REPORT-ONLY (owner decision, 2026-09-14): measures a Release build on the iOS Simulator or the
 * Android Emulator and writes numbers to a JSON artifact. It applies NO threshold — nothing here
 * passes or fails a release. Every sample is labeled `environment: "simulator" | "emulator"`; it
 * must never be presented as a device number. The "before" half of before/after is unrecoverable
 * for changes already landed on this branch — the output says so in a fixed `note`, rather than
 * fabricating one.
 *
 * This script is the CLI/orchestration half. The other half, `lib/mobile-perf-parsers.mjs`, is
 * pure (text in, structured data out) and is what `mobile-perf-baseline.test.mjs` actually
 * exercises — the same collect/judge split `packages/testing/src/release-gates/mobile/` uses for
 * the store release gate, for the same reason: the platform commands below need a real
 * simulator/emulator to run at all, so keeping the parsing logic separate is what lets it be
 * tested on a machine that has neither.
 *
 * Usage:
 *   node scripts/release/mobile-perf-baseline.mjs --platform ios --runs 5 \
 *     --bundle-id app.blackstory.mobile.preview \
 *     --out artifacts/mobile-release/performance.json
 *
 *   node scripts/release/mobile-perf-baseline.mjs --platform android --runs 5 \
 *     --package app.blackstory.mobile.preview
 *
 * Requires a booted simulator (iOS) or a running emulator (Android) with the target Release build
 * already installed — this script does not boot a device or build the app; the orchestrator that
 * owns the shared device does that (see `docs/mobile/release/release-gates.md` and
 * `apps/mobile/README.md`'s local-QA sections for why device lifecycle is not this script's job).
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  median,
  parseAndroidAmStart,
  parseAndroidGfxInfo,
  parseAndroidLogcatPerfMarks,
  parseAndroidMeminfo,
  parseIosNdjsonLog,
  percentile,
  appVariantFromAppId,
  parseSimctlBootedDevices,
} from './lib/mobile-perf-parsers.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA_VERSION = 1;
const DEFAULT_RUNS = 5;
const DEFAULT_OUT = 'artifacts/mobile-release/performance.json';
// Matches `apps/mobile/app.config.ts`'s production `BUNDLE_IDS` entry — overridable per variant
// with `--bundle-id`/`--package` since the harness is meant to run against whichever variant is
// actually installed on the shared simulator/emulator, not always production.
const DEFAULT_APP_ID = 'app.blackstory.mobile';
const DEFAULT_ACTIVITY = '.MainActivity';
/** The Records tab route (`apps/mobile/src/app/(tabs)/records.tsx`) under the app's `blackstory` scheme. */
const RECORDS_DEEP_LINK = 'blackstory://records';
const MARK_WAIT_TIMEOUT_MS = 20_000;
const MARK_POLL_INTERVAL_MS = 250;
const BUNDLE_SIZE_BASELINE_PATH = join(repoRoot, 'apps/mobile/scripts/bundle-size-baseline.json');

// The five marks `apps/mobile/src/lib/perf-marks.ts` can emit, and the program metric each one
// answers. Everything else in `PROGRAM_METRICS` below has no in-app mark and is measured (or
// left unmeasured) some other way.
const MARK_TO_METRIC = {
  first_useful_content: 'first_useful_content',
  first_map_render: 'first_map_render',
  search_results_shown: 'record_search',
  story_loaded: 'story_load',
  entity_detail_loaded: 'entity_detail',
};

/** Every metric the release program names (Wave 9 owner brief, 2026-09-14). */
const PROGRAM_METRICS = [
  'cold_launch',
  'warm_launch',
  'first_useful_content',
  'first_map_render',
  'map_interaction_jank',
  'record_search',
  'records_scroll',
  'story_load',
  'entity_detail',
  'image_decode',
  'sheet_interaction',
  'tablet_split',
  'memory',
  'bundle_size',
  'payload_cache',
];

const FIXED_BASELINE_NOTE =
  'This is a REPORT-ONLY baseline for the first release (owner decision, 2026-09-14): no metric ' +
  'here has a pass/fail threshold. The "before" half of before/after is unrecoverable for any ' +
  'change already landed on this branch by the time this harness was written — there is no earlier ' +
  'measurement to compare against, and none is fabricated here.';

// --- argument parsing ---------------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

function printHelp() {
  console.log(`Usage: mobile-perf-baseline.mjs --platform <ios|android> [options]

  --platform <ios|android>  Required.
  --runs <n>                 Samples per metric (default: ${DEFAULT_RUNS}).
  --bundle-id <id>           iOS bundle identifier (default: ${DEFAULT_APP_ID}).
  --package <id>             Android package name (default: ${DEFAULT_APP_ID}).
  --activity <name>          Launch activity, Android only (default: ${DEFAULT_ACTIVITY}).
  --out <path>                Output JSON path (default: ${DEFAULT_OUT}).
  --help                      Print this message.

Requires a booted iOS Simulator or a running Android Emulator with the target Release build
already installed. Does not boot a device, does not build the app, applies no threshold.
`);
}

// --- shared helpers ---------------------------------------------------------

function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
}

/** Best-effort: never throws, since a failed cleanup/probe command must not abort a whole run. */
function shSafe(command, args, options = {}) {
  try {
    return sh(command, args, options);
  } catch (error) {
    return error.stdout ?? '';
  }
}

/**
 * adb from the SDK the environment names, not only from PATH: CI runners and non-login shells set
 * ANDROID_HOME (or the older ANDROID_SDK_ROOT) without putting platform-tools on PATH, and a bare
 * `spawnSync adb ENOENT` says nothing about which of those is missing.
 */
function resolveAdb() {
  for (const sdk of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (sdk) {
      const candidate = join(sdk, 'platform-tools', 'adb');
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'adb';
}

const ADB = resolveAdb();

function assertAdbReachable() {
  try {
    sh(ADB, ['version']);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `adb not found (tried ${ADB}). Put Android platform-tools on PATH or set ANDROID_HOME to the SDK root.`,
      );
    }
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarize(samples, unit, method) {
  if (samples.length === 0) return null;
  return {
    samples,
    median: median(samples),
    p90: percentile(samples, 90),
    unit,
    method,
  };
}

function readBundleSizeBaseline(platform) {
  if (!existsSync(BUNDLE_SIZE_BASELINE_PATH)) return null;
  try {
    const baseline = JSON.parse(readFileSync(BUNDLE_SIZE_BASELINE_PATH, 'utf8'));
    return baseline[platform] ?? null;
  } catch {
    return null;
  }
}

function bundleSizeMetric(platform) {
  const recorded = readBundleSizeBaseline(platform);
  if (recorded === null) {
    return {
      metric: null,
      unmeasured: {
        metric: 'bundle_size',
        reason: `No ${platform} entry in ${BUNDLE_SIZE_BASELINE_PATH.replace(`${repoRoot}/`, '')} — run \`pnpm --filter @repo/mobile bundle-size --platform ${platform} --record\` first.`,
      },
    };
  }
  return {
    metric: {
      samples: [recorded.jsBundleBytes],
      median: recorded.jsBundleBytes,
      p90: recorded.jsBundleBytes,
      unit: 'bytes',
      method: `Reused ${BUNDLE_SIZE_BASELINE_PATH.replace(`${repoRoot}/`, '')} (recorded ${recorded.measuredAt} via \`expo export\`) — not re-measured by this harness run.`,
    },
    unmeasured: null,
  };
}

/** Metrics this harness does not wire on EITHER platform, with the reason each is not faked. */
const UNIVERSALLY_UNMEASURED = [
  {
    metric: 'image_decode',
    reason:
      'No in-app instrumentation exists for image-decode completion. The five marks ' +
      '`apps/mobile/src/lib/perf-marks.ts` emits do not cover it; expo-image exposes an ' +
      '`onLoadEnd` callback that could feed a sixth mark, but wiring it is out of this bead’s scope.',
  },
  {
    metric: 'sheet_interaction',
    reason:
      'No scripted bottom-sheet drag gesture is implemented in this harness. On Android it could ' +
      'reuse the same `dumpsys gfxinfo` before/after-gesture method as map/list jank once such a ' +
      'gesture is scripted against `@gorhom/bottom-sheet`’s handle; the iOS Simulator still has no ' +
      'honest jank source at all (see `map_interaction_jank` below).',
  },
  {
    metric: 'tablet_split',
    reason:
      'Requires a second, iPad-class simulator/tablet-class emulator profile plus scripted ' +
      'split-view/rotation, neither of which this harness drives. It measures whichever single ' +
      'device profile is already booted.',
  },
  {
    metric: 'payload_cache',
    reason:
      'No in-app instrumentation or documented command reports API payload size or on-device ' +
      'cache size today. Would need a dedicated mark (payload) or a file-size probe against the ' +
      'SQLite cache (cache) — neither exists yet.',
  },
];

// --- iOS collection ---------------------------------------------------------

/**
 * Runs one iOS launch scenario and returns every perf-mark line the app logged during it, each
 * still carrying the OS log's own timestamp. `cold` terminates the app first; `warm` instead
 * backgrounds it behind another app (`com.apple.Preferences`, matching the CONTEXT brief) and
 * brings it back — never terminated, so the process survives.
 */
async function runIosScenario(bundleId, { cold }) {
  const logChunks = [];
  const logStream = spawn(
    'xcrun',
    [
      'simctl',
      'spawn',
      'booted',
      'log',
      'stream',
      '--style',
      'ndjson',
      '--level',
      'info',
      '--predicate',
      'eventMessage contains "BLACKSTORY_PERF"',
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  logStream.stdout.on('data', (chunk) => logChunks.push(chunk.toString('utf8')));

  // Let the stream attach before the launch it needs to observe.
  await sleep(500);

  const launchIssuedAtMs = Date.now();
  if (cold) {
    shSafe('xcrun', ['simctl', 'terminate', 'booted', bundleId]);
    sh('xcrun', ['simctl', 'launch', 'booted', bundleId]);
  } else {
    shSafe('xcrun', ['simctl', 'launch', 'booted', 'com.apple.Preferences']);
    await sleep(1500);
    sh('xcrun', ['simctl', 'launch', 'booted', bundleId]);
  }

  const deadline = Date.now() + MARK_WAIT_TIMEOUT_MS;
  let marks = [];
  while (Date.now() < deadline) {
    marks = parseIosNdjsonLog(logChunks.join('\n'));
    if (Object.keys(MARK_TO_METRIC).every((name) => marks.some((m) => m.mark === name))) break;
    await sleep(MARK_POLL_INTERVAL_MS);
  }

  logStream.kill();
  return { marks, launchIssuedAtMs };
}

async function collectIos({ bundleId, runs }) {
  const metrics = {};
  const unmeasured = [];
  const markSamplesMs = {};
  const coldLaunchSamplesMs = [];

  for (let run = 0; run < runs; run += 1) {
    const { marks, launchIssuedAtMs } = await runIosScenario(bundleId, { cold: true });
    for (const { mark, ms } of marks) {
      (markSamplesMs[mark] ??= []).push(ms);
    }
    const earliestTimestampMs = marks
      .map((m) => m.timestampMs)
      .filter((value) => typeof value === 'number')
      .sort((a, b) => a - b)[0];
    if (earliestTimestampMs !== undefined) {
      coldLaunchSamplesMs.push(earliestTimestampMs - launchIssuedAtMs);
    }
  }

  const launchMethodNote =
    'Wall-clock from `xcrun simctl launch` to the earliest BLACKSTORY_PERF log line’s own OS ' +
    'timestamp (read via `log stream --style ndjson`). The simulator has no OS-reported launch ' +
    'metric the way Android’s `am start -W` TotalTime is one, so this is a documented proxy — ' +
    'time-to-first-instrumented-JS-work — not an official startup number.';

  if (coldLaunchSamplesMs.length > 0) {
    metrics.cold_launch = summarize(coldLaunchSamplesMs, 'ms', launchMethodNote);
  } else {
    unmeasured.push({
      metric: 'cold_launch',
      reason: 'No perf-mark line was observed in the log stream within the timeout on any run.',
    });
  }
  unmeasured.push({
    metric: 'warm_launch',
    reason:
      'Not observable on the iOS Simulator with this method. Each BLACKSTORY_PERF mark fires once per ' +
      'process and a warm relaunch keeps the process, so it logs nothing to time against, and the ' +
      'simulator has no OS-reported launch time the way Android’s `am start -W` does.',
  });

  for (const [markName, metricId] of Object.entries(MARK_TO_METRIC)) {
    const samples = markSamplesMs[markName];
    if (samples && samples.length > 0) {
      metrics[metricId] = summarize(
        samples,
        'ms',
        `In-app \`BLACKSTORY_PERF\` mark "${markName}", ms since \`performance.rnStartupTiming.startTime\` (falls back to module-load time when unavailable).`,
      );
    } else {
      unmeasured.push({
        metric: metricId,
        reason: `Mark "${markName}" never appeared in the log stream.`,
      });
    }
  }

  unmeasured.push({
    metric: 'memory',
    reason:
      '`footprint(1)` and `ps(1)` both exist on this host (confirmed via their man pages) and can ' +
      'target a Simulator process by name, since Simulator apps run as ordinary host processes. ' +
      'Neither was invoked against a real device in this session, so no output was captured to ' +
      'verify a parser against — implement once a real sample exists rather than guessing the shape.',
  });
  unmeasured.push({
    metric: 'map_interaction_jank',
    reason:
      'The iOS Simulator has no honest frame-jank source reachable without Instruments, which ' +
      'needs a physical trace and a paid automation harness this script does not have.',
  });
  unmeasured.push({
    metric: 'records_scroll',
    reason:
      'Same reason as map_interaction_jank: no honest frame-timing source on the iOS Simulator.',
  });
  for (const entry of UNIVERSALLY_UNMEASURED) unmeasured.push(entry);

  const { metric: bundleSizeMetricValue, unmeasured: bundleSizeUnmeasured } =
    bundleSizeMetric('ios');
  if (bundleSizeMetricValue) metrics.bundle_size = bundleSizeMetricValue;
  if (bundleSizeUnmeasured) unmeasured.push(bundleSizeUnmeasured);

  return { metrics, unmeasured };
}

// --- Android collection ---------------------------------------------------------

/** Real screen dimensions vary per emulator profile; these swipe paths are relative fractions of
 * whatever `wm size` reports, so the gesture lands somewhere reasonable on any profile. */
function readEmulatorScreenSize() {
  const stdout = shSafe(ADB, ['shell', 'wm', 'size']);
  const match = /Physical size:\s*(\d+)x(\d+)/.exec(stdout);
  if (match === null) return { width: 1080, height: 2400 }; // documented fallback, not measured
  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
}

function scriptedSwipe({ width, height }) {
  const x = Math.round(width / 2);
  const yStart = Math.round(height * 0.7);
  const yEnd = Math.round(height * 0.3);
  sh(ADB, ['shell', 'input', 'swipe', String(x), String(yStart), String(x), String(yEnd), '300']);
}

async function runAndroidLaunch(pkg, activity, { cold }) {
  shSafe(ADB, ['logcat', '-c']);
  const target = `${pkg}/${activity}`;
  let stdout;
  if (cold) {
    stdout = sh(ADB, ['shell', 'am', 'start', '-W', '-S', '-n', target]);
  } else {
    shSafe(ADB, ['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
    await sleep(1500);
    stdout = sh(ADB, ['shell', 'am', 'start', '-W', '-n', target]);
  }
  const launch = parseAndroidAmStart(stdout);
  // Give the app a moment to run past its first render and flush marks to logcat.
  await sleep(2000);
  const logcat = shSafe(ADB, ['logcat', '-d', '-s', 'ReactNativeJS']);
  const marks = parseAndroidLogcatPerfMarks(logcat);
  return { launch, marks };
}

async function collectAndroid({ pkg, activity, runs }) {
  assertAdbReachable();
  const metrics = {};
  const unmeasured = [];
  const markSamplesMs = {};
  const coldLaunchSamplesMs = [];
  const warmLaunchSamplesMs = [];

  for (let run = 0; run < runs; run += 1) {
    const { launch, marks } = await runAndroidLaunch(pkg, activity, { cold: true });
    if (typeof launch.totalTimeMs === 'number') coldLaunchSamplesMs.push(launch.totalTimeMs);
    for (const { mark, ms } of marks) (markSamplesMs[mark] ??= []).push(ms);
  }
  for (let run = 0; run < runs; run += 1) {
    const { launch } = await runAndroidLaunch(pkg, activity, { cold: false });
    if (typeof launch.totalTimeMs === 'number') warmLaunchSamplesMs.push(launch.totalTimeMs);
  }

  const amStartMethod =
    '`adb shell am start -W` TotalTime — an OS-reported launch-to-first-frame measurement, not derived from marks.';
  if (coldLaunchSamplesMs.length > 0) {
    metrics.cold_launch = summarize(
      coldLaunchSamplesMs,
      'ms',
      `${amStartMethod} Cold: launched with -S (force stop first).`,
    );
  } else {
    unmeasured.push({
      metric: 'cold_launch',
      reason: '`am start -W` reported no TotalTime on any run.',
    });
  }
  if (warmLaunchSamplesMs.length > 0) {
    metrics.warm_launch = summarize(
      warmLaunchSamplesMs,
      'ms',
      `${amStartMethod} Warm: HOME then relaunch, no -S.`,
    );
  } else {
    unmeasured.push({
      metric: 'warm_launch',
      reason: '`am start -W` reported no TotalTime on any run.',
    });
  }

  for (const [markName, metricId] of Object.entries(MARK_TO_METRIC)) {
    const samples = markSamplesMs[markName];
    if (samples && samples.length > 0) {
      metrics[metricId] = summarize(
        samples,
        'ms',
        `In-app \`BLACKSTORY_PERF\` mark "${markName}" read from \`adb logcat -s ReactNativeJS\`, ms since \`performance.rnStartupTiming.startTime\`.`,
      );
    } else {
      unmeasured.push({
        metric: metricId,
        reason: `Mark "${markName}" never appeared in \`adb logcat -s ReactNativeJS\`.`,
      });
    }
  }

  // Jank: reset the frame-stat counters, run one scripted gesture on the target screen, then read
  // them back. This assumes the app is already sitting on the Explore map / Records list when the
  // gesture fires — true right after the launches above land on Explore, the redirect target of
  // the home tab (`apps/mobile/src/app/(tabs)/index.tsx`).
  const screen = readEmulatorScreenSize();
  const mapJankSamples = { total: [], janky: [], p90: [] };
  const listJankSamples = { total: [], janky: [], p90: [] };
  for (let run = 0; run < runs; run += 1) {
    shSafe(ADB, ['shell', 'dumpsys', 'gfxinfo', pkg, 'reset']);
    scriptedSwipe(screen);
    const mapGfx = parseAndroidGfxInfo(shSafe(ADB, ['shell', 'dumpsys', 'gfxinfo', pkg]));
    if (mapGfx.jankyPercent !== null) {
      mapJankSamples.total.push(mapGfx.totalFrames);
      mapJankSamples.janky.push(mapGfx.jankyPercent);
      mapJankSamples.p90.push(mapGfx.p90Ms);
    }
  }
  if (mapJankSamples.janky.length > 0) {
    metrics.map_interaction_jank = summarize(
      mapJankSamples.janky,
      'percent janky frames',
      '`dumpsys gfxinfo <pkg> reset`, one scripted `input swipe` on the Explore map, then `dumpsys gfxinfo <pkg>` — jankyPercent per run.',
    );
  } else {
    unmeasured.push({
      metric: 'map_interaction_jank',
      reason: 'No frames were recorded by gfxinfo during the scripted swipe on any run.',
    });
  }

  for (let run = 0; run < runs; run += 1) {
    // Open the Records tab itself. Relaunching the activity lands on Explore, which would make this
    // a second map swipe reported under the Records name.
    shSafe(ADB, [
      'shell',
      'am',
      'start',
      '-W',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      RECORDS_DEEP_LINK,
      pkg,
    ]);
    await sleep(2500);
    shSafe(ADB, ['shell', 'dumpsys', 'gfxinfo', pkg, 'reset']);
    scriptedSwipe(screen);
    const listGfx = parseAndroidGfxInfo(shSafe(ADB, ['shell', 'dumpsys', 'gfxinfo', pkg]));
    if (listGfx.jankyPercent !== null) listJankSamples.janky.push(listGfx.jankyPercent);
  }
  if (listJankSamples.janky.length > 0) {
    metrics.records_scroll = summarize(
      listJankSamples.janky,
      'percent janky frames',
      '`dumpsys gfxinfo <pkg> reset`, one scripted `input swipe` on the Records list, then `dumpsys gfxinfo <pkg>` — jankyPercent per run.',
    );
  } else {
    unmeasured.push({
      metric: 'records_scroll',
      reason: 'No frames were recorded by gfxinfo during the scripted swipe on any run.',
    });
  }

  const meminfoSamples = [];
  for (let run = 0; run < runs; run += 1) {
    const meminfo = parseAndroidMeminfo(shSafe(ADB, ['shell', 'dumpsys', 'meminfo', pkg]));
    if (typeof meminfo.totalPssKb === 'number') meminfoSamples.push(meminfo.totalPssKb);
  }
  if (meminfoSamples.length > 0) {
    metrics.memory = summarize(
      meminfoSamples,
      'KB PSS',
      '`adb shell dumpsys meminfo <pkg>` TOTAL PSS.',
    );
  } else {
    unmeasured.push({
      metric: 'memory',
      reason: '`dumpsys meminfo` reported no TOTAL PSS line on any run.',
    });
  }

  for (const entry of UNIVERSALLY_UNMEASURED) unmeasured.push(entry);

  const { metric: bundleSizeMetricValue, unmeasured: bundleSizeUnmeasured } =
    bundleSizeMetric('android');
  if (bundleSizeMetricValue) metrics.bundle_size = bundleSizeMetricValue;
  if (bundleSizeUnmeasured) unmeasured.push(bundleSizeUnmeasured);

  return { metrics, unmeasured };
}

// --- output ---------------------------------------------------------

function buildOutput({
  platform,
  environment,
  device,
  metrics,
  unmeasured,
  commitSha,
  buildVariant,
}) {
  const covered = new Set([...Object.keys(metrics), ...unmeasured.map((entry) => entry.metric)]);
  const missing = PROGRAM_METRICS.filter((id) => !covered.has(id));
  const allUnmeasured = [
    ...unmeasured,
    ...missing.map((id) => ({ metric: id, reason: 'Not attempted by this harness run.' })),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    commit: commitSha,
    collectedAt: new Date().toISOString(),
    host: process.platform,
    platform,
    environment,
    device,
    buildVariant,
    metrics,
    unmeasured: allUnmeasured,
    note: FIXED_BASELINE_NOTE,
  };
}

function currentCommitSha() {
  try {
    return sh('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help === true) {
    printHelp();
    return 0;
  }

  const platform = flags.platform;
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error('--platform must be "ios" or "android".');
  }
  const runs = typeof flags.runs === 'string' ? Number.parseInt(flags.runs, 10) : DEFAULT_RUNS;
  if (!Number.isFinite(runs) || runs < 1) {
    throw new Error('--runs must be a positive integer.');
  }
  // resolve, not join: join glued an absolute --out onto the repo root and wrote inside the tree.
  const outPath = resolve(repoRoot, typeof flags.out === 'string' ? flags.out : DEFAULT_OUT);
  const commitSha = currentCommitSha();

  let result;
  let environment;
  let device;
  let appId;
  if (platform === 'ios') {
    const bundleId = typeof flags['bundle-id'] === 'string' ? flags['bundle-id'] : DEFAULT_APP_ID;
    environment = 'simulator';
    const booted = parseSimctlBootedDevices(
      shSafe('xcrun', ['simctl', 'list', 'devices', 'booted']),
    );
    if (booted.length === 0)
      throw new Error('No booted iOS Simulator. Boot one and install the Release build first.');
    if (booted.length > 1) {
      throw new Error(
        `More than one booted simulator (${booted.map((d) => d.name).join(', ')}); every simctl call targets "booted", so the measured device would be ambiguous. Shut all but one down.`,
      );
    }
    device = booted[0].runtime ? `${booted[0].name} (${booted[0].runtime})` : booted[0].name;
    appId = bundleId;
    result = await collectIos({ bundleId, runs });
  } else {
    const pkg = typeof flags.package === 'string' ? flags.package : DEFAULT_APP_ID;
    const activity = typeof flags.activity === 'string' ? flags.activity : DEFAULT_ACTIVITY;
    environment = 'emulator';
    appId = pkg;
    device =
      shSafe(ADB, ['shell', 'getprop', 'ro.product.model']).trim() ||
      'unknown (adb getprop failed)';
    result = await collectAndroid({ pkg, activity, runs });
  }

  const output = buildOutput({
    platform,
    environment,
    device,
    metrics: result.metrics,
    unmeasured: result.unmeasured,
    commitSha,
    buildVariant: process.env.APP_VARIANT ?? appVariantFromAppId(appId),
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`Measured: ${Object.keys(output.metrics).join(', ') || '(none)'}`);
  console.log(`Unmeasured: ${output.unmeasured.map((entry) => entry.metric).join(', ')}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
