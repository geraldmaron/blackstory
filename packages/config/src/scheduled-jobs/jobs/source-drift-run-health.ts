/**
 * REAL roster entry: source drift + adapter run-health checks. Wraps
 * @repo/domain's evaluateRunHealth/shouldQuarantineRun/shouldDeadLetterRun the exact
 * same functions the source-adapter pipeline itself uses (packages/domain/src/adapters/
 * run-health.ts), which in turn mirror the research worker's Python run_health module
 * (workers/research/src/black_book_research/adapters/run_health.py). This wrapper does not
 * reimplement drift evaluation; it only adapts the existing evaluator's input/output into the
 * generic JobRunRecord shape (run-record.ts) so it can be scheduled through this registry.
 */
import {
  evaluateRunHealth,
  shouldDeadLetterRun,
  shouldQuarantineRun,
  type EvaluateRunHealthInput,
} from '@repo/domain';
import { completeJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const SOURCE_DRIFT_RUN_HEALTH_JOB_ID = 'source-drift-run-health-check';

export type SourceDriftRunHealthJobInput = EvaluateRunHealthInput & {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly adapterId: string;
  /** Consecutive prior quarantines for this adapter, used to decide dead-lettering. */
  readonly consecutiveQuarantines: number;
};

export type SourceDriftRunHealthJobResult = {
  readonly run: JobRunRecord;
  readonly adapterId: string;
  readonly quarantined: boolean;
  readonly deadLetter: boolean;
  readonly issues: readonly string[];
};

export function runSourceDriftRunHealthJob(
  input: SourceDriftRunHealthJobInput,
): SourceDriftRunHealthJobResult {
  const started = startJobRun({
    jobId: SOURCE_DRIFT_RUN_HEALTH_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const health = evaluateRunHealth(input);
  const quarantined = shouldQuarantineRun(health);
  const run = completeJobRun(started, {
    completedAt: input.completedAt,
    itemsExpected: input.expectedCount,
    itemsProcessed: input.actualCount,
    issues: health.issues,
  });
  // shouldDeadLetterRun expects the consecutive-quarantine count *including* this run; the
  // caller passes the count of quarantines *before* this one.
  const deadLetter = quarantined && shouldDeadLetterRun(input.consecutiveQuarantines + 1);
  return {
    run,
    adapterId: input.adapterId,
    quarantined,
    deadLetter,
    issues: health.issues,
  };
}
