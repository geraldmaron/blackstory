/**
 * REAL roster entry: relevance/confidence recalibration report. Wraps
 * @repo/domain's relevance-feedback module buildRecalibrationReport (per-dimension
 * disagreement, query-pack effectiveness, graylist yield, source-tier precision) and
 * evaluateRelevanceDriftAlarm the same way gold-corpus-regression.ts wraps
 * @repo/testing's evaluateCorpus: this wrapper does not reimplement any analysis, it only
 * adapts the domain module's pure functions into the generic JobRunRecord shape so the report can
 * be scheduled through this registry.
 *
 * Report-only, always: this job produces a RecalibrationReport + a drift-alarm evaluation (and,
 * only if the disagreement rate is sustained above threshold, a alert). It never proposes,
 * gates, or approves a weight change proposeWeightChange requireGoldCorpusGatePassed
 * approveWeightChange (@repo/domain) are a separate, human-triggered path with their own
 * distinct-approver and gold-corpus-gate requirements (see relevance-feedback.test.ts in
 * @repo/domain), deliberately not invoked anywhere in this file. No publish, no live
 * weight mutation.
 *
 * Drift alerts reuse SEC-SRC-01 policy via the exact call shape
 * ../alerting.ts's buildMissedRunAlert already uses see that file's docstring for why
 * SEC-SRC-01 ("source adapter anomaly burst") is the closest existing "anomaly burst" kind to
 * reuse for a non-source-adapter drift signal (missed-run silence is the existing precedent for
 * this same stretch).
 */
import {
  buildRecalibrationReport,
  evaluateRelevanceDriftAlarm,
  type RecalibrationReport,
  type RelevanceDecisionLogEntry,
  type RelevanceDriftAlarmEvaluation,
  type RelevanceDriftAlarmThresholds,
  type RelevanceDriftWindow,
} from '@repo/domain';
import {
  DEFAULT_ALERT_POLICIES,
  buildAlertPayload,
  type SecurityAlertPayload,
} from '@repo/observability';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const RECALIBRATION_REPORT_JOB_ID = 'relevance-confidence-recalibration-report';

const DRIFT_ALERT_POLICY_ID = 'SEC-SRC-01';

/** Conservative defaults; callers may override per run. Sustained disagreement above 25% across
 * at least 10 decisions in the window is the trigger a handful of disagreements should not
 * page anyone (see evaluateRelevanceDriftAlarm's minimumSampleSize gate). */
export const DEFAULT_RECALIBRATION_DRIFT_THRESHOLDS: RelevanceDriftAlarmThresholds = {
  disagreementRateThreshold: 0.25,
  minimumSampleSize: 10,
};

function requirePolicy(id: string) {
  const policy = DEFAULT_ALERT_POLICIES.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(
      ` alert policy "${id}" is missing; recalibration-report drift alarm depends on it existing`,
    );
  }
  return policy;
}

export function buildRecalibrationDriftAlert(input: {
  readonly evaluation: RelevanceDriftAlarmEvaluation;
  readonly triggeredAt: string;
  readonly correlationId: string;
}): SecurityAlertPayload | undefined {
  if (!input.evaluation.triggered) {
    return undefined;
  }
  return buildAlertPayload({
    policy: requirePolicy(DRIFT_ALERT_POLICY_ID),
    service: `scheduled-job:${RECALIBRATION_REPORT_JOB_ID}`,
    correlationId: input.correlationId,
    observedValue: Math.round(input.evaluation.disagreementRate * 100),
    triggeredAt: input.triggeredAt,
  });
}

export type RecalibrationReportJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly correlationId: string;
  readonly decisionLog: readonly RelevanceDecisionLogEntry[];
  readonly driftWindow: RelevanceDriftWindow;
  readonly driftThresholds?: RelevanceDriftAlarmThresholds;
  readonly queryPackRecords?: Parameters<typeof buildRecalibrationReport>[0]['queryPackRecords'];
  readonly queryPacks?: Parameters<typeof buildRecalibrationReport>[0]['queryPacks'];
  readonly graylistYieldInput?: Parameters<
    typeof buildRecalibrationReport
  >[0]['graylistYieldInput'];
};

export type RecalibrationReportJobResult = {
  readonly run: JobRunRecord;
  readonly report: RecalibrationReport;
  readonly driftEvaluation: RelevanceDriftAlarmEvaluation;
  readonly driftAlert?: SecurityAlertPayload;
};

export function runRecalibrationReportJob(
  input: RecalibrationReportJobInput,
): RecalibrationReportJobResult {
  const started = startJobRun({
    jobId: RECALIBRATION_REPORT_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });

  const report = buildRecalibrationReport({
    generatedAt: input.completedAt,
    decisionLog: input.decisionLog,
    ...(input.queryPackRecords ? { queryPackRecords: input.queryPackRecords } : {}),
    ...(input.queryPacks ? { queryPacks: input.queryPacks } : {}),
    ...(input.graylistYieldInput ? { graylistYieldInput: input.graylistYieldInput } : {}),
  });

  const driftEvaluation = evaluateRelevanceDriftAlarm({
    entries: input.decisionLog,
    window: input.driftWindow,
    thresholds: input.driftThresholds ?? DEFAULT_RECALIBRATION_DRIFT_THRESHOLDS,
  });

  const driftAlert = buildRecalibrationDriftAlert({
    evaluation: driftEvaluation,
    triggeredAt: input.completedAt,
    correlationId: input.correlationId,
  });

  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.decisionLog.length,
    itemsProcessed: report.sampleSize,
    issues: driftEvaluation.triggered ? ['relevance_confidence_drift_threshold_exceeded'] : [],
  });

  return {
    run,
    report,
    driftEvaluation,
    ...(driftAlert ? { driftAlert } : {}),
  };
}
