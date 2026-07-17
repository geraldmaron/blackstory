/**
 * BB-084 acceptance: a normal run records success (started/completed, duration, item counts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeJobRun, createInMemoryJobRunStore, failJobRun, startJobRun } from './run-record.ts';

test('a normal run records success with duration and item counts', () => {
  const started = startJobRun({ jobId: 'sample-job', jobRunId: 'run-1', startedAt: '2026-07-17T04:00:00.000Z' });
  assert.equal(started.status, 'running');
  const completed = completeJobRun(started, {
    completedAt: '2026-07-17T04:00:30.000Z',
    itemsExpected: 10,
    itemsProcessed: 10,
  });
  assert.equal(completed.status, 'success');
  assert.equal(completed.durationMs, 30_000);
  assert.equal(completed.itemsExpected, 10);
  assert.equal(completed.itemsProcessed, 10);
  assert.deepEqual(completed.issues, []);
});

test('a run with issues completes as quarantined, not success', () => {
  const started = startJobRun({ jobId: 'sample-job', jobRunId: 'run-2', startedAt: '2026-07-17T04:00:00.000Z' });
  const completed = completeJobRun(started, {
    completedAt: '2026-07-17T04:00:10.000Z',
    issues: ['record_count_drift'],
  });
  assert.equal(completed.status, 'quarantined');
  assert.deepEqual(completed.issues, ['record_count_drift']);
});

test('a failed run records an error summary', () => {
  const started = startJobRun({ jobId: 'sample-job', jobRunId: 'run-3', startedAt: '2026-07-17T04:00:00.000Z' });
  const failed = failJobRun(started, { completedAt: '2026-07-17T04:00:05.000Z', errorSummary: 'timeout' });
  assert.equal(failed.status, 'failure');
  assert.equal(failed.errorSummary, 'timeout');
  assert.equal(failed.durationMs, 5_000);
});

test('the in-memory store records, lists ascending by start, and finds the latest run per job', () => {
  const store = createInMemoryJobRunStore();
  store.record(startJobRun({ jobId: 'job-a', jobRunId: 'a-2', startedAt: '2026-07-17T02:00:00.000Z' }));
  store.record(startJobRun({ jobId: 'job-a', jobRunId: 'a-1', startedAt: '2026-07-17T01:00:00.000Z' }));
  store.record(startJobRun({ jobId: 'job-b', jobRunId: 'b-1', startedAt: '2026-07-17T01:30:00.000Z' }));

  const historyA = store.listByJob('job-a');
  assert.deepEqual(historyA.map((run) => run.jobRunId), ['a-1', 'a-2']);
  assert.equal(store.latestByJob('job-a')?.jobRunId, 'a-2');
  assert.equal(store.latestByJob('job-c'), undefined);

  // re-recording the same jobRunId updates it in place rather than duplicating.
  store.record(
    completeJobRun(startJobRun({ jobId: 'job-a', jobRunId: 'a-2', startedAt: '2026-07-17T02:00:00.000Z' }), {
      completedAt: '2026-07-17T02:00:05.000Z',
    }),
  );
  assert.equal(store.listByJob('job-a').length, 2);
  assert.equal(store.latestByJob('job-a')?.status, 'success');
});
