/**
 * Proves the legal-change-monitoring job proposes review_queue events from fixture adapters.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runLegalChangeMonitoringJob } from './legal-change-monitoring.ts';

test('legal monitoring job completes and reports adapter rows', () => {
  const result = runLegalChangeMonitoringJob({
    jobRunId: 'legal-run-1',
    startedAt: '2026-07-17T06:00:00.000Z',
    completedAt: '2026-07-17T06:05:00.000Z',
    prior: [],
  });
  assert.equal(result.run.status, 'success');
  assert.equal(result.summary.adaptersChecked, 4);
  assert.ok(result.summary.monitoringRows >= 5);
});

test('legal monitoring proposes events when prior hashes differ', () => {
  const result = runLegalChangeMonitoringJob({
    jobRunId: 'legal-run-2',
    startedAt: '2026-07-17T06:00:00.000Z',
    completedAt: '2026-07-17T06:05:00.000Z',
    prior: [{ source: 'legiscan-free', externalId: '1900123', changeHash: 'stale-hash' }],
  });
  const legiscanEvents = result.proposedEvents.filter((event) => event.source === 'legiscan-free');
  assert.ok(legiscanEvents.length >= 1);
  assert.equal(legiscanEvents[0]?.status, 'pending_review');
  assert.ok(legiscanEvents[0]?.evidence.archivedCaptureUrl);
});
