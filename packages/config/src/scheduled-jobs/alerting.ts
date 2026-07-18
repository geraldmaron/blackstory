
/**
 * Bridges scheduled-job health evaluations into existing operator-alert pattern
 * (packages/observability/src/security-alerts.ts + security-anomaly.ts) instead of inventing a
 * new alert channel. Reuses two already-shipped policies verbatim:
 * - SEC-SRC-01 "Source adapter anomaly burst" for missed-run silence (closest existing kind:
 * source_adapter.anomaly; a scheduled job going silent is exactly the kind of drift that
 * policy exists to surface).
 * - SEC-COST-01 "Cost anomaly score exceeds budget guardrail" for budget overruns.
 *
 * Known limitation (documented, not hidden): the *trigger decision* is this module's own
 * evaluateMissedRuns/evaluateJobBudget in health.ts use each job's own configured threshold and
 * budget, not SEC-SRC-01/SEC-COST-01's static threshold fields. Those two policies are reused
 * only for delivery plumbing (severity, runbook, notification channels, payload shape). The
 * alert payload's `threshold` field therefore reflects the policy's generic threshold,
 * not the job's specific one; percentOfBudget is included precisely so the payload stays
 * meaningful despite that. A follow-up could add dedicated SEC-JOB-* policies to
 * packages/observability if dedicated job-alert policies are needed.
 */
import { DEFAULT_ALERT_POLICIES, buildAlertPayload, type SecurityAlertPayload } from '@repo/observability';
import type { BudgetEvaluation, MissedRunEvaluation } from './health.js';
import type { ScheduledJobDefinition } from './types.js';

const MISSED_RUN_ALERT_POLICY_ID = 'SEC-SRC-01';
const BUDGET_ALERT_POLICY_ID = 'SEC-COST-01';

function requirePolicy(id: string) {
  const policy = DEFAULT_ALERT_POLICIES.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(
      ` alert policy "${id}" is missing; scheduled-jobs alerting depends on it existing`,
    );
  }
  return policy;
}

export function buildMissedRunAlert(input: {
  readonly job: ScheduledJobDefinition;
  readonly evaluation: MissedRunEvaluation;
  readonly triggeredAt: string;
  readonly correlationId: string;
}): SecurityAlertPayload | undefined {
  if (!input.evaluation.triggered) {
    return undefined;
  }
  return buildAlertPayload({
    policy: requirePolicy(MISSED_RUN_ALERT_POLICY_ID),
    service: `scheduled-job:${input.job.id}`,
    correlationId: input.correlationId,
    observedValue: input.evaluation.missedIntervals,
    triggeredAt: input.triggeredAt,
  });
}

export function buildBudgetExceededAlert(input: {
  readonly job: ScheduledJobDefinition;
  readonly evaluation: BudgetEvaluation;
  readonly triggeredAt: string;
  readonly correlationId: string;
}): SecurityAlertPayload | undefined {
  if (!input.evaluation.triggered) {
    return undefined;
  }
  return buildAlertPayload({
    policy: requirePolicy(BUDGET_ALERT_POLICY_ID),
    service: `scheduled-job:${input.job.id}`,
    correlationId: input.correlationId,
    observedValue: input.evaluation.percentOfBudget,
    triggeredAt: input.triggeredAt,
  });
}

/** Convenience: evaluate + build every alert a completed run should raise, in one call. */
export function buildJobRunAlerts(input: {
  readonly job: ScheduledJobDefinition;
  readonly missedRun?: MissedRunEvaluation;
  readonly budget?: BudgetEvaluation;
  readonly triggeredAt: string;
  readonly correlationId: string;
}): readonly SecurityAlertPayload[] {
  const alerts: SecurityAlertPayload[] = [];
  if (input.missedRun) {
    const alert = buildMissedRunAlert({
      job: input.job,
      evaluation: input.missedRun,
      triggeredAt: input.triggeredAt,
      correlationId: input.correlationId,
    });
    if (alert) alerts.push(alert);
  }
  if (input.budget) {
    const alert = buildBudgetExceededAlert({
      job: input.job,
      evaluation: input.budget,
      triggeredAt: input.triggeredAt,
      correlationId: input.correlationId,
    });
    if (alert) alerts.push(alert);
  }
  return alerts;
}
