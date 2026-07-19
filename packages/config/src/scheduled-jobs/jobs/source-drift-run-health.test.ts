/**
 * Proves the source-drift-run-health job body is REAL it calls @repo/domain's
 * evaluateRunHealth/shouldQuarantineRun/shouldDeadLetterRun (the same functions the
 * source-adapter pipeline itself uses) rather than reimplementing drift evaluation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSourceDriftRunHealthJob } from './source-drift-run-health.ts';

test('a healthy adapter run completes as success with no issues', () => {
  const result = runSourceDriftRunHealthJob({
    jobRunId: 'run-1',
    startedAt: '2026-07-17T04:00:00.000Z',
    completedAt: '2026-07-17T04:02:00.000Z',
    adapterId: 'nara-catalog-v1',
    consecutiveQuarantines: 0,
    expectedCount: 1000,
    actualCount: 1010,
    expectedSchemaVersion: '1.0.0',
    observedSchemaVersion: '1.0.0',
  });
  assert.equal(result.run.status, 'success');
  assert.equal(result.quarantined, false);
  assert.equal(result.deadLetter, false);
  assert.deepEqual(result.issues, []);
});

test('record-count drift quarantines the run', () => {
  const result = runSourceDriftRunHealthJob({
    jobRunId: 'run-2',
    startedAt: '2026-07-17T04:00:00.000Z',
    completedAt: '2026-07-17T04:02:00.000Z',
    adapterId: 'nara-catalog-v1',
    consecutiveQuarantines: 0,
    expectedCount: 1000,
    actualCount: 10,
    expectedSchemaVersion: '1.0.0',
    observedSchemaVersion: '1.0.0',
  });
  assert.equal(result.run.status, 'quarantined');
  assert.equal(result.quarantined, true);
  assert.ok(result.issues.includes('record_count_drift'));
});

test('a third consecutive quarantine triggers dead-lettering ( threshold)', () => {
  const result = runSourceDriftRunHealthJob({
    jobRunId: 'run-3',
    startedAt: '2026-07-17T04:00:00.000Z',
    completedAt: '2026-07-17T04:02:00.000Z',
    adapterId: 'nara-catalog-v1',
    consecutiveQuarantines: 2,
    expectedCount: 1000,
    actualCount: 10,
    expectedSchemaVersion: '1.0.0',
    observedSchemaVersion: '1.0.0',
  });
  assert.equal(result.deadLetter, true);
});
