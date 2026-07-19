
/**
 * Job-run records generalize the research worker's run-health pattern (workers/research/src/
 * black_book_research/adapters/run_health.py, mirrored in packages/domain/src/adapters/
 * run-health.ts): started/completed/failed, duration, item counts, error summary. This module
 * does not reimplement adapter-specific health evaluation (record-count/schema drift) that
 * stays in @repo/domain's evaluateRunHealth, reused as-is by jobs/source-drift-run-
 * health.ts. This module is the broader, job-agnostic run-record shape every scheduled job
 * (not just source adapters) produces one of per dispatch.
 */

export const JOB_RUN_STATUSES = ['running', 'success', 'quarantined', 'failure'] as const;
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export type JobRunRecord = {
  /** The audit/outbox correlation id for every write this run makes see audit.ts. */
  readonly jobRunId: string;
  readonly jobId: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly status: JobRunStatus;
  readonly itemsExpected?: number;
  readonly itemsProcessed?: number;
  readonly costUnits?: number;
  /** Mirrors run_health.py's RunHealthIssue-style short codes. */
  readonly issues?: readonly string[];
  readonly errorSummary?: string;
};

function computeDurationMs(startedAt: string, completedAt: string): number {
  return Date.parse(completedAt) - Date.parse(startedAt);
}

export function startJobRun(input: {
  readonly jobId: string;
  readonly jobRunId: string;
  readonly startedAt: string;
}): JobRunRecord {
  return {
    jobId: input.jobId,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
    status: 'running',
  };
}

export function completeJobRun(
  run: JobRunRecord,
  input: {
    readonly completedAt: string;
    readonly itemsExpected?: number;
    readonly itemsProcessed?: number;
    readonly costUnits?: number;
    readonly issues?: readonly string[];
  },
): JobRunRecord {
  const issues = input.issues ?? [];
  return {
    ...run,
    completedAt: input.completedAt,
    durationMs: computeDurationMs(run.startedAt, input.completedAt),
    status: issues.length > 0 ? 'quarantined' : 'success',
    issues,
    ...(input.itemsExpected === undefined ? {} : { itemsExpected: input.itemsExpected }),
    ...(input.itemsProcessed === undefined ? {} : { itemsProcessed: input.itemsProcessed }),
    ...(input.costUnits === undefined ? {} : { costUnits: input.costUnits }),
  };
}

export function failJobRun(
  run: JobRunRecord,
  input: { readonly completedAt: string; readonly errorSummary: string },
): JobRunRecord {
  return {
    ...run,
    completedAt: input.completedAt,
    durationMs: computeDurationMs(run.startedAt, input.completedAt),
    status: 'failure',
    errorSummary: input.errorSummary,
  };
}

export type JobRunStore = {
  record(run: JobRunRecord): void;
  listByJob(jobId: string): readonly JobRunRecord[];
  latestByJob(jobId: string): JobRunRecord | undefined;
};

export function createInMemoryJobRunStore(seed: readonly JobRunRecord[] = []): JobRunStore {
  const runs: JobRunRecord[] = [...seed];
  function listByJob(jobId: string): readonly JobRunRecord[] {
    return runs
      .filter((run) => run.jobId === jobId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
  return {
    record(run) {
      const index = runs.findIndex((existing) => existing.jobRunId === run.jobRunId);
      if (index === -1) {
        runs.push(run);
      } else {
        runs[index] = run;
      }
    },
    listByJob,
    latestByJob(jobId) {
      const history = listByJob(jobId);
      return history.at(-1);
    },
  };
}
