
/**
 * Silence is a failure mode, not just explicit failure. A job that simply
 * stops running (no run records at) must be detected, and a job that
 * exceeds its declared budget must be detected both independent of whether any run recorded
 * an explicit 'failure' status.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateJobBudget, evaluateMissedRuns } from './health.ts';
import { completeJobRun, failJobRun, startJobRun } from './run-record.ts';
import type { ScheduledJobDefinition } from './types.ts';

const JOB: ScheduledJobDefinition = {
  id: 'daily-job',
  owner: 'scheduled-jobs',
  description: 'test job',
  cadence: { cronExpression: '0 4 * * *', nominalIntervalMs: 86_400_000, humanReadable: 'daily' },
  budget: { unit: 'items', maxPerRun: 100 },
  timeoutSec: 600,
  idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
  killSwitchId: 'research-campaigns',
  targetWorker: { package: 'research', function: 'sample.run' },
  environment: 'repo-internal',
  publicEffect: 'none',
  rosterStatus: 'real',
  consecutiveMissedRunThreshold: 3,
};

test('a job with no run history at all, silently overdue, triggers a missed-run alert', () => {
  const evaluation = evaluateMissedRuns({
    job: JOB,
    runs: [],
    registeredAtIso: '2026-07-10T04:00:00.000Z',
    // 4 days of complete silence since registration, threshold is 3 consecutive daily misses.
    nowIso: '2026-07-14T04:00:00.000Z',
  });
  assert.equal(evaluation.triggered, true);
  assert.ok(evaluation.missedIntervals >= 3);
  assert.equal(evaluation.lastSuccessAt, undefined);
});

test('a job that ran recently and on cadence is not flagged as missed', () => {
  const runs = [
    completeJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-1', startedAt: '2026-07-16T04:00:00.000Z' }), {
      completedAt: '2026-07-16T04:05:00.000Z',
    }),
  ];
  const evaluation = evaluateMissedRuns({
    job: JOB,
    runs,
    registeredAtIso: '2026-07-01T00:00:00.000Z',
    nowIso: '2026-07-16T12:00:00.000Z',
  });
  assert.equal(evaluation.triggered, false);
  assert.equal(evaluation.lastSuccessAt, '2026-07-16T04:05:00.000Z');
});

test('an explicit failure run does not reset the silence clock — a job that keeps loudly failing is still "missed" for alerting purposes', () => {
  const runs = [
    failJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-crashed', startedAt: '2026-07-10T04:00:00.000Z' }), {
      completedAt: '2026-07-10T04:00:05.000Z',
      errorSummary: 'adapter timeout',
    }),
  ];
  const evaluation = evaluateMissedRuns({
    job: JOB,
    runs,
    registeredAtIso: '2026-07-05T04:00:00.000Z',
    nowIso: '2026-07-14T04:00:00.000Z',
  });
  // No completed success/quarantined run exists, so silence is measured from registration
  // an explicit failure record must not mask the underlying missed-successful-run silence.
  assert.equal(evaluation.triggered, true);
  assert.equal(evaluation.lastSuccessAt, undefined);
});

test('a run within budget does not trigger a budget alert', () => {
  const run = completeJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-ok', startedAt: '2026-07-17T04:00:00.000Z' }), {
    completedAt: '2026-07-17T04:05:00.000Z',
    itemsProcessed: 50,
  });
  const evaluation = evaluateJobBudget({ job: JOB, run });
  assert.equal(evaluation.triggered, false);
  assert.equal(evaluation.percentOfBudget, 50);
});

test('a run that exceeds its declared budget triggers a budget alert', () => {
  const run = completeJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-over', startedAt: '2026-07-17T04:00:00.000Z' }), {
    completedAt: '2026-07-17T04:05:00.000Z',
    itemsProcessed: 250,
  });
  const evaluation = evaluateJobBudget({ job: JOB, run });
  assert.equal(evaluation.triggered, true);
  assert.equal(evaluation.observed, 250);
  assert.equal(evaluation.threshold, 100);
  assert.equal(evaluation.percentOfBudget, 250);
});
