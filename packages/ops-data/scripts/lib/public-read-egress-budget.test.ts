/**
 * Tests for the public-read egress monitor's decision logic.
 *
 * The cases that matter are the ones that would make the monitor lie: a counter reset read as
 * "no traffic", and a short window projecting a false spike. A monitor that cries wolf and a
 * monitor that sleeps through the incident both end up ignored.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateEgress,
  formatBytes,
  MIN_ELAPSED_HOURS_FOR_VERDICT,
  type EgressWatermark,
} from './public-read-egress-budget.ts';

const FINGERPRINT = 'SELECT projection%FROM bb_public.release_entities%';
const STATS_SINCE = new Date('2026-07-21T04:56:26Z');
const CAPTURED_AT = new Date('2026-08-09T00:00:00Z');
const GB = 1024 ** 3;

function watermark(overrides: Partial<EgressWatermark> = {}): EgressWatermark {
  return {
    calls: 1_000,
    rowsReturned: 1_000_000,
    statsSince: STATS_SINCE,
    capturedAt: CAPTURED_AT,
    fingerprint: FINGERPRINT,
    ...overrides,
  };
}

test('no previous reading is a first run, not a breach', () => {
  const verdict = evaluateEgress({
    previous: undefined,
    current: { calls: 1, rowsReturned: 1, statsSince: STATS_SINCE },
    now: CAPTURED_AT,
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'first-run');
});

test('a stats_reset is reported as a reset, never as zero traffic', () => {
  // The dangerous misread: counters restart low, the naive delta is hugely negative, and a
  // monitor that only checks "is the delta over budget" reports green through an outage.
  const verdict = evaluateEgress({
    previous: watermark(),
    current: { calls: 5, rowsReturned: 500, statsSince: new Date('2026-08-09T12:00:00Z') },
    now: new Date('2026-08-10T00:00:00Z'),
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'counters-reset');
});

test('counters going backwards is a reset even when stats_since is unchanged', () => {
  // pg_stat_statements can evict a single entry under `max` pressure; the entry re-registers at
  // zero while the extension's own stats_since stays put.
  const verdict = evaluateEgress({
    previous: watermark(),
    current: { calls: 3, rowsReturned: 10, statsSince: STATS_SINCE },
    now: new Date('2026-08-10T00:00:00Z'),
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'counters-reset');
});

test('a window shorter than the minimum does not produce a verdict', () => {
  const verdict = evaluateEgress({
    previous: watermark(),
    current: { calls: 1_100, rowsReturned: 1_500_000, statsSince: STATS_SINCE },
    now: new Date(CAPTURED_AT.getTime() + (MIN_ELAPSED_HOURS_FOR_VERDICT / 2) * 3_600_000),
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'first-run');
});

test('normal post-fix traffic stays under budget', () => {
  // Roughly the observed steady state: a handful of cold-start catalog pulls per day.
  const verdict = evaluateEgress({
    previous: watermark(),
    current: { calls: 1_010, rowsReturned: 1_040_920, statsSince: STATS_SINCE },
    now: new Date(CAPTURED_AT.getTime() + 24 * 3_600_000),
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'measured');
  if (verdict.kind !== 'measured') return;
  assert.equal(verdict.callsDelta, 10);
  assert.equal(verdict.overBudget, false);
});

test('the incident rate would have breached the budget', () => {
  // The real numbers: 49,226 calls and 140.6M rows over 20 days is ~2,461 calls and ~7.03M rows
  // per day, about 12GB/day at 1.8KB/row. This is the case the monitor exists for.
  const verdict = evaluateEgress({
    previous: watermark(),
    current: { calls: 1_000 + 2_461, rowsReturned: 1_000_000 + 7_030_000, statsSince: STATS_SINCE },
    now: new Date(CAPTURED_AT.getTime() + 24 * 3_600_000),
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'measured');
  if (verdict.kind !== 'measured') return;
  assert.equal(verdict.overBudget, true);
  assert.ok(
    verdict.projectedBytesPerDay > 10 * GB,
    `expected >10GB/day, got ${formatBytes(verdict.projectedBytesPerDay)}`,
  );
});

test('projection scales the window to a day rather than reporting the raw delta', () => {
  const verdict = evaluateEgress({
    previous: watermark(),
    current: { calls: 1_100, rowsReturned: 1_000_000 + 1_000, statsSince: STATS_SINCE },
    now: new Date(CAPTURED_AT.getTime() + 6 * 3_600_000),
    bytesPerRow: 1_000,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'measured');
  if (verdict.kind !== 'measured') return;
  // 1,000 rows x 1,000 B over 6h projects to 4x that per day.
  assert.equal(verdict.estimatedBytes, 1_000_000);
  assert.equal(verdict.projectedBytesPerDay, 4_000_000);
});

test('formatBytes stays readable across magnitudes', () => {
  assert.equal(formatBytes(0), '0B');
  assert.equal(formatBytes(1_024), '1.0KB');
  assert.equal(formatBytes(253 * GB), '253GB');
});

test('editing a fingerprint re-baselines instead of alerting on an incomparable delta', () => {
  // Observed live while building this: an over-broad fingerprint was narrowed, and the next run
  // compared the new population's total against the old one's, reporting 20 days of accumulated
  // rows as a single day of egress — a ~6x-budget false alarm. The counters were fine; they just
  // described different sets of statements.
  const verdict = evaluateEgress({
    previous: watermark({ fingerprint: '%FROM bb_public.search_index%' }),
    current: { calls: 5_000, rowsReturned: 12_000_000, statsSince: STATS_SINCE },
    now: new Date(CAPTURED_AT.getTime() + 24 * 3_600_000),
    bytesPerRow: 512,
    budgetBytesPerDay: GB,
    fingerprint: 'SELECT id, release_id%FROM bb_public.search_index%',
  });
  assert.equal(verdict.kind, 'fingerprint-changed');
});

test('a watermark predating the fingerprint column is treated as not comparable', () => {
  const verdict = evaluateEgress({
    previous: watermark({ fingerprint: null }),
    current: { calls: 1_010, rowsReturned: 1_040_920, statsSince: STATS_SINCE },
    now: new Date(CAPTURED_AT.getTime() + 24 * 3_600_000),
    bytesPerRow: 1_800,
    budgetBytesPerDay: GB,
    fingerprint: FINGERPRINT,
  });
  assert.equal(verdict.kind, 'fingerprint-changed');
});
