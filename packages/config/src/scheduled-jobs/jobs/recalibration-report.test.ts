/**
 * BB-081: proves the recalibration-report job body is REAL — it calls @black-book/domain's
 * relevance-feedback module (buildRecalibrationReport / evaluateRelevanceDriftAlarm) rather than
 * reimplementing any analysis, produces report-only output (no publish, no weight mutation), and
 * raises a real BB-034 SEC-SRC-01 alert only when disagreement drift is actually triggered.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RELEVANCE_FEEDBACK_SCHEMA_VERSION, type RelevanceDecisionLogEntry } from '@black-book/domain';
import {
  DEFAULT_RECALIBRATION_DRIFT_THRESHOLDS,
  RECALIBRATION_REPORT_JOB_ID,
  runRecalibrationReportJob,
} from './recalibration-report.ts';

const WINDOW_START = '2026-07-01T00:00:00.000Z';
const WINDOW_END = '2026-07-31T00:00:00.000Z';

function entry(
  id: number,
  disposition: RelevanceDecisionLogEntry['disposition'],
): RelevanceDecisionLogEntry {
  return {
    schemaVersion: RELEVANCE_FEEDBACK_SCHEMA_VERSION,
    caseId: `case-${id}`,
    candidateId: `candidate-${id}`,
    transitionIndex: 0,
    from: 'relevance_review',
    to: disposition === 'accept' ? 'relevance_confirmed' : 'excluded',
    reasonCode: disposition === 'accept' ? 'relevance_confirmed' : 'relevance_not_established',
    actorId: 'researcher-1',
    occurredAt: '2026-07-15T00:00:00.000Z',
    assessmentDecision: 'include',
    compositeScore: 0.7,
    policyVersion: '1.0.0',
    featureValues: [],
    disposition,
    overrideApplied: disposition === 'override',
    inputFingerprint: `sha256:${id.toString().padStart(64, '0')}`,
    assessedAt: '2026-07-15T00:00:00.000Z',
  };
}

test('a low-disagreement run completes as success with no drift alert', () => {
  const decisionLog = [entry(1, 'accept'), entry(2, 'accept'), entry(3, 'accept')];
  const result = runRecalibrationReportJob({
    jobRunId: 'run-1',
    startedAt: '2026-08-01T05:00:00.000Z',
    completedAt: '2026-08-01T05:05:00.000Z',
    correlationId: 'corr-1',
    decisionLog,
    driftWindow: { start: WINDOW_START, end: WINDOW_END },
  });
  assert.equal(result.run.jobId, RECALIBRATION_REPORT_JOB_ID);
  assert.equal(result.run.status, 'success');
  assert.equal(result.report.sampleSize, 3);
  assert.equal(result.driftEvaluation.triggered, false);
  assert.equal(result.driftAlert, undefined);
  // Report-only: nothing here proposes, gates, or approves a weight change.
  assert.deepEqual(Object.keys(result).sort(), ['driftEvaluation', 'report', 'run']);
});

test('sustained disagreement above threshold with enough samples raises a real BB-034 SEC-SRC-01 alert', () => {
  const decisionLog = [
    entry(1, 'accept'),
    entry(2, 'reject'),
    entry(3, 'reject'),
    entry(4, 'reject'),
    entry(5, 'reject'),
    entry(6, 'reject'),
    entry(7, 'reject'),
    entry(8, 'reject'),
    entry(9, 'reject'),
    entry(10, 'reject'),
  ];
  const result = runRecalibrationReportJob({
    jobRunId: 'run-2',
    startedAt: '2026-08-01T05:00:00.000Z',
    completedAt: '2026-08-01T05:05:00.000Z',
    correlationId: 'corr-2',
    decisionLog,
    driftWindow: { start: WINDOW_START, end: WINDOW_END },
  });
  assert.equal(result.driftEvaluation.triggered, true);
  assert.equal(result.run.status, 'quarantined');
  assert.deepEqual(result.run.issues, ['relevance_confidence_drift_threshold_exceeded']);
  assert.ok(result.driftAlert);
  assert.equal(result.driftAlert?.policyId, 'SEC-SRC-01');
  assert.equal(result.driftAlert?.service, `scheduled-job:${RECALIBRATION_REPORT_JOB_ID}`);
  assert.equal(result.driftAlert?.observedValue, 90);
});

test('the default drift thresholds require at least ten decisions before triggering', () => {
  assert.equal(DEFAULT_RECALIBRATION_DRIFT_THRESHOLDS.minimumSampleSize, 10);
  const tooFewSamples = [entry(1, 'reject'), entry(2, 'reject')];
  const result = runRecalibrationReportJob({
    jobRunId: 'run-3',
    startedAt: '2026-08-01T05:00:00.000Z',
    completedAt: '2026-08-01T05:05:00.000Z',
    correlationId: 'corr-3',
    decisionLog: tooFewSamples,
    driftWindow: { start: WINDOW_START, end: WINDOW_END },
  });
  assert.equal(result.driftEvaluation.triggered, false);
  assert.equal(result.driftAlert, undefined);
});
