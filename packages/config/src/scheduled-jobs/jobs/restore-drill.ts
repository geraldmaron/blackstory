/**
 * REAL roster entry: restore-drill scheduling (BB-020/BB-061, closed). Invokes the actual,
 * already-existing print-only script (scripts/backup-restore/staging-restore.stub.sh, which in
 * turn calls infra/firebase/backup/gcloud/staging-import.stub.sh) as a subprocess, the same
 * pattern as jobs/backup-verification.ts. That script is DRY_RUN=1 by default and this wrapper
 * never overrides that — it only ever prints the staging-import plan for a human to review and
 * execute; the human-execution step is the runbook's design (docs/runbooks/backup-restore.md),
 * not a missing implementation here.
 */
import { completeJobRun, failJobRun, startJobRun, type JobRunRecord } from '../run-record.js';
import type { ExecFileFn } from './backup-verification.js';

export const RESTORE_DRILL_JOB_ID = 'restore-drill-quarterly';

export type RestoreDrillJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly execFile: ExecFileFn;
  /** Absolute path to scripts/backup-restore/staging-restore.stub.sh. */
  readonly scriptPath: string;
  readonly exportUri?: string;
  readonly stagingProject?: string;
};

export type RestoreDrillJobResult = {
  readonly run: JobRunRecord;
  readonly ok: boolean;
  /** The staging-import plan the script printed, for the human operator to review and run. */
  readonly printedPlan: string;
};

export async function runRestoreDrillJob(input: RestoreDrillJobInput): Promise<RestoreDrillJobResult> {
  const started = startJobRun({
    jobId: RESTORE_DRILL_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });
  const args = [input.scriptPath, input.exportUri, input.stagingProject].filter(
    (value): value is string => value !== undefined,
  );
  const { stdout, exitCode } = await input.execFile('bash', args);

  const ok = exitCode === 0;
  const run = ok
    ? completeJobRun(started, { completedAt: input.completedAt, itemsExpected: 1, itemsProcessed: 1 })
    : failJobRun(started, {
        completedAt: input.completedAt,
        errorSummary: `scripts/backup-restore/staging-restore.stub.sh exited ${exitCode}`,
      });

  return { run, ok, printedPlan: stdout };
}
