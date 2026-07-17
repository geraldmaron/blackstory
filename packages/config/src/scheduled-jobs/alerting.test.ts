/**
 * BB-084 acceptance: a job that exceeds its budget triggers an operator alert, and N consecutive
 * missed runs (silence) trigger an operator alert — both delivered through BB-034's existing
 * alert-policy pattern (packages/observability), not a new alert channel.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ALERT_POLICIES } from '@black-book/observability';
import { buildBudgetExceededAlert, buildJobRunAlerts, buildMissedRunAlert } from './alerting.ts';
import { evaluateJobBudget, evaluateMissedRuns } from './health.ts';
import { completeJobRun, startJobRun } from './run-record.ts';
import type { ScheduledJobDefinition } from './types.ts';

const JOB: ScheduledJobDefinition = {
  id: 'daily-job',
  owner: 'BB-084',
  description: 'test job',
  cadence: { cronExpression: '0 4 * * *', nominalIntervalMs: 86_400_000, humanReadable: 'daily' },
  budget: { unit: 'items', maxPerRun: 100 },
  timeoutSec: 600,
  idempotencyKeyScheme: 'job:{jobId}:{dayStart}',
  killSwitchId: 'research-campaigns',
  targetWorker: { package: 'research', function: 'sample.run' },
  environment: 'blackbook-internal',
  publicEffect: 'none',
  rosterStatus: 'real',
  consecutiveMissedRunThreshold: 3,
};

test('N consecutive missed runs (silence, no failure record needed) raises a BB-034 alert', () => {
  const evaluation = evaluateMissedRuns({
    job: JOB,
    runs: [],
    registeredAtIso: '2026-07-10T04:00:00.000Z',
    nowIso: '2026-07-14T04:00:00.000Z',
  });
  assert.equal(evaluation.triggered, true);

  const alert = buildMissedRunAlert({
    job: JOB,
    evaluation,
    triggeredAt: '2026-07-14T04:00:00.000Z',
    correlationId: 'job-run-missed-check-1',
  });
  assert.ok(alert);
  // Reuses the real, already-shipped BB-034 policy verbatim — not a new alert channel.
  const policy = DEFAULT_ALERT_POLICIES.find((p) => p.id === 'SEC-SRC-01');
  assert.ok(policy);
  assert.equal(alert.policyId, 'SEC-SRC-01');
  assert.equal(alert.severity, policy!.severity);
  assert.equal(alert.runbookId, policy!.runbookId);
  assert.equal(alert.correlationId, 'job-run-missed-check-1');
  assert.equal(alert.service, 'scheduled-job:daily-job');
});

test('a job that does not miss runs raises no missed-run alert', () => {
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
  assert.equal(
    buildMissedRunAlert({ job: JOB, evaluation, triggeredAt: '2026-07-16T12:00:00.000Z', correlationId: 'r-1' }),
    undefined,
  );
});

test('a job that exceeds its budget raises a BB-034 alert', () => {
  const run = completeJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-over', startedAt: '2026-07-17T04:00:00.000Z' }), {
    completedAt: '2026-07-17T04:05:00.000Z',
    itemsProcessed: 250,
  });
  const evaluation = evaluateJobBudget({ job: JOB, run });
  assert.equal(evaluation.triggered, true);

  const alert = buildBudgetExceededAlert({
    job: JOB,
    evaluation,
    triggeredAt: '2026-07-17T04:05:00.000Z',
    correlationId: run.jobRunId,
  });
  assert.ok(alert);
  assert.equal(alert.policyId, 'SEC-COST-01');
  assert.equal(alert.correlationId, 'r-over');
  assert.equal(alert.observedValue, 250); // percentOfBudget
});

test('a job within budget raises no budget alert', () => {
  const run = completeJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-ok', startedAt: '2026-07-17T04:00:00.000Z' }), {
    completedAt: '2026-07-17T04:05:00.000Z',
    itemsProcessed: 50,
  });
  const evaluation = evaluateJobBudget({ job: JOB, run });
  assert.equal(
    buildBudgetExceededAlert({ job: JOB, evaluation, triggeredAt: '2026-07-17T04:05:00.000Z', correlationId: run.jobRunId }),
    undefined,
  );
});

test('buildJobRunAlerts combines both evaluations into the full alert set for one run', () => {
  const missedRun = evaluateMissedRuns({
    job: JOB,
    runs: [],
    registeredAtIso: '2026-07-10T04:00:00.000Z',
    nowIso: '2026-07-14T04:00:00.000Z',
  });
  const run = completeJobRun(startJobRun({ jobId: JOB.id, jobRunId: 'r-both', startedAt: '2026-07-14T04:00:00.000Z' }), {
    completedAt: '2026-07-14T04:05:00.000Z',
    itemsProcessed: 300,
  });
  const budget = evaluateJobBudget({ job: JOB, run });

  const alerts = buildJobRunAlerts({
    job: JOB,
    missedRun,
    budget,
    triggeredAt: '2026-07-14T04:05:00.000Z',
    correlationId: run.jobRunId,
  });
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts.map((a) => a.policyId).sort(), ['SEC-COST-01', 'SEC-SRC-01']);
});
