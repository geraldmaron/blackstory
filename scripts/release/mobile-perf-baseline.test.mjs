/**
 * Unit tests for the mobile performance baseline harness's pure parsers
 * (`lib/mobile-perf-parsers.mjs`). Fixture strings below are hand-built from the documented output
 * shapes of `am start -W`, `dumpsys meminfo`, `dumpsys gfxinfo`, and `perf-marks.ts`'s log line —
 * not captured from a real run, since this harness is not run against a device in this session.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractPerfMarks,
  median,
  parseAndroidAmStart,
  parseAndroidGfxInfo,
  parseAndroidLogcatPerfMarks,
  parseAndroidMeminfo,
  parseIosNdjsonLog,
  percentile,
} from './lib/mobile-perf-parsers.mjs';

// --- extractPerfMarks ---------------------------------------------------------

test('extractPerfMarks reads a bare perf-mark line', () => {
  const marks = extractPerfMarks('BLACKSTORY_PERF {"mark":"first_map_render","ms":842}');
  assert.deepEqual(marks, [{ mark: 'first_map_render', ms: 842 }]);
});

test('extractPerfMarks finds marks embedded after noisy prefixes and skips everything else', () => {
  const text = [
    'some unrelated line',
    '09-14 12:00:01.123  1234  1234 I ReactNativeJS: BLACKSTORY_PERF {"mark":"story_loaded","ms":1201}',
    'another unrelated line',
    '2026-09-14 12:00:02.456-0700  localhost BlackStory[555]: BLACKSTORY_PERF {"mark":"entity_detail_loaded","ms":1550}',
  ].join('\n');
  assert.deepEqual(extractPerfMarks(text), [
    { mark: 'story_loaded', ms: 1201 },
    { mark: 'entity_detail_loaded', ms: 1550 },
  ]);
});

test('extractPerfMarks skips a malformed JSON payload without losing the rest', () => {
  const text = [
    'BLACKSTORY_PERF {"mark":"first_useful_content","ms":900}',
    'BLACKSTORY_PERF {not json}',
    'BLACKSTORY_PERF {"mark":"search_results_shown","ms":1100}',
  ].join('\n');
  assert.deepEqual(extractPerfMarks(text), [
    { mark: 'first_useful_content', ms: 900 },
    { mark: 'search_results_shown', ms: 1100 },
  ]);
});

test('extractPerfMarks returns an empty array for empty or non-string input', () => {
  assert.deepEqual(extractPerfMarks(''), []);
  assert.deepEqual(extractPerfMarks(undefined), []);
});

// --- parseIosNdjsonLog ---------------------------------------------------------

test('parseIosNdjsonLog reads log show/stream ndjson output', () => {
  const line1 = JSON.stringify({
    timestamp: '2026-09-14 12:00:01.500000-0700',
    eventMessage: 'BLACKSTORY_PERF {"mark":"first_useful_content","ms":812}',
  });
  const line2 = JSON.stringify({
    timestamp: '2026-09-14 12:00:01.900000-0700',
    eventMessage: 'BLACKSTORY_PERF {"mark":"first_map_render","ms":1203}',
  });
  const ndjson = [line1, line2].join('\n');
  const marks = parseIosNdjsonLog(ndjson);
  assert.equal(marks.length, 2);
  assert.equal(marks[0].mark, 'first_useful_content');
  assert.equal(marks[0].ms, 812);
  assert.equal(typeof marks[0].timestampMs, 'number');
  assert.equal(marks[1].mark, 'first_map_render');
});

test('parseIosNdjsonLog skips lines that are not perf-mark events and tolerates a trailing comma', () => {
  const perfLine = JSON.stringify({
    timestamp: '2026-09-14 12:00:01.500000-0700',
    eventMessage: 'BLACKSTORY_PERF {"mark":"story_loaded","ms":1000}',
  });
  const ndjson = [
    '[',
    JSON.stringify({ timestamp: '2026-09-14 12:00:00.000000-0700', eventMessage: 'unrelated' }),
    ',',
    `${perfLine},`,
    ']',
  ].join('\n');
  const marks = parseIosNdjsonLog(ndjson);
  assert.deepEqual(
    marks.map((m) => m.mark),
    ['story_loaded'],
  );
});

test('parseIosNdjsonLog skips non-JSON lines without throwing', () => {
  const marks = parseIosNdjsonLog('not json at all\n{"broken"');
  assert.deepEqual(marks, []);
});

// --- parseAndroidLogcatPerfMarks ---------------------------------------------------------

test('parseAndroidLogcatPerfMarks reads adb logcat -s ReactNativeJS output and attaches a timestamp', () => {
  const logcat = [
    '09-14 12:00:01.123  1234  1234 I ReactNativeJS: BLACKSTORY_PERF {"mark":"first_useful_content","ms":755}',
    '09-14 12:00:01.900  1234  1234 I ReactNativeJS: BLACKSTORY_PERF {"mark":"first_map_render","ms":1310}',
  ].join('\n');
  const marks = parseAndroidLogcatPerfMarks(logcat, new Date('2026-09-14T00:00:00Z'));
  assert.equal(marks.length, 2);
  assert.equal(marks[0].mark, 'first_useful_content');
  assert.equal(marks[0].ms, 755);
  assert.equal(new Date(marks[0].timestampMs).getUTCFullYear(), 2026);
  assert.ok(marks[1].timestampMs > marks[0].timestampMs);
});

// --- parseAndroidAmStart ---------------------------------------------------------

test('parseAndroidAmStart reads a cold-launch am start -W block', () => {
  const stdout = [
    'Starting: Intent { cmp=app.blackstory.mobile/.MainActivity }',
    'Status: ok',
    'LaunchState: COLD',
    'Activity: app.blackstory.mobile/.MainActivity',
    'TotalTime: 842',
    'WaitTime: 861',
    'Complete',
  ].join('\n');
  assert.deepEqual(parseAndroidAmStart(stdout), {
    status: 'ok',
    launchState: 'COLD',
    activity: 'app.blackstory.mobile/.MainActivity',
    totalTimeMs: 842,
    waitTimeMs: 861,
  });
});

test('parseAndroidAmStart reads a warm-launch block (no LaunchState line without -S)', () => {
  const stdout = ['Starting: Intent { ... }', 'Status: ok', 'TotalTime: 210', 'Complete'].join(
    '\n',
  );
  const result = parseAndroidAmStart(stdout);
  assert.equal(result.totalTimeMs, 210);
  assert.equal(result.launchState, null);
});

test('parseAndroidAmStart returns all-null fields for empty output', () => {
  assert.deepEqual(parseAndroidAmStart(''), {
    status: null,
    launchState: null,
    activity: null,
    totalTimeMs: null,
    waitTimeMs: null,
  });
});

// --- parseAndroidMeminfo ---------------------------------------------------------

test('parseAndroidMeminfo reads the App Summary TOTAL PSS / TOTAL RSS line (API 30+)', () => {
  const stdout = [
    'App Summary',
    '                       Pss(KB)                        Rss(KB)',
    '                      ------                         ------',
    '  Java Heap:              8192                           8264',
    'Native Heap:              8456                           8512',
    '',
    '           TOTAL PSS:    45271            TOTAL RSS:    54321            TOTAL SWAP PSS:        0',
  ].join('\n');
  assert.deepEqual(parseAndroidMeminfo(stdout), { totalPssKb: 45271, totalRssKb: 54321 });
});

test('parseAndroidMeminfo falls back to a legacy bare TOTAL: line', () => {
  const stdout = [
    '** MEMINFO in pid 1234 [app.blackstory.mobile] **',
    'TOTAL:    31000    TOTAL SWAP PSS:        0',
  ].join('\n');
  assert.deepEqual(parseAndroidMeminfo(stdout), { totalPssKb: 31000, totalRssKb: null });
});

test('parseAndroidMeminfo returns nulls when neither shape is present', () => {
  assert.deepEqual(parseAndroidMeminfo('no such package'), { totalPssKb: null, totalRssKb: null });
});

// --- parseAndroidGfxInfo ---------------------------------------------------------

test('parseAndroidGfxInfo reads the Stats since reset block', () => {
  const stdout = [
    '** Graphics info for pid 1234 [app.blackstory.mobile] **',
    '',
    'Stats since reset:',
    'Total frames rendered: 1523',
    'Janky frames: 68 (4.46%)',
    '50th percentile: 8ms',
    '90th percentile: 15ms',
    '95th percentile: 22ms',
    '99th percentile: 41ms',
    'Number Missed Vsync: 3',
  ].join('\n');
  assert.deepEqual(parseAndroidGfxInfo(stdout), {
    totalFrames: 1523,
    jankyFrames: 68,
    jankyPercent: 4.46,
    p50Ms: 8,
    p90Ms: 15,
    p95Ms: 22,
    p99Ms: 41,
  });
});

test('parseAndroidGfxInfo returns nulls for a package with no frames since reset', () => {
  const stdout = [
    '** Graphics info for pid 1234 [app.blackstory.mobile] **',
    '',
    'Stats since reset:',
  ].join('\n');
  assert.deepEqual(parseAndroidGfxInfo(stdout), {
    totalFrames: null,
    jankyFrames: null,
    jankyPercent: null,
    p50Ms: null,
    p90Ms: null,
    p95Ms: null,
    p99Ms: null,
  });
});

// --- stats helpers ---------------------------------------------------------

test('median handles odd and even counts, and ignores non-finite entries', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([1, Number.NaN, 3]), 2);
  assert.equal(median([]), null);
});

test('percentile uses nearest-rank over a sorted copy and clamps to the input range', () => {
  const samples = [10, 20, 30, 40, 50];
  assert.equal(percentile(samples, 50), 30);
  assert.equal(percentile(samples, 90), 50);
  assert.equal(percentile(samples, 0), 10);
  assert.equal(percentile([], 90), null);
});
