/**
 * Missed-run and over-budget evaluation for scheduled jobs. Silence is a failure mode: a job
 * that simply stops running (no explicit failure, just nothing happening) must still be
 * detectable and alertable see alerting.ts, which turns a `triggered: true` evaluation from
 * this module into a operator alert.
 */
import type { ScheduledJobDefinition } from './types.js';
import type { JobRunRecord } from './run-record.js';

export type MissedRunEvaluation = {
  readonly jobId: string;
  readonly triggered: boolean;
  readonly missedIntervals: number;
  readonly thresholdIntervals: number;
  readonly nominalIntervalMs: number;
  readonly lastSuccessAt?: string;
};

/** `runs` should be one job's run history, any order; only completed success/quarantined runs
 * count as "the job ran" for silence-detection purposes (a bare 'running' record with no
 * completedAt does not reset the silence clock, nor does an explicit 'failure' a job that
 * keeps failing loudly is a different, already-visible problem from one that goes silent). */
export function evaluateMissedRuns(input: {
  readonly job: ScheduledJobDefinition;
  readonly runs: readonly JobRunRecord[];
  readonly nowIso: string;
  /** When the job became due for the first time (e.g. registration time), used when there is
   * no run history yet at all. */
  readonly registeredAtIso: string;
}): MissedRunEvaluation {
  const { job, runs, nowIso, registeredAtIso } = input;
  const completedSuccessLike = runs
    .filter(
      (run) =>
        run.completedAt !== undefined && (run.status === 'success' || run.status === 'quarantined'),
    )
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));
  const last = completedSuccessLike.at(-1);
  const sinceIso = last?.completedAt ?? registeredAtIso;
  const elapsedMs = Math.max(0, Date.parse(nowIso) - Date.parse(sinceIso));
  const missedIntervals = Math.floor(elapsedMs / job.cadence.nominalIntervalMs);
  return {
    jobId: job.id,
    triggered: missedIntervals >= job.consecutiveMissedRunThreshold,
    missedIntervals,
    thresholdIntervals: job.consecutiveMissedRunThreshold,
    nominalIntervalMs: job.cadence.nominalIntervalMs,
    ...(last?.completedAt === undefined ? {} : { lastSuccessAt: last.completedAt }),
  };
}

export type BudgetEvaluation = {
  readonly jobId: string;
  readonly jobRunId: string;
  readonly triggered: boolean;
  readonly observed: number;
  readonly threshold: number;
  readonly unit: string;
  /** observed as a percentage of threshold, rounded used to align with SEC-COST-01
   * percentage-of-budget-guardrail alert semantics (see alerting.ts). */
  readonly percentOfBudget: number;
};

export function evaluateJobBudget(input: {
  readonly job: ScheduledJobDefinition;
  readonly run: JobRunRecord;
}): BudgetEvaluation {
  const observed = input.run.costUnits ?? input.run.itemsProcessed ?? 0;
  const threshold = input.job.budget.maxPerRun;
  return {
    jobId: input.job.id,
    jobRunId: input.run.jobRunId,
    triggered: observed > threshold,
    observed,
    threshold,
    unit: input.job.budget.unit,
    percentOfBudget: threshold === 0 ? 0 : Math.round((observed / threshold) * 100),
  };
}
